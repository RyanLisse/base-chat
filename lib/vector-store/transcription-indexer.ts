import OpenAI from 'openai'
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
  private openai: OpenAI
  private supabase: ReturnType<typeof createClient>

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true 
    })
    this.supabase = createClient()
  }

  /**
   * Generate embedding for text using OpenAI's text-embedding-3-small model
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding:', error)
      throw new Error('Failed to generate embedding')
    }
  }

  /**
   * Index a transcription item in the vector store
   */
  async indexTranscription(
    userId: string,
    transcriptItem: TranscriptItem,
    sessionId?: string
  ): Promise<void> {
    try {
      // Skip if content is too short or empty
      if (!transcriptItem.content || transcriptItem.content.trim().length < 10) {
        return
      }

      // Generate embedding for the transcription content
      const embedding = await this.generateEmbedding(transcriptItem.content)

      // Get or create vector store for user
      const vectorStoreId = await this.ensureUserVectorStore(userId)

      // Create file content for the transcription
      const fileContent = this.createTranscriptionDocument(transcriptItem, sessionId)

      // Upload file to OpenAI
      const file = await this.openai.files.create({
        file: new Blob([fileContent], { type: 'text/plain' }),
        purpose: 'assistants'
      })

      // Add file to vector store
      await this.openai.beta.vectorStores.files.create(vectorStoreId, {
        file_id: file.id
      })

      // Store index in database for quick retrieval
      await this.supabase
        .from('transcription_indices')
        .upsert({
          id: transcriptItem.id,
          user_id: userId,
          transcript_id: transcriptItem.id,
          content: transcriptItem.content,
          embedding: embedding,
          metadata: {
            timestamp: transcriptItem.createdAtMs,
            sessionId,
            role: transcriptItem.role || 'user',
            wordCount: transcriptItem.content.split(/\s+/).length,
            language: 'en-US' // Could be detected dynamically
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      console.log(`Indexed transcription: ${transcriptItem.id}`)
    } catch (error) {
      console.error('Error indexing transcription:', error)
      throw error
    }
  }

  /**
   * Bulk index multiple transcription items
   */
  async indexTranscriptions(
    userId: string,
    transcriptItems: TranscriptItem[],
    sessionId?: string
  ): Promise<void> {
    for (const item of transcriptItems) {
      await this.indexTranscription(userId, item, sessionId)
    }
  }

  /**
   * Search transcriptions using vector similarity
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
      const {
        limit = 10,
        threshold = 0.7,
        sessionId
      } = options

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query)

      // Search in database using vector similarity
      let queryBuilder = this.supabase
        .from('transcription_indices')
        .select('*')
        .eq('user_id', userId)

      if (sessionId) {
        queryBuilder = queryBuilder.eq('metadata->sessionId', sessionId)
      }

      const { data: indices, error } = await queryBuilder
        .limit(limit * 2) // Get more results for filtering

      if (error) {
        throw error
      }

      if (!indices || indices.length === 0) {
        return []
      }

      // Calculate similarity scores and filter by threshold
      const results = indices
        .map(index => ({
          ...index,
          similarity: this.cosineSimilarity(queryEmbedding, index.embedding)
        }))
        .filter(result => result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      // Convert back to TranscriptItem format
      return results.map(result => ({
        id: result.transcript_id,
        type: 'MESSAGE' as const,
        role: result.metadata.role,
        content: result.content,
        createdAtMs: result.metadata.timestamp,
        data: {
          similarity: result.similarity,
          wordCount: result.metadata.wordCount,
          sessionId: result.metadata.sessionId
        }
      }))

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
   * Ensure user has a vector store, create if needed
   */
  private async ensureUserVectorStore(userId: string): Promise<string> {
    // Check if user already has a vector store
    const { data: existing } = await this.supabase
      .from('user_vector_stores')
      .select('vector_store_id')
      .eq('user_id', userId)
      .eq('store_type', 'transcriptions')
      .single()

    if (existing?.vector_store_id) {
      return existing.vector_store_id
    }

    // Create new vector store
    const vectorStore = await this.openai.beta.vectorStores.create({
      name: `Transcriptions - ${userId}`,
      metadata: {
        user_id: userId,
        type: 'transcriptions',
        created_by: 'transcription-indexer'
      }
    })

    // Store reference in database
    await this.supabase
      .from('user_vector_stores')
      .insert({
        user_id: userId,
        vector_store_id: vectorStore.id,
        store_type: 'transcriptions',
        created_at: new Date().toISOString()
      })

    return vectorStore.id
  }

  /**
   * Create a formatted document for the transcription
   */
  private createTranscriptionDocument(
    transcriptItem: TranscriptItem,
    sessionId?: string
  ): string {
    const timestamp = new Date(transcriptItem.createdAtMs).toISOString()
    const role = transcriptItem.role === 'user' ? 'User' : 'Assistant'
    
    return `# Transcription Entry

**ID:** ${transcriptItem.id}
**Role:** ${role}
**Timestamp:** ${timestamp}
**Session:** ${sessionId || 'unknown'}

## Content

${transcriptItem.content}

## Metadata

- Word Count: ${transcriptItem.content.split(/\s+/).length}
- Language: en-US
- Type: ${transcriptItem.type}
`
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }
}