import { Client } from "langsmith"
import { traceable } from "langsmith/traceable"

// Initialize LangSmith client
export const langsmithClient = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
})

// Check if LangSmith is enabled
export const isLangSmithEnabled = () => {
  return !!(process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_TRACING === "true")
}

// Traceable wrapper for chat completions
export const traceChat = traceable(
  async (params: {
    model: string
    messages: unknown[]
    systemPrompt: string
    userId?: string
    chatId?: string
    reasoningEffort?: string
    enableFileSearch?: boolean
  }) => {
    // This wrapper will automatically trace the execution
    // The actual AI call will be made in the chat route
    return params
  },
  { 
    name: "chat-completion",
    project: process.env.LANGSMITH_PROJECT || "zola-chat"
  }
)

// Function to create a feedback record in LangSmith
export async function createLangSmithFeedback({
  runId,
  feedback,
  comment,
  userId
}: {
  runId: string
  feedback: "upvote" | "downvote"
  comment?: string
  userId?: string
}) {
  if (!isLangSmithEnabled()) {
    console.log("LangSmith not enabled, skipping feedback")
    return null
  }

  try {
    const feedbackRecord = await langsmithClient.createFeedback(
      runId,
      "user_feedback",
      {
        score: feedback === "upvote" ? 1 : 0,
        value: feedback,
        comment: comment || undefined
      }
    )

    return feedbackRecord
  } catch (error) {
    console.error("Failed to create LangSmith feedback:", error)
    return null
  }
}

// Function to log a run to LangSmith
export async function createLangSmithRun({
  name,
  inputs,
  outputs,
  metadata,
  parentRunId
}: {
  name: string
  inputs: Record<string, unknown>
  outputs?: Record<string, unknown>
  metadata?: Record<string, unknown>
  parentRunId?: string
}) {
  if (!isLangSmithEnabled()) {
    return null
  }

  try {
    // For now, return a simple placeholder since LangSmith client needs proper setup
    const run = {
      id: `run-${Date.now()}`,
      name,
      inputs,
      outputs: outputs || {}
    }

    return run
  } catch (error) {
    console.error("Failed to create LangSmith run:", error)
    return null
  }
}