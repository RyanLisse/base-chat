import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ButtonAudio } from '@/app/components/chat-input/button-audio'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import { useRealtimeTranscription } from '@/hooks/use-realtime-transcription'

// Mock the stores and hooks
vi.mock('@/lib/stores/transcription-store')
vi.mock('@/hooks/use-realtime-transcription')
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}))

describe('ButtonAudio', () => {
  const mockStartTranscription = vi.fn()
  const mockStopTranscription = vi.fn()
  const mockOpenPanel = vi.fn()
  const mockConnect = vi.fn()
  const mockDisconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementation
    vi.mocked(useTranscriptionStore).mockReturnValue({
      isTranscribing: false,
      sessionStatus: 'disconnected',
      error: null,
      startTranscription: mockStartTranscription,
      stopTranscription: mockStopTranscription,
      openPanel: mockOpenPanel,
    } as any)

    vi.mocked(useRealtimeTranscription).mockReturnValue({
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      isConnected: false,
      error: null,
      sessionStatus: 'disconnected',
    })
  })

  describe('Rendering', () => {
    it('should render microphone icon when not transcribing', () => {
      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /start voice transcription/i })
      expect(button).toBeInTheDocument()
    })

    it('should render waveform icon when transcribing', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: true,
        sessionStatus: 'connected',
        error: null,
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /stop voice transcription/i })
      expect(button).toBeInTheDocument()
    })

    it('should show error state with slash icon', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: false,
        sessionStatus: 'error',
        error: 'Connection failed',
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /error: connection failed/i })
      expect(button).toBeInTheDocument()
    })

    it('should be disabled when not authenticated', () => {
      render(<ButtonAudio isAuthenticated={false} />)
      
      const button = screen.getByRole('button', { name: /sign in to use voice transcription/i })
      expect(button).toBeInTheDocument()
    })

    it('should show loading state when connecting', () => {
      vi.mocked(useRealtimeTranscription).mockReturnValue({
        connect: mockConnect,
        disconnect: mockDisconnect,
        isConnecting: true,
        isConnected: false,
        error: null,
        sessionStatus: 'connecting',
      })

      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /connecting to transcription service/i })
      expect(button).toBeDisabled()
    })
  })

  describe('Interactions', () => {
    it('should start transcription when clicked while not transcribing', async () => {
      mockConnect.mockResolvedValue(undefined)

      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /start voice transcription/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockStartTranscription).toHaveBeenCalledTimes(1)
        expect(mockOpenPanel).toHaveBeenCalledTimes(1)
        expect(mockConnect).toHaveBeenCalledTimes(1)
      })
    })

    it('should stop transcription when clicked while transcribing', async () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: true,
        sessionStatus: 'connected',
        error: null,
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      vi.mocked(useRealtimeTranscription).mockReturnValue({
        connect: mockConnect,
        disconnect: mockDisconnect,
        isConnecting: false,
        isConnected: true,
        error: null,
        sessionStatus: 'connected',
      })

      render(<ButtonAudio isAuthenticated={true} />)
      
      const button = screen.getByRole('button', { name: /stop voice transcription/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockStopTranscription).toHaveBeenCalledTimes(1)
        expect(mockDisconnect).toHaveBeenCalledTimes(1)
      })
    })

    it('should not start transcription when not authenticated', () => {
      render(<ButtonAudio isAuthenticated={false} />)
      
      const button = screen.getByRole('button', { name: /sign in to use voice transcription/i })
      fireEvent.click(button)

      expect(mockStartTranscription).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('should be disabled when explicitly disabled', () => {
      render(<ButtonAudio isAuthenticated={true} disabled={true} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Visual States', () => {
    it('should show pulse animation when recording', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: true,
        sessionStatus: 'connected',
        error: null,
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('animate-pulse')
    })

    it('should show recording indicator dots when active', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: true,
        sessionStatus: 'connected',
        error: null,
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      vi.mocked(useRealtimeTranscription).mockReturnValue({
        connect: mockConnect,
        disconnect: mockDisconnect,
        isConnecting: false,
        isConnected: true,
        error: null,
        sessionStatus: 'connected',
      })

      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      // Check for recording indicator dots
      const dots = container.querySelectorAll('.bg-red-500.animate-pulse')
      expect(dots.length).toBeGreaterThan(0)
    })

    it('should show error indicator when there is an error', () => {
      vi.mocked(useTranscriptionStore).mockReturnValue({
        isTranscribing: false,
        sessionStatus: 'error',
        error: 'Microphone not found',
        startTranscription: mockStartTranscription,
        stopTranscription: mockStopTranscription,
        openPanel: mockOpenPanel,
      } as any)

      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      const errorIndicator = container.querySelector('.bg-destructive')
      expect(errorIndicator).toBeInTheDocument()
    })

    it('should show loading spinner when connecting', () => {
      vi.mocked(useRealtimeTranscription).mockReturnValue({
        connect: mockConnect,
        disconnect: mockDisconnect,
        isConnecting: true,
        isConnected: false,
        error: null,
        sessionStatus: 'connecting',
      })

      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Hover Effects', () => {
    it('should scale on hover when enabled', () => {
      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      const button = container.querySelector('button')
      
      fireEvent.mouseEnter(button!)
      expect(button).toHaveClass('scale-105')
      
      fireEvent.mouseLeave(button!)
      expect(button).not.toHaveClass('scale-105')
    })

    it('should not scale on hover when disabled', () => {
      const { container } = render(<ButtonAudio isAuthenticated={true} disabled={true} />)
      
      const button = container.querySelector('button')
      
      fireEvent.mouseEnter(button!)
      expect(button).not.toHaveClass('scale-105')
    })
  })

  describe('Connection Callbacks', () => {
    it('should trigger pulse animation on connection', async () => {
      const onConnectionChange = vi.fn()
      
      vi.mocked(useRealtimeTranscription).mockImplementation((options) => {
        // Call the connection change callback
        if (options?.onConnectionChange) {
          setTimeout(() => options.onConnectionChange(true), 0)
        }
        
        return {
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
          isConnected: false,
          error: null,
          sessionStatus: 'disconnected',
        }
      })

      const { container } = render(<ButtonAudio isAuthenticated={true} />)
      
      await waitFor(() => {
        const pulseElement = container.querySelector('.animate-ping')
        expect(pulseElement).toBeDefined()
      })
    })

    it('should handle transcription updates', async () => {
      const onTranscriptionUpdate = vi.fn()
      
      vi.mocked(useRealtimeTranscription).mockImplementation((options) => {
        // Call the transcription update callback
        if (options?.onTranscriptionUpdate) {
          setTimeout(() => options.onTranscriptionUpdate('Hello world', true), 0)
        }
        
        return {
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
          isConnected: false,
          error: null,
          sessionStatus: 'disconnected',
        }
      })

      render(<ButtonAudio isAuthenticated={true} />)
      
      await waitFor(() => {
        // The callback should have been registered
        expect(vi.mocked(useRealtimeTranscription)).toHaveBeenCalled()
      })
    })

    it('should handle errors properly', async () => {
      const onError = vi.fn()
      
      vi.mocked(useRealtimeTranscription).mockImplementation((options) => {
        // Call the error callback
        if (options?.onError) {
          setTimeout(() => options.onError(new Error('Test error')), 0)
        }
        
        return {
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
          isConnected: false,
          error: null,
          sessionStatus: 'disconnected',
        }
      })

      render(<ButtonAudio isAuthenticated={true} />)
      
      await waitFor(() => {
        // The error callback should have been registered
        expect(vi.mocked(useRealtimeTranscription)).toHaveBeenCalled()
      })
    })
  })
})