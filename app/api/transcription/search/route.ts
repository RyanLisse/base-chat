import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { TranscriptItem } from '@/lib/types/transcription'

export const maxDuration = 30

function cosineSimilarity(a: number[], b: number[]): number {
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

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('Unauthorized transcription search request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { 
      query, 
      limit = 10, 
      threshold = 0.7, 
      sessionId 
    } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query string is required' },
        { status: 400 }
      )
    }

    // Get embedding for search query
    const embeddingResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/transcription/embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || '',
        },
        body: JSON.stringify({ texts: [query] }),
      }
    )

    if (!embeddingResponse.ok) {
      logger.error('Failed to generate query embedding')
      return NextResponse.json(
        { error: 'Failed to generate query embedding' },
        { status: 500 }
      )
    }

    const { embeddings } = await embeddingResponse.json()
    const queryEmbedding = embeddings[0]

    // Search in database
    let queryBuilder = supabase
      .from('transcription_indices')
      .select('*')
      .eq('user_id', user.id)

    if (sessionId) {
      queryBuilder = queryBuilder.eq('metadata->sessionId', sessionId)
    }

    const { data: indices, error } = await queryBuilder
      .limit(limit * 2) // Get more results for filtering

    if (error) {
      logger.error('Database search error:', error)
      return NextResponse.json(
        { error: 'Database search failed' },
        { status: 500 }
      )
    }

    if (!indices || indices.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Calculate similarity scores and filter by threshold
    const results = indices
      .map(index => ({
        ...index,
        similarity: cosineSimilarity(queryEmbedding, index.embedding)
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    // Convert back to TranscriptItem format
    const transcriptItems: TranscriptItem[] = results.map(result => ({
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

    logger.info(`Search returned ${transcriptItems.length} results for query: "${query}"`)

    return NextResponse.json({
      results: transcriptItems,
      count: transcriptItems.length,
      query: query,
      threshold: threshold
    })

  } catch (error) {
    logger.error('Error in transcription search endpoint:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}