import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import type { TranscriptItem } from '@/lib/types/transcription'

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

describe('TranscriptionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useTranscriptionStore())
    act(() => {
      result.current.reset()
    })
  })

  describe('Session Management', () => {
    it('should start transcription and set status to connecting', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.startTranscription()
      })

      expect(result.current.isTranscribing).toBe(true)
      expect(result.current.sessionStatus).toBe('connecting')
      expect(result.current.error).toBe(null)
      expect(result.current.currentSession).toBeDefined()
      expect(result.current.currentSession?.status).toBe('connecting')
    })

    it('should stop transcription and update session duration', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.startTranscription()
      })

      const startTime = result.current.currentSession?.startTime

      act(() => {
        result.current.stopTranscription()
      })

      expect(result.current.isTranscribing).toBe(false)
      expect(result.current.sessionStatus).toBe('disconnected')
      expect(result.current.currentTranscription).toBe('')
      expect(result.current.currentSession?.endTime).toBeDefined()
      expect(result.current.currentSession?.totalDuration).toBeGreaterThan(0)
    })

    it('should pause and resume transcription', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.startTranscription()
      })

      act(() => {
        result.current.pauseTranscription()
      })

      expect(result.current.isTranscribing).toBe(false)
      expect(result.current.sessionStatus).toBe('disconnected')

      act(() => {
        result.current.resumeTranscription()
      })

      expect(result.current.isTranscribing).toBe(true)
      expect(result.current.sessionStatus).toBe('connecting')
    })
  })

  describe('Panel Management', () => {
    it('should toggle panel open state', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      expect(result.current.isPanelOpen).toBe(false)

      act(() => {
        result.current.togglePanel()
      })

      expect(result.current.isPanelOpen).toBe(true)

      act(() => {
        result.current.togglePanel()
      })

      expect(result.current.isPanelOpen).toBe(false)
    })

    it('should open and close panel explicitly', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.openPanel()
      })

      expect(result.current.isPanelOpen).toBe(true)

      act(() => {
        result.current.closePanel()
      })

      expect(result.current.isPanelOpen).toBe(false)
    })
  })

  describe('Transcript Management', () => {
    it('should add transcript items', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      const item: TranscriptItem = {
        id: 'test-1',
        type: 'MESSAGE',
        role: 'user',
        content: 'Test message',
        createdAtMs: Date.now(),
      }

      act(() => {
        result.current.addTranscriptItem(item)
      })

      expect(result.current.transcriptItems).toHaveLength(1)
      expect(result.current.transcriptItems[0]).toEqual(item)
    })

    it('should update transcript items', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      const item: TranscriptItem = {
        id: 'test-1',
        type: 'MESSAGE',
        role: 'user',
        content: 'Original message',
        createdAtMs: Date.now(),
      }

      act(() => {
        result.current.addTranscriptItem(item)
      })

      act(() => {
        result.current.updateTranscriptItem('test-1', {
          content: 'Updated message',
        })
      })

      expect(result.current.transcriptItems[0].content).toBe('Updated message')
    })

    it('should remove transcript items', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      const item1: TranscriptItem = {
        id: 'test-1',
        type: 'MESSAGE',
        role: 'user',
        content: 'Message 1',
        createdAtMs: Date.now(),
      }

      const item2: TranscriptItem = {
        id: 'test-2',
        type: 'MESSAGE',
        role: 'assistant',
        content: 'Message 2',
        createdAtMs: Date.now(),
      }

      act(() => {
        result.current.addTranscriptItem(item1)
        result.current.addTranscriptItem(item2)
      })

      act(() => {
        result.current.removeTranscriptItem('test-1')
      })

      expect(result.current.transcriptItems).toHaveLength(1)
      expect(result.current.transcriptItems[0].id).toBe('test-2')
    })

    it('should clear all transcripts', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.addTranscriptItem({
          id: 'test-1',
          type: 'MESSAGE',
          role: 'user',
          content: 'Message',
          createdAtMs: Date.now(),
        })
        result.current.setCurrentTranscription('Current')
        result.current.setFinalTranscription('Final')
      })

      act(() => {
        result.current.clearTranscript()
      })

      expect(result.current.transcriptItems).toHaveLength(0)
      expect(result.current.currentTranscription).toBe('')
      expect(result.current.finalTranscription).toBe('')
    })
  })

  describe('Text Updates', () => {
    it('should set current transcription', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.setCurrentTranscription('Hello world')
      })

      expect(result.current.currentTranscription).toBe('Hello world')
    })

    it('should set final transcription and clear current', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.setCurrentTranscription('Partial')
        result.current.setFinalTranscription('Complete transcription')
      })

      expect(result.current.finalTranscription).toBe('Complete transcription')
      expect(result.current.currentTranscription).toBe('')
    })

    it('should append to transcription', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.setCurrentTranscription('Hello')
        result.current.appendToTranscription(' world')
      })

      expect(result.current.currentTranscription).toBe('Hello world')
    })
  })

  describe('Settings and Configuration', () => {
    it('should update settings', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.updateSettings({
          autoSend: true,
          showTimestamps: false,
        })
      })

      expect(result.current.settings.autoSend).toBe(true)
      expect(result.current.settings.showTimestamps).toBe(false)
    })

    it('should update audio configuration', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.updateAudioConfig({
          sampleRate: 48000,
          codec: 'pcmu',
        })
      })

      expect(result.current.audioConfig.sampleRate).toBe(48000)
      expect(result.current.audioConfig.codec).toBe('pcmu')
    })
  })

  describe('Error Handling', () => {
    it('should set error and update session status', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.setError('Connection failed')
      })

      expect(result.current.error).toBe('Connection failed')
      expect(result.current.sessionStatus).toBe('error')
      expect(result.current.isLoading).toBe(false)
    })

    it('should clear error when connection succeeds', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.setError('Previous error')
        result.current.setSessionStatus('connected')
      })

      expect(result.current.error).toBe(null)
      expect(result.current.sessionStatus).toBe('connected')
    })
  })

  describe('Export Functionality', () => {
    it('should export transcript as formatted text', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      const now = Date.now()

      act(() => {
        result.current.addTranscriptItem({
          id: 'test-1',
          type: 'MESSAGE',
          role: 'user',
          content: 'Hello',
          createdAtMs: now,
        })
        result.current.addTranscriptItem({
          id: 'test-2',
          type: 'MESSAGE',
          role: 'assistant',
          content: 'Hi there',
          createdAtMs: now + 1000,
        })
        result.current.addTranscriptItem({
          id: 'test-3',
          type: 'BREADCRUMB',
          content: 'System event',
          createdAtMs: now + 2000,
        })
      })

      const exported = act(() => result.current.exportTranscript())

      expect(exported).toContain('You: Hello')
      expect(exported).toContain('Assistant: Hi there')
      expect(exported).not.toContain('System event') // Breadcrumbs are filtered out
    })

    it('should include timestamps when enabled', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      act(() => {
        result.current.updateSettings({ showTimestamps: true })
        result.current.addTranscriptItem({
          id: 'test-1',
          type: 'MESSAGE',
          role: 'user',
          content: 'Test',
          createdAtMs: Date.now(),
        })
      })

      const exported = act(() => result.current.exportTranscript())

      expect(exported).toMatch(/\[\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?\]/)
    })
  })

  describe('Selectors', () => {
    it('should correctly determine if there is content', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      const hasContent1 = result.current.transcriptItems.length > 0 || 
                         result.current.currentTranscription.length > 0

      expect(hasContent1).toBe(false)

      act(() => {
        result.current.setCurrentTranscription('Some text')
      })

      const hasContent2 = result.current.transcriptItems.length > 0 || 
                         result.current.currentTranscription.length > 0

      expect(hasContent2).toBe(true)
    })

    it('should correctly determine connection status', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      expect(result.current.sessionStatus === 'connected').toBe(false)

      act(() => {
        result.current.setSessionStatus('connected')
      })

      expect(result.current.sessionStatus === 'connected').toBe(true)
    })

    it('should correctly determine if can transcribe', () => {
      const { result } = renderHook(() => useTranscriptionStore())

      // Can transcribe when not transcribing and not connecting
      expect(!result.current.isTranscribing && result.current.sessionStatus !== 'connecting').toBe(true)

      act(() => {
        result.current.startTranscription()
      })

      // Cannot transcribe when already transcribing
      expect(!result.current.isTranscribing && result.current.sessionStatus !== 'connecting').toBe(false)
    })
  })
})