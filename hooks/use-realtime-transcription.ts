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
  audioWorkletNode: AudioWorkletNode | null
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
    audioWorkletNode: null
  })

  const connectionRef = useRef<RealtimeConnection>(connection)
  const [isConnecting, setIsConnecting] = useState(false)
  const ephemeralKeyRef = useRef<string | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  // Update ref when connection changes
  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  const cleanup = useCallback(() => {
    const conn = connectionRef.current

    // Clear any pending reconnection
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }

    // Close WebSocket
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close()
    }

    // Stop audio processing
    if (conn.audioWorkletNode) {
      conn.audioWorkletNode.disconnect()
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
      audioWorkletNode: null
    })
    
    reconnectAttempts.current = 0
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
      // Use OpenAI's WebSocket endpoint for Realtime API with proper authentication
      const url = new URL('wss://api.openai.com/v1/realtime')
      url.searchParams.set('model', 'gpt-4o-realtime-preview-2024-10-01')
      
      // Create WebSocket without headers (not supported in browser)
      const ws = new WebSocket(url.toString())
      
      // Send authentication after connection opens
      let authSent = false

      ws.onopen = () => {
        console.log('WebSocket connected')
        
        // Send authentication message first
        if (!authSent) {
          const authMessage = {
            type: 'session.auth',
            token: ephemeralKey
          }
          ws.send(JSON.stringify(authMessage))
          authSent = true
        }
        
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
        
        // Attempt to reconnect if the connection was lost unexpectedly
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = Math.pow(2, reconnectAttempts.current - 1) * 1000 // Exponential backoff
          
          console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`)
          
          reconnectTimeout.current = setTimeout(() => {
            if (ephemeralKeyRef.current) {
              setupWebSocket(ephemeralKeyRef.current)
                .then(newWs => {
                  setConnection(prev => ({ ...prev, ws: newWs }))
                  reconnectAttempts.current = 0 // Reset on successful reconnection
                })
                .catch(err => {
                  console.error('Reconnection failed:', err)
                  if (reconnectAttempts.current >= maxReconnectAttempts) {
                    handleError(new Error('Max reconnection attempts reached'))
                  }
                })
            }
          }, delay)
        }
      }
    })
  }, [setSessionStatus, setLoading, options, handleError])

  const setupAudioProcessing = useCallback(async (mediaStream: MediaStream, ws: WebSocket): Promise<{ audioContext: AudioContext, audioWorkletNode: AudioWorkletNode }> => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: audioConfig.sampleRate
    })

    // Load the audio worklet module
    try {
      await audioContext.audioWorklet.addModule('/audio-processor-worklet.js')
    } catch (error) {
      console.error('Failed to load audio worklet:', error)
      throw new Error('Failed to initialize audio processing')
    }

    const source = audioContext.createMediaStreamSource(mediaStream)
    const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor')

    // Handle messages from the audio worklet
    audioWorkletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData' && ws.readyState === WebSocket.OPEN) {
        const int16Array = event.data.data

        // Send audio data to OpenAI
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: btoa(String.fromCharCode(...new Uint8Array(int16Array.buffer)))
        }
        
        ws.send(JSON.stringify(audioMessage))
      }
    }

    source.connect(audioWorkletNode)
    audioWorkletNode.connect(audioContext.destination)

    return { audioContext, audioWorkletNode }
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
      const { audioContext, audioWorkletNode } = await setupAudioProcessing(mediaStream, ws)

      // Update connection state
      setConnection({
        ws,
        audioContext,
        mediaStream,
        audioWorkletNode
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