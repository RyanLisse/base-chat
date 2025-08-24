import { createClient } from '@/lib/supabase/client'
import type { TranscriptItem } from '@/lib/types/transcription'

export interface TranscriptionIndex {
  id: string
  userId: string
  transcriptId: string
  content: string
  embedding: number[]
  metadata: {
    timestamp: number
    sessionId?: string
    role: 'user' | 'assistant'
    wordCount: number
    language?: string
    confidence?: number
  }
  createdAt: string
  updatedAt: string
}

export class TranscriptionIndexer {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Generate embeddings using server-side API
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch('/api/transcription/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate embeddings: ${response.statusText}`)
      }

      const data = await response.json()
      return data.embeddings
    } catch (error) {
      console.error('Error generating embeddings:', error)
      throw new Error('Failed to generate embeddings')
    }
  }

  /**
   * Index a transcription item using server-side API
   */
  async indexTranscription(
    userId: string,
    transcriptItem: TranscriptItem,
    sessionId?: string
  ): Promise<void> {
    return this.indexTranscriptions(userId, [transcriptItem], sessionId)
  }

  /**
   * Bulk index multiple transcription items using server-side API
   */
  async indexTranscriptions(
    userId: string,
    transcriptItems: TranscriptItem[],
    sessionId?: string
  ): Promise<void> {
    try {
      const response = await fetch('/api/transcription/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcriptItems, sessionId }),
      })

      if (!response.ok) {
        throw new Error(`Failed to index transcriptions: ${response.statusText}`)
      }

      const result = await response.json()
      console.log(`Successfully indexed ${result.indexed} transcription items`)
    } catch (error) {
      console.error('Error indexing transcriptions:', error)
      throw error
    }
  }

  /**
   * Search transcriptions using server-side API
   */
  async searchTranscriptions(
    userId: string,
    query: string,
    options: {
      limit?: number
      threshold?: number
      sessionId?: string
    } = {}
  ): Promise<TranscriptItem[]> {
    try {
      const response = await fetch('/api/transcription/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: options.limit || 10,
          threshold: options.threshold || 0.7,
          sessionId: options.sessionId
        }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.results || []

    } catch (error) {
      console.error('Error searching transcriptions:', error)
      return []
    }
  }

  /**
   * Get transcriptions from a specific session
   */
  async getSessionTranscriptions(
    userId: string,
    sessionId: string
  ): Promise<TranscriptItem[]> {
    try {
      const { data: indices, error } = await this.supabase
        .from('transcription_indices')
        .select('*')
        .eq('user_id', userId)
        .eq('metadata->sessionId', sessionId)
        .order('metadata->timestamp', { ascending: true })

      if (error) {
        throw error
      }

      return indices?.map(index => ({
        id: index.transcript_id,
        type: 'MESSAGE' as const,
        role: index.metadata.role,
        content: index.content,
        createdAtMs: index.metadata.timestamp
      })) || []

    } catch (error) {
      console.error('Error getting session transcriptions:', error)
      return []
    }
  }

  /**
   * Delete transcription from index
   */
  async deleteTranscription(userId: string, transcriptId: string): Promise<void> {
    try {
      await this.supabase
        .from('transcription_indices')
        .delete()
        .eq('user_id', userId)
        .eq('transcript_id', transcriptId)

    } catch (error) {
      console.error('Error deleting transcription:', error)
      throw error
    }
  }

  /**
   * Clear all transcriptions for a user
   */
  async clearUserTranscriptions(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('transcription_indices')
        .delete()
        .eq('user_id', userId)

    } catch (error) {
      console.error('Error clearing transcriptions:', error)
      throw error
    }
  }

  /**
   * Clean up old transcriptions using server-side API
   */
  async cleanupOldTranscriptions(options: {
    olderThanDays?: number
    maxItems?: number
  } = {}): Promise<{ deleted: number; message: string }> {
    try {
      const response = await fetch('/api/transcription/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.statusText}`)
      }

      return await response.json()

    } catch (error) {
      console.error('Error cleaning up transcriptions:', error)
      throw error
    }
  }

  /**
   * Get cleanup status and recommendations
   */
  async getCleanupStatus(): Promise<{
    totalTranscriptions: number
    oldTranscriptions: number
    cleanupRecommended: boolean
    estimatedStorageSavedMB: number
  }> {
    try {
      const response = await fetch('/api/transcription/cleanup')

      if (!response.ok) {
        throw new Error(`Failed to get cleanup status: ${response.statusText}`)
      }

      return await response.json()

    } catch (error) {
      console.error('Error getting cleanup status:', error)
      throw error
    }
  }

}