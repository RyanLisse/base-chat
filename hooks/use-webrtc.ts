'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import { toast } from '@/components/ui/toast'
import type { TranscriptItem, WebRTCConnectionState } from '@/lib/types/transcription'

interface UseWebRTCOptions {
  onTranscriptionUpdate?: (text: string, isFinal: boolean) => void
  onError?: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
}

interface WebRTCConnection {
  peerConnection: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  audioStream: MediaStream | null
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const {
    setSessionStatus,
    setConnectionState,
    setError,
    setLoading,
    addTranscriptItem,
    setCurrentTranscription,
    setFinalTranscription,
    audioConfig,
    settings
  } = useTranscriptionStore()

  const [connection, setConnection] = useState<WebRTCConnection>({
    peerConnection: null,
    dataChannel: null,
    audioStream: null
  })

  const connectionRef = useRef<WebRTCConnection>(connection)
  const [isConnecting, setIsConnecting] = useState(false)

  // Update ref when connection changes
  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  const cleanup = useCallback(() => {
    const conn = connectionRef.current

    // Close data channel
    if (conn.dataChannel) {
      conn.dataChannel.close()
    }

    // Close peer connection
    if (conn.peerConnection) {
      conn.peerConnection.close()
    }

    // Stop audio stream
    if (conn.audioStream) {
      conn.audioStream.getTracks().forEach(track => track.stop())
    }

    setConnection({
      peerConnection: null,
      dataChannel: null,
      audioStream: null
    })

    setConnectionState({
      pc: null,
      dc: null,
      isConnected: false,
      error: null
    })
  }, [setConnectionState])

  const handleError = useCallback((error: Error) => {
    console.error('WebRTC Error:', error)
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
      throw new Error('Failed to get ephemeral key')
    }

    const data = await response.json()
    return data.client_secret.value
  }, [])

  const setupPeerConnection = useCallback(async (ephemeralKey: string): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
      
      if (pc.connectionState === 'connected') {
        setSessionStatus('connected')
        setLoading(false)
        setIsConnecting(false)
        options.onConnectionChange?.(true)
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setSessionStatus('disconnected')
        options.onConnectionChange?.(false)
        if (pc.connectionState === 'failed') {
          handleError(new Error('WebRTC connection failed'))
        }
      }
    }

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState)
    }

    return pc
  }, [setSessionStatus, setLoading, options, handleError])

  const setupDataChannel = useCallback((pc: RTCPeerConnection): RTCDataChannel => {
    const dc = pc.createDataChannel('oai-events', {
      ordered: true,
    })

    dc.onopen = () => {
      console.log('Data channel opened')
      
      // Send session configuration
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are a helpful assistant. Transcribe the user\'s speech accurately.',
          voice: 'alloy',
          input_audio_format: audioConfig.codec,
          output_audio_format: audioConfig.codec,
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: audioConfig.vad,
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200
          },
          tools: [],
          tool_choice: 'auto',
          temperature: 0.6,
        }
      }
      
      dc.send(JSON.stringify(sessionUpdate))
    }

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleRealtimeMessage(message)
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    dc.onerror = (error) => {
      console.error('Data channel error:', error)
      handleError(new Error('Data channel error'))
    }

    dc.onclose = () => {
      console.log('Data channel closed')
    }

    return dc
  }, [audioConfig, handleError])

  const handleRealtimeMessage = useCallback((message: any) => {
    console.log('Received message:', message.type)

    switch (message.type) {
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
        }
        break

      case 'conversation.item.input_audio_transcription.failed':
        console.error('Transcription failed:', message.error)
        setError('Transcription failed. Please try again.')
        break

      case 'input_audio_buffer.speech_started':
        console.log('Speech started')
        setCurrentTranscription('...')
        break

      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped')
        break

      case 'error':
        console.error('Server error:', message.error)
        handleError(new Error(message.error.message || 'Server error'))
        break

      default:
        // Handle other message types as needed
        break
    }
  }, [setCurrentTranscription, setFinalTranscription, addTranscriptItem, setError, handleError, options])

  const connect = useCallback(async () => {
    if (isConnecting || connection.peerConnection) {
      return
    }

    try {
      setIsConnecting(true)
      setLoading(true)
      setSessionStatus('connecting')
      setError(null)

      // Request microphone permission
      const stream = await requestMicrophonePermission()

      // Get ephemeral key
      const ephemeralKey = await getEphemeralKey()

      // Setup peer connection
      const pc = await setupPeerConnection(ephemeralKey)

      // Setup data channel
      const dc = setupDataChannel(pc)

      // Add audio stream
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // Create offer and set local description
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Send offer to server (you'll need to implement this endpoint)
      const response = await fetch('/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ephemeralKey}`,
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to connect to realtime service')
      }

      const { sdp, type } = await response.json()
      await pc.setRemoteDescription(new RTCSessionDescription({ sdp, type }))

      // Update connection state
      setConnection({
        peerConnection: pc,
        dataChannel: dc,
        audioStream: stream
      })

      setConnectionState({
        pc,
        dc,
        isConnected: false, // Will be updated when connection is established
        error: null
      })

      toast({
        title: 'Connecting to transcription service...',
        status: 'info'
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
    setupPeerConnection,
    setupDataChannel,
    setConnection,
    setConnectionState,
    handleError
  ])

  const disconnect = useCallback(() => {
    setSessionStatus('disconnected')
    setLoading(false)
    setIsConnecting(false)
    cleanup()
    
    toast({
      title: 'Transcription stopped',
      status: 'info'
    })
  }, [setSessionStatus, setLoading, cleanup])

  const sendAudioData = useCallback((audioData: ArrayBuffer) => {
    if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
      const message = {
        type: 'input_audio_buffer.append',
        audio: btoa(String.fromCharCode(...new Uint8Array(audioData)))
      }
      connection.dataChannel.send(JSON.stringify(message))
    }
  }, [connection.dataChannel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    connect,
    disconnect,
    sendAudioData,
    isConnecting,
    isConnected: connection.peerConnection?.connectionState === 'connected',
    error: useTranscriptionStore(state => state.error),
    sessionStatus: useTranscriptionStore(state => state.sessionStatus)
  }
}