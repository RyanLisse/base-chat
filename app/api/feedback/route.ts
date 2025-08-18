import { createLangSmithFeedback } from "@/lib/langsmith/client"
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { messageId, feedback, comment, langsmithRunId } = await request.json()

    // Validate input
    if (!messageId || !["upvote", "downvote", null].includes(feedback)) {
      return NextResponse.json(
        { error: "Invalid feedback data" },
        { status: 400 }
      )
    }

    // Get user from session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Auth error:", authError)
    }

    const userId = user?.id

    // Store feedback in Supabase if user is authenticated
    if (userId && feedback !== null && supabase) {
      try {
        // Store in general feedback table for now
        const { error: insertError } = await supabase
          .from("feedback")
          .insert({
            message: `${feedback}: ${messageId}${comment ? ` - ${comment}` : ''}`,
            user_id: userId
          })

        if (insertError) {
          console.error("Error inserting feedback:", insertError)
        }
      } catch (dbError) {
        console.error("Database error:", dbError)
        // Continue with LangSmith feedback even if DB fails
      }
    }

    // Send feedback to LangSmith if runId is provided and feedback is not null
    if (langsmithRunId && feedback !== null) {
      try {
        await createLangSmithFeedback({
          runId: langsmithRunId,
          feedback,
          comment,
          userId: userId || "anonymous"
        })
      } catch (langsmithError) {
        console.error("LangSmith error:", langsmithError)
        // Don't fail the request if LangSmith fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      feedback,
      messageId 
    })

  } catch (error) {
    console.error("Error in feedback API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}