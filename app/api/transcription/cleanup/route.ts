import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

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
      logger.warn('Unauthorized transcription cleanup request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { olderThanDays = 30, maxItems } = await request.json()

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    const cutoffTimestamp = cutoffDate.getTime()

    let queryBuilder = supabase
      .from('transcription_indices')
      .select('id, metadata')
      .eq('user_id', user.id)
      .lt('metadata->timestamp', cutoffTimestamp)
      .order('created_at', { ascending: true })

    if (maxItems) {
      queryBuilder = queryBuilder.limit(maxItems)
    }

    const { data: oldItems, error: selectError } = await queryBuilder

    if (selectError) {
      logger.error('Failed to select old transcriptions:', selectError)
      return NextResponse.json(
        { error: 'Failed to query old transcriptions' },
        { status: 500 }
      )
    }

    if (!oldItems || oldItems.length === 0) {
      return NextResponse.json({
        deleted: 0,
        message: 'No old transcriptions found to clean up'
      })
    }

    // Delete old transcriptions
    const idsToDelete = oldItems.map(item => item.id)
    const { error: deleteError } = await supabase
      .from('transcription_indices')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      logger.error('Failed to delete old transcriptions:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete old transcriptions' },
        { status: 500 }
      )
    }

    logger.info(`Cleaned up ${idsToDelete.length} transcription items for user ${user.id}`)

    return NextResponse.json({
      deleted: idsToDelete.length,
      message: `Successfully deleted ${idsToDelete.length} old transcription items`
    })

  } catch (error) {
    logger.error('Error in transcription cleanup endpoint:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check cleanup status
export async function GET(request: NextRequest) {
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
      logger.warn('Unauthorized transcription cleanup status request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get count of transcriptions by age
    const { data: totalCount, error: totalError } = await supabase
      .from('transcription_indices')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)

    if (totalError) {
      logger.error('Failed to get total transcription count:', totalError)
      return NextResponse.json(
        { error: 'Failed to get transcription count' },
        { status: 500 }
      )
    }

    // Count old transcriptions (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoffTimestamp = thirtyDaysAgo.getTime()

    const { data: oldCount, error: oldError } = await supabase
      .from('transcription_indices')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .lt('metadata->timestamp', cutoffTimestamp)

    if (oldError) {
      logger.error('Failed to get old transcription count:', oldError)
      return NextResponse.json(
        { error: 'Failed to get old transcription count' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      totalTranscriptions: totalCount?.length || 0,
      oldTranscriptions: oldCount?.length || 0,
      cleanupRecommended: (oldCount?.length || 0) > 100, // Recommend cleanup if more than 100 old items
      estimatedStorageSavedMB: Math.round((oldCount?.length || 0) * 0.01) // Rough estimate: 10KB per item
    })

  } catch (error) {
    logger.error('Error in transcription cleanup status endpoint:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}