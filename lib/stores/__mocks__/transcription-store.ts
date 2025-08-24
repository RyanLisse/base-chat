import { vi } from 'vitest'

export const useTranscriptionStore = vi.fn(() => ({
  // Session state
  isTranscribing: false,
  isPanelOpen: false,
  sessionStatus: 'disconnected',
  currentSession: null,
  
  // Transcript data
  transcriptItems: [],
  currentTranscription: '',
  finalTranscription: '',
  
  // Audio/WebRTC state
  audioConfig: {
    sampleRate: 16000,
    channels: 1,
    codec: 'opus',
    vad: 'server_vad',
  },
  connectionState: {
    iceConnectionState: 'new',
    iceGatheringState: 'new',
    signalingState: 'stable',
  },
  
  // UI settings
  settings: {
    noiseReduction: true,
    autoSend: false,
    showTimestamps: true,
    language: 'en-US',
    enableVAD: true,
    pushToTalk: false,
  },
  
  // Error handling
  error: null,
  isLoading: false,
  
  // Actions (all mocked functions)
  startTranscription: vi.fn(),
  stopTranscription: vi.fn(),
  pauseTranscription: vi.fn(),
  resumeTranscription: vi.fn(),
  togglePanel: vi.fn(),
  openPanel: vi.fn(),
  closePanel: vi.fn(),
  addTranscriptItem: vi.fn(),
  updateTranscriptItem: vi.fn(),
  removeTranscriptItem: vi.fn(),
  clearTranscript: vi.fn(),
  setCurrentTranscription: vi.fn(),
  setFinalTranscription: vi.fn(),
  setSessionStatus: vi.fn(),
  updateConnectionState: vi.fn(),
  setAudioConfig: vi.fn(),
  updateSettings: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  setLoading: vi.fn(),
  exportTranscript: vi.fn(),
  importTranscript: vi.fn(),
  searchTranscript: vi.fn(),
  reset: vi.fn(),
}))