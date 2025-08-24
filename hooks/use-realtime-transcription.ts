'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import { toast } from '@/components/ui/toast'
import type { TranscriptItem } from '@/lib/types/transcription'

interface UseRealtimeTranscriptionOptions {
  onTranscriptionUpdate?: (text: string, isFinal: boolean) => void
  onError?: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
}

interface RealtimeConnection {
  ws: WebSocket | null
  audioContext: AudioContext | null
  mediaStream: MediaStream | null
  processor: ScriptProcessorNode | null
}

export function useRealtimeTranscription(options: UseRealtimeTranscriptionOptions = {}) {
  const {
    setSessionStatus,
    setError,
    setLoading,
    addTranscriptItem,
    setCurrentTranscription,
    setFinalTranscription,
    audioConfig,
    settings
  } = useTranscriptionStore()

  const [connection, setConnection] = useState<RealtimeConnection>({
    ws: null,
    audioContext: null,
    mediaStream: null,
    processor: null
  })

  const connectionRef = useRef<RealtimeConnection>(connection)
  const [isConnecting, setIsConnecting] = useState(false)
  const ephemeralKeyRef = useRef<string | null>(null)

  // Update ref when connection changes
  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  const cleanup = useCallback(() => {
    const conn = connectionRef.current

    // Close WebSocket
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close()
    }

    // Stop audio processing
    if (conn.processor) {
      conn.processor.disconnect()
    }

    // Close audio context
    if (conn.audioContext && conn.audioContext.state !== 'closed') {
      conn.audioContext.close()
    }

    // Stop media stream
    if (conn.mediaStream) {
      conn.mediaStream.getTracks().forEach(track => track.stop())
    }

    setConnection({
      ws: null,
      audioContext: null,
      mediaStream: null,
      processor: null
    })
  }, [])

  const handleError = useCallback((error: Error) => {
    console.error('Realtime Transcription Error:', error)
    setError(error.message)
    setSessionStatus('error')
    setLoading(false)
    setIsConnecting(false)
    options.onError?.(error)
    cleanup()
  }, [setError, setSessionStatus, setLoading, cleanup, options])

  const requestMicrophonePermission = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channels,
          echoCancellation: true,
          noiseSuppression: settings.noiseReduction,
          autoGainControl: true
        }
      })

      return stream
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please allow microphone access to use transcription.')
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.')
        } else if (error.name === 'NotReadableError') {
          throw new Error('Microphone is being used by another application. Please close other applications and try again.')
        }
      }
      throw new Error('Failed to access microphone. Please check your audio settings.')
    }
  }, [audioConfig, settings])

  const getEphemeralKey = useCallback(async (): Promise<string> => {
    const response = await fetch('/api/realtime/ephemeral-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to get ephemeral key')
    }

    const data = await response.json()
    return data.client_secret.value
  }, [])

  const setupWebSocket = useCallback((ephemeralKey: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      // Use OpenAI's WebSocket endpoint for Realtime API
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        [],
        {
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        } as any
      )

      ws.onopen = () => {
        console.log('WebSocket connected')
        
        // Send session configuration
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful assistant. Please transcribe the user\'s speech accurately and respond naturally.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200
            }
          }
        }
        
        ws.send(JSON.stringify(sessionConfig))
        
        setSessionStatus('connected')
        setLoading(false)
        setIsConnecting(false)
        options.onConnectionChange?.(true)
        resolve(ws)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleRealtimeMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        reject(new Error('WebSocket connection failed'))
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        setSessionStatus('disconnected')
        options.onConnectionChange?.(false)
      }
    })
  }, [setSessionStatus, setLoading, options, handleError])

  const setupAudioProcessing = useCallback((mediaStream: MediaStream, ws: WebSocket): { audioContext: AudioContext, processor: ScriptProcessorNode } => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: audioConfig.sampleRate
    })

    const source = audioContext.createMediaStreamSource(mediaStream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convert float32 to int16
        const int16Array = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }

        // Send audio data to OpenAI
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: btoa(String.fromCharCode(...new Uint8Array(int16Array.buffer)))
        }
        
        ws.send(JSON.stringify(audioMessage))
      }
    }

    source.connect(processor)
    processor.connect(audioContext.destination)

    return { audioContext, processor }
  }, [audioConfig])

  const handleRealtimeMessage = useCallback((message: any) => {
    console.log('Received message:', message.type)

    switch (message.type) {
      case 'session.created':
        console.log('Session created:', message.session.id)
        break

      case 'input_audio_buffer.speech_started':
        console.log('Speech started')
        setCurrentTranscription('Listening...')
        break

      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped')
        setCurrentTranscription('Processing...')
        break

      case 'conversation.item.input_audio_transcription.completed':
        const transcript = message.transcript
        if (transcript) {
          setFinalTranscription(transcript)
          
          // Add to transcript items
          const transcriptItem: TranscriptItem = {
            id: `transcript-${Date.now()}`,
            type: 'MESSAGE',
            role: 'user',
            content: transcript,
            createdAtMs: Date.now()
          }
          
          addTranscriptItem(transcriptItem)
          options.onTranscriptionUpdate?.(transcript, true)
          
          toast({
            title: 'Transcription complete',
            description: transcript.slice(0, 50) + (transcript.length > 50 ? '...' : ''),
            status: 'success'
          })
        }
        break

      case 'conversation.item.input_audio_transcription.failed':
        console.error('Transcription failed:', message.error)
        setError('Transcription failed. Please try again.')
        break

      case 'error':
        console.error('Server error:', message.error)
        handleError(new Error(message.error.message || 'Server error'))
        break

      default:
        // Handle other message types as needed
        console.log('Unhandled message type:', message.type)
        break
    }
  }, [
    setCurrentTranscription, 
    setFinalTranscription, 
    addTranscriptItem, 
    setError, 
    handleError, 
    options
  ])

  const connect = useCallback(async () => {
    if (isConnecting || connection.ws) {
      return
    }

    try {
      setIsConnecting(true)
      setLoading(true)
      setSessionStatus('connecting')
      setError(null)

      // Request microphone permission
      const mediaStream = await requestMicrophonePermission()

      // Get ephemeral key
      const ephemeralKey = await getEphemeralKey()
      ephemeralKeyRef.current = ephemeralKey

      // Setup WebSocket connection
      const ws = await setupWebSocket(ephemeralKey)

      // Setup audio processing
      const { audioContext, processor } = setupAudioProcessing(mediaStream, ws)

      // Update connection state
      setConnection({
        ws,
        audioContext,
        mediaStream,
        processor
      })

      toast({
        title: 'Connected to transcription service',
        description: 'Start speaking to see your transcription',
        status: 'success'
      })

    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Connection failed'))
    }
  }, [
    isConnecting,
    connection,
    setLoading,
    setSessionStatus,
    setError,
    requestMicrophonePermission,
    getEphemeralKey,
    setupWebSocket,
    setupAudioProcessing,
    handleError
  ])

  const disconnect = useCallback(() => {
    setSessionStatus('disconnected')
    setLoading(false)
    setIsConnecting(false)
    setCurrentTranscription('')
    cleanup()
    
    toast({
      title: 'Transcription stopped',
      status: 'info'
    })
  }, [setSessionStatus, setLoading, setCurrentTranscription, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    connect,
    disconnect,
    isConnecting,
    isConnected: connection.ws?.readyState === WebSocket.OPEN,
    error: useTranscriptionStore(state => state.error),
    sessionStatus: useTranscriptionStore(state => state.sessionStatus)
  }
}