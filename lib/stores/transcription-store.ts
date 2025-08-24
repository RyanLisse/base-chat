import { create } from 'zustand'
import { devtools, subscribeWithSelector, createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { get, set as idbSet, del } from 'idb-keyval'
import type { 
  TranscriptItem, 
  SessionStatus, 
  TranscriptionSession,
  AudioConfig,
  TranscriptionSettings,
  WebRTCConnectionState
} from '@/lib/types/transcription'

interface TranscriptionState {
  // Session state
  isTranscribing: boolean
  isPanelOpen: boolean
  sessionStatus: SessionStatus
  currentSession: TranscriptionSession | null
  
  // Transcript data
  transcriptItems: TranscriptItem[]
  currentTranscription: string
  finalTranscription: string
  
  // Audio/WebRTC state
  audioConfig: AudioConfig
  connectionState: WebRTCConnectionState
  
  // UI settings
  settings: TranscriptionSettings
  
  // Error handling
  error: string | null
  isLoading: boolean
}

interface TranscriptionActions {
  // Session management
  startTranscription: () => void
  stopTranscription: () => void
  pauseTranscription: () => void
  resumeTranscription: () => void
  
  // Panel management
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  
  // Transcript management
  addTranscriptItem: (item: TranscriptItem) => void
  updateTranscriptItem: (id: string, updates: Partial<TranscriptItem>) => void
  removeTranscriptItem: (id: string) => void
  clearTranscript: () => void
  
  // Text updates
  setCurrentTranscription: (text: string) => void
  setFinalTranscription: (text: string) => void
  appendToTranscription: (text: string) => void
  
  // Connection management
  setSessionStatus: (status: SessionStatus) => void
  setConnectionState: (state: Partial<WebRTCConnectionState>) => void
  
  // Settings
  updateSettings: (settings: Partial<TranscriptionSettings>) => void
  updateAudioConfig: (config: Partial<AudioConfig>) => void
  
  // Error handling
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  
  // Utility
  reset: () => void
  exportTranscript: () => string
}

type TranscriptionStore = TranscriptionState & TranscriptionActions

const initialState: TranscriptionState = {
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
    vad: 'server_vad'
  },
  connectionState: {
    pc: null,
    dc: null,
    isConnected: false,
    error: null
  },
  
  // UI settings
  settings: {
    autoSend: false,
    showTimestamps: true,
    language: 'en-US',
    enableVAD: true,
    pushToTalk: false,
    noiseReduction: true
  },
  
  // Error handling
  error: null,
  isLoading: false
}

