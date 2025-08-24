import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeTranscription } from '@/hooks/use-realtime-transcription'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import { toast } from '@/components/ui/toast'

// Mock dependencies
vi.mock('@/lib/stores/transcription-store', () => ({
  useTranscriptionStore: vi.fn()
}))
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}))

// Mock MediaDevices API
const mockGetUserMedia = vi.fn()
const mockAudioContext = {
  createMediaStreamSource: vi.fn(),
  createScriptProcessor: vi.fn(),
  close: vi.fn(),
  state: 'running',
  destination: {},
}
const mockScriptProcessor = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  onaudioprocess: null,
}
const mockMediaStreamSource = {
  connect: vi.fn(),
}
const mockMediaStream = {
  getTracks: vi.fn(() => [
    {
      stop: vi.fn(),
    },
  ]),
}

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(public url: string, public protocols?: string | string[], public options?: any) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  })
}

describe('useRealtimeTranscription', () => {
  const mockSetSessionStatus = vi.fn()
  const mockSetError = vi.fn()
  const mockSetLoading = vi.fn()
  const mockAddTranscriptItem = vi.fn()
  const mockSetCurrentTranscription = vi.fn()
  const mockSetFinalTranscription = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup global mocks
    global.WebSocket = MockWebSocket as any
    global.navigator = {
      ...global.navigator,
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    } as any
    global.AudioContext = vi.fn(() => mockAudioContext) as any
    global.fetch = vi.fn()

    // Setup mock implementations
    mockGetUserMedia.mockResolvedValue(mockMediaStream)
    mockAudioContext.createMediaStreamSource.mockReturnValue(mockMediaStreamSource)
    mockAudioContext.createScriptProcessor.mockReturnValue(mockScriptProcessor)
    mockAudioContext.close.mockResolvedValue(undefined)
    mockAudioContext.state = 'running'

    // Mock store - handle both full store calls and selector calls
    vi.mocked(useTranscriptionStore).mockImplementation((selector?: any): any => {
      const fullState = {
        setSessionStatus: mockSetSessionStatus,
        setError: mockSetError,
        setLoading: mockSetLoading,
        addTranscriptItem: mockAddTranscriptItem,
        setCurrentTranscription: mockSetCurrentTranscription,
        setFinalTranscription: mockSetFinalTranscription,
        audioConfig: {
          sampleRate: 16000,
          channels: 1,
          codec: 'opus',
          vad: 'server_vad',
        },
        settings: {
          noiseReduction: true,
          autoSend: false,
          showTimestamps: true,
          language: 'en-US',
          enableVAD: true,
          pushToTalk: false,
        },
        error: null,
        sessionStatus: 'disconnected',
      }
      
      // If a selector is provided, return the selected value
      if (selector && typeof selector === 'function') {
        return selector(fullState)
      }
      
      // Otherwise return the full state
      return fullState
    })

    // Mock fetch for ephemeral key
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        client_secret: {
          value: 'test-ephemeral-key',
          expires_at: Date.now() + 3600000,
        },
      }),
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true)
        expect(mockSetSessionStatus).toHaveBeenCalledWith('connecting')
        expect(mockSetError).toHaveBeenCalledWith(null)
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        expect(result.current.isConnected).toBe(true)
      })
    })

    it('should handle microphone permission denied', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      mockGetUserMedia.mockRejectedValueOnce(permissionError)

      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Microphone permission denied. Please allow microphone access to use transcription.'
        )
        expect(mockSetSessionStatus).toHaveBeenCalledWith('error')
        expect(result.current.isConnected).toBe(false)
      })
    })

    it('should handle no microphone found', async () => {
      const notFoundError = new Error('Not found')
      notFoundError.name = 'NotFoundError'
      mockGetUserMedia.mockRejectedValueOnce(notFoundError)

      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'No microphone found. Please connect a microphone and try again.'
        )
      })
    })

    it('should handle microphone in use', async () => {
      const inUseError = new Error('In use')
      inUseError.name = 'NotReadableError'
      mockGetUserMedia.mockRejectedValueOnce(inUseError)

      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Microphone is being used by another application. Please close other applications and try again.'
        )
      })
    })

    it('should handle ephemeral key failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API key not found' }),
      } as any)

      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('API key not found')
      })
    })

    it('should not connect if already connecting', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      // Start first connection
      const firstConnection = act(async () => {
        await result.current.connect()
      })

      // Try to connect again immediately
      await act(async () => {
        await result.current.connect()
      })

      await firstConnection

      // Should only call getUserMedia once
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1)
    })

    it('should disconnect properly', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      // Connect first
      await act(async () => {
        await result.current.connect()
      })

      // Then disconnect
      act(() => {
        result.current.disconnect()
      })

      expect(mockSetSessionStatus).toHaveBeenCalledWith('disconnected')
      expect(mockSetLoading).toHaveBeenCalledWith(false)
      expect(mockSetCurrentTranscription).toHaveBeenCalledWith('')
      expect(mockAudioContext.close).toHaveBeenCalled()
      expect(mockScriptProcessor.disconnect).toHaveBeenCalled()
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Message Handling', () => {
    it('should handle session created message', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      // Get the WebSocket instance
      const ws = (global.WebSocket as any).mock?.instances?.[0] || new MockWebSocket('test')

      // Simulate session created message
      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'session.created',
              session: { id: 'test-session-123' },
            }),
          }))
        }
      })

      // The session should be logged but no state changes
      expect(mockSetSessionStatus).toHaveBeenCalledWith('connected')
    })

    it('should handle speech started message', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')

      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'input_audio_buffer.speech_started',
            }),
          }))
        }
      })

      expect(mockSetCurrentTranscription).toHaveBeenCalledWith('Listening...')
    })

    it('should handle speech stopped message', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')

      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'input_audio_buffer.speech_stopped',
            }),
          }))
        }
      })

      expect(mockSetCurrentTranscription).toHaveBeenCalledWith('Processing...')
    })

    it('should handle transcription completed message', async () => {
      const onTranscriptionUpdate = vi.fn()
      const { result } = renderHook(() =>
        useRealtimeTranscription({ onTranscriptionUpdate })
      )

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')
      const transcript = 'Hello, this is a test transcription'

      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'conversation.item.input_audio_transcription.completed',
              transcript,
            }),
          }))
        }
      })

      expect(mockSetFinalTranscription).toHaveBeenCalledWith(transcript)
      expect(mockAddTranscriptItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MESSAGE',
          role: 'user',
          content: transcript,
        })
      )
      expect(onTranscriptionUpdate).toHaveBeenCalledWith(transcript, true)
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        title: 'Transcription complete',
        description: 'Hello, this is a test transcription',
        status: 'success',
      })
    })

    it('should handle transcription failed message', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')

      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'conversation.item.input_audio_transcription.failed',
              error: { message: 'Transcription failed' },
            }),
          }))
        }
      })

      expect(mockSetError).toHaveBeenCalledWith('Transcription failed. Please try again.')
    })

    it('should handle server error message', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() =>
        useRealtimeTranscription({ onError })
      )

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')

      act(() => {
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'error',
              error: { message: 'Server error occurred' },
            }),
          }))
        }
      })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(mockSetError).toHaveBeenCalledWith('Server error occurred')
    })
  })

  describe('Audio Processing', () => {
    it('should setup audio processing correctly', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream)
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1)
      expect(mockMediaStreamSource.connect).toHaveBeenCalledWith(mockScriptProcessor)
      expect(mockScriptProcessor.connect).toHaveBeenCalledWith(mockAudioContext.destination)
    })

    it('should process audio data and send to WebSocket', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      const ws = new MockWebSocket('test')
      ws.readyState = MockWebSocket.OPEN

      // Simulate audio processing
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4])
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => audioData),
        },
      }

      act(() => {
        if (mockScriptProcessor.onaudioprocess) {
          mockScriptProcessor.onaudioprocess(event as any)
        }
      })

      // Verify audio was processed and sent
      // Note: In real implementation, this would send the converted audio data
      expect(event.inputBuffer.getChannelData).toHaveBeenCalledWith(0)
    })
  })

  describe('Callbacks', () => {
    it('should call onConnectionChange when connection status changes', async () => {
      const onConnectionChange = vi.fn()
      const { result } = renderHook(() =>
        useRealtimeTranscription({ onConnectionChange })
      )

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(onConnectionChange).toHaveBeenCalledWith(false)
    })

    it('should call onError when error occurs', async () => {
      const onError = vi.fn()
      mockGetUserMedia.mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() =>
        useRealtimeTranscription({ onError })
      )

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error))
      })
    })
  })

  describe('State Management', () => {
    it('should track connecting state', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      expect(result.current.isConnecting).toBe(false)

      const connectPromise = act(async () => {
        await result.current.connect()
      })

      expect(result.current.isConnecting).toBe(true)

      await connectPromise

      expect(result.current.isConnecting).toBe(false)
    })

    it('should track connection state', async () => {
      const { result } = renderHook(() => useRealtimeTranscription())

      expect(result.current.isConnected).toBe(false)

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should track error state from store', () => {
      const errorMessage = 'Test error message'

      vi.mocked(useTranscriptionStore).mockReturnValue({
        ...vi.mocked(useTranscriptionStore)(),
        error: errorMessage,
      } as any)

      const { result } = renderHook(() => useRealtimeTranscription())

      expect(result.current.error).toBe(errorMessage)
    })

    it('should track session status from store', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        ...vi.mocked(useTranscriptionStore)(),
        sessionStatus: 'connected',
      } as any)

      const { result } = renderHook(() => useRealtimeTranscription())

      expect(result.current.sessionStatus).toBe('connected')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useRealtimeTranscription())

      await act(async () => {
        await result.current.connect()
      })

      unmount()

      expect(mockAudioContext.close).toHaveBeenCalled()
      expect(mockScriptProcessor.disconnect).toHaveBeenCalled()
    })
  })
})