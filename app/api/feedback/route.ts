import { validateUserIdentity } from '@/lib/server/api'
import { createFeedback as createLangSmithFeedback } from '@/lib/langsmith/client'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messageId, feedback, comment, runId, userId } = body

    if (!messageId || !feedback) {
      return NextResponse.json(
        { error: 'Message ID and feedback are required' },
        { status: 400 }
      )
    }

    // Validate feedback type
    if (feedback !== 'upvote' && feedback !== 'downvote' && feedback !== null) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Get user authentication
    const supabase = await validateUserIdentity(userId || '', true)
    if (!supabase) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      )
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      )
    }

    // Store feedback in Supabase
    const { error: dbError } = await supabase
      .from('message_feedback')
      .upsert({
        message_id: Number(messageId),
        user_id: user.id,
        type: feedback || 'none',
        content: comment || undefined,
      }, {
        onConflict: 'message_id,user_id',
      })

    if (dbError) {
      console.error('Error storing feedback in database:', dbError)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    // Send to LangSmith if run ID is provided
    let langsmithResult = null
    if (runId) {
      try {
        langsmithResult = await createLangSmithFeedback({
          runId,
          feedback,
          score: feedback === 'upvote' ? 1 : (feedback === 'downvote' ? 0 : undefined),
          comment,
          userId: user.id,
        })
      } catch (e) {
        console.warn('LangSmith feedback failed; continuing without it.', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      langsmith: langsmithResult,
    })
  } catch (error) {
    console.error('Error in feedback API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')
    const userId = searchParams.get('userId')

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'Message ID and user ID are required' },
        { status: 400 }
      )
    }

    // Validate user
    const supabase = await validateUserIdentity(userId, true)
    if (!supabase) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      )
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      )
    }

    // Get feedback from database
    const { data, error } = await supabase
      .from('message_feedback')
      .select('type, content, created_at')
      .eq('message_id', Number(messageId))
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error('Error fetching feedback:', error)
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      feedback: data?.type || null,
      comment: data?.content || null,
      createdAt: data?.created_at || null,
    })
  } catch (error) {
    console.error('Error in feedback GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}