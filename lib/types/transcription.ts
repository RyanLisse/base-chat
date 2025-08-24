export type TranscriptItemType = 'MESSAGE' | 'BREADCRUMB'

export interface TranscriptItem {
  id: string
  type: TranscriptItemType
  role?: 'user' | 'assistant'
  content: string
  createdAtMs: number
  isExpanded?: boolean
  data?: any
}

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface TranscriptionSession {
  id: string
  status: SessionStatus
  startTime?: number
  endTime?: number
  totalDuration?: number
  wordCount?: number
}

export interface AudioConfig {
  sampleRate: number
  channels: number
  codec: 'opus' | 'pcmu' | 'pcma'
  vad: 'none' | 'server_vad' | 'semantic_vad'
}

export interface TranscriptionSettings {
  autoSend: boolean
  showTimestamps: boolean
  language: string
  enableVAD: boolean
  pushToTalk: boolean
  noiseReduction: boolean
}

export interface WebRTCConnectionState {
  pc: RTCPeerConnection | null
  dc: RTCDataChannel | null
  isConnected: boolean
  error: string | null
}