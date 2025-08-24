import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { TranscriptItem } from '@/lib/types/transcription'

export const maxDuration = 30

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
      logger.warn('Unauthorized transcription indexing request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { transcriptItems, sessionId } = await request.json()

    if (!transcriptItems || !Array.isArray(transcriptItems)) {
      return NextResponse.json(
        { error: 'transcriptItems array is required' },
        { status: 400 }
      )
    }

    // Filter items with sufficient content
    const validItems = transcriptItems.filter((item: TranscriptItem) => 
      item.content && item.content.trim().length >= 10
    )

    if (validItems.length === 0) {
      return NextResponse.json({
        indexed: 0,
        message: 'No items with sufficient content to index'
      })
    }

    // Get embeddings for all items
    const texts = validItems.map((item: TranscriptItem) => item.content)
    const embeddingResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/transcription/embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || '',
        },
        body: JSON.stringify({ texts }),
      }
    )

    if (!embeddingResponse.ok) {
      logger.error('Failed to generate embeddings')
      return NextResponse.json(
        { error: 'Failed to generate embeddings' },
        { status: 500 }
      )
    }

    const { embeddings } = await embeddingResponse.json()

    // Index all transcriptions
    const indexData = validItems.map((item: TranscriptItem, index: number) => ({
      id: item.id,
      user_id: user.id,
      transcript_id: item.id,
      content: item.content,
      embedding: embeddings[index],
      metadata: {
        timestamp: item.createdAtMs,
        sessionId,
        role: item.role || 'user',
        wordCount: item.content.split(/\s+/).length,
        language: 'en-US'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from('transcription_indices')
      .upsert(indexData)

    if (insertError) {
      logger.error('Failed to insert transcription indices:', insertError)
      return NextResponse.json(
        { error: 'Failed to index transcriptions' },
        { status: 500 }
      )
    }

    logger.info(`Indexed ${validItems.length} transcription items`)

    return NextResponse.json({
      indexed: validItems.length,
      message: `Successfully indexed ${validItems.length} transcription items`
    })

  } catch (error) {
    logger.error('Error in transcription indexing endpoint:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}