export const useTranscriptionStore = create<TranscriptionStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          ...initialState,
          
          // Session management
          startTranscription: () =>
            set((state) => {
              state.isTranscribing = true
              state.sessionStatus = 'connecting'
              state.error = null
              state.currentSession = {
                id: `session-${Date.now()}`,
                status: 'connecting',
                startTime: Date.now()
              }
            }),
          
          stopTranscription: () =>
            set((state) => {
              state.isTranscribing = false
              state.sessionStatus = 'disconnected'
              state.currentTranscription = ''
              if (state.currentSession) {
                state.currentSession.endTime = Date.now()
                state.currentSession.totalDuration = 
                  state.currentSession.endTime - (state.currentSession.startTime || 0)
              }
            }),
          
          pauseTranscription: () =>
            set((state) => {
              state.isTranscribing = false
              state.sessionStatus = 'disconnected'
            }),
          
          resumeTranscription: () =>
            set((state) => {
              state.isTranscribing = true
              state.sessionStatus = 'connecting'
            }),
          
          // Panel management
          togglePanel: () =>
            set((state) => {
              state.isPanelOpen = !state.isPanelOpen
            }),
          
          openPanel: () =>
            set((state) => {
              state.isPanelOpen = true
            }),
          
          closePanel: () =>
            set((state) => {
              state.isPanelOpen = false
            }),
          
          // Transcript management
          addTranscriptItem: (item) =>
            set((state) => {
              state.transcriptItems.push(item)
            }),
          
          updateTranscriptItem: (id, updates) =>
            set((state) => {
              const index = state.transcriptItems.findIndex((item) => item.id === id)
              if (index !== -1) {
                Object.assign(state.transcriptItems[index], updates)
              }
            }),
          
          removeTranscriptItem: (id) =>
            set((state) => {
              state.transcriptItems = state.transcriptItems.filter((item) => item.id !== id)
            }),
          
          clearTranscript: () =>
            set((state) => {
              state.transcriptItems = []
              state.currentTranscription = ''
              state.finalTranscription = ''
            }),
          
          // Text updates
          setCurrentTranscription: (text) =>
            set((state) => {
              state.currentTranscription = text
            }),
          
          setFinalTranscription: (text) =>
            set((state) => {
              state.finalTranscription = text
              state.currentTranscription = ''
            }),
          
          appendToTranscription: (text) =>
            set((state) => {
              state.currentTranscription += text
            }),
          
          // Connection management
          setSessionStatus: (status) =>
            set((state) => {
              state.sessionStatus = status
              if (status === 'connected') {
                state.error = null
              }
            }),
          
          setConnectionState: (newState) =>
            set((state) => {
              Object.assign(state.connectionState, newState)
            }),
          
          // Settings
          updateSettings: (newSettings) =>
            set((state) => {
              Object.assign(state.settings, newSettings)
            }),
          
          updateAudioConfig: (newConfig) =>
            set((state) => {
              Object.assign(state.audioConfig, newConfig)
            }),
          
          // Error handling
          setError: (error) =>
            set((state) => {
              state.error = error
              state.isLoading = false
              if (error) {
                state.sessionStatus = 'error'
              }
            }),
          
          setLoading: (loading) =>
            set((state) => {
              state.isLoading = loading
            }),
          
          // Utility
          reset: () => set(initialState),
          
          exportTranscript: () => {
            const state = get()
            const transcriptText = state.transcriptItems
              .filter((item) => item.type === 'MESSAGE')
              .map((item) => {
                const timestamp = new Date(item.createdAtMs).toLocaleTimeString()
                const role = item.role === 'user' ? 'You' : 'Assistant'
                return `${state.settings.showTimestamps ? `[${timestamp}] ` : ''}${role}: ${item.content}`
              })
              .join('\n\n')
            
            return transcriptText
          }
        })),
        {
          name: 'transcription-store',
          storage: createJSONStorage(() => ({
            getItem: (name) => get(name),
            setItem: (name, value) => idbSet(name, value),
            removeItem: (name) => del(name),
          })),
          partialize: (state) => ({
            settings: state.settings,
            audioConfig: state.audioConfig,
            transcriptItems: state.transcriptItems,
          }),
        }
      )
    ),
    {
      name: 'transcription-store',
    }
  )
)

// Selectors
export const transcriptionSelectors = {
  isTranscribing: (state: TranscriptionStore) => state.isTranscribing,
  isPanelOpen: (state: TranscriptionStore) => state.isPanelOpen,
  sessionStatus: (state: TranscriptionStore) => state.sessionStatus,
  transcriptItems: (state: TranscriptionStore) => state.transcriptItems,
  currentTranscription: (state: TranscriptionStore) => state.currentTranscription,
  finalTranscription: (state: TranscriptionStore) => state.finalTranscription,
  settings: (state: TranscriptionStore) => state.settings,
  error: (state: TranscriptionStore) => state.error,
  isLoading: (state: TranscriptionStore) => state.isLoading,
  hasContent: (state: TranscriptionStore) => 
    state.transcriptItems.length > 0 || state.currentTranscription.length > 0,
  isConnected: (state: TranscriptionStore) => state.sessionStatus === 'connected',
  canTranscribe: (state: TranscriptionStore) => 
    !state.isTranscribing && state.sessionStatus !== 'connecting'
}