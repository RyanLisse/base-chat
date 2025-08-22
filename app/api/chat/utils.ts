import { UIMessage as MessageAISDK } from "ai"

/**
 * Clean messages when switching between agents with different tool capabilities.
 * This removes tool invocations and tool-related content from messages when tools are not available
 * to prevent OpenAI API errors.
 */
export function cleanMessagesForTools(
  messages: MessageAISDK[],
  hasTools: boolean
): MessageAISDK[] {
  if (hasTools) {
    return messages
  }

  // If no tools available, clean all tool-related content
  const cleanedMessages = messages
    .map((message) => {
      // Skip tool messages entirely when no tools are available
      // Note: Using type assertion since AI SDK types might not include 'tool' role
      if ((message as { role: string }).role === "tool") {
        return null
      }

      if (message.role === "assistant") {
        const cleanedMessage: any = { ...message }

        if ((message as any).toolInvocations && (message as any).toolInvocations.length > 0) {
          delete cleanedMessage.toolInvocations
        }

        if (Array.isArray((message as any).content)) {
          const filteredContent = (
            (message as any).content as Array<{ type?: string; text?: string }>
          ).filter((part: { type?: string }) => {
            if (part && typeof part === "object" && part.type) {
              // Remove tool-call, tool-result, and tool-invocation parts
              const isToolPart =
                part.type === "tool-call" ||
                part.type === "tool-result" ||
                part.type === "tool-invocation"
              return !isToolPart
            }
            return true
          })

          // Extract text content
          const textParts = filteredContent.filter(
            (part: { type?: string }) =>
              part && typeof part === "object" && part.type === "text"
          )

          if (textParts.length > 0) {
            // Combine text parts into a single string
            const textContent = textParts
              .map((part: { text?: string }) => part.text || "")
              .join("\n")
              .trim()
            cleanedMessage.content = textContent || "[Assistant response]"
          } else if (filteredContent.length === 0) {
            // If no content remains after filtering, provide fallback
            cleanedMessage.content = "[Assistant response]"
          } else {
            // Keep the filtered content as string if possible
            cleanedMessage.content = "[Assistant response]"
          }
        }

        // If the message has no meaningful content after cleaning, provide fallback
        if (
          !cleanedMessage.content ||
          (typeof cleanedMessage.content === "string" &&
            cleanedMessage.content.trim() === "")
        ) {
          cleanedMessage.content = "[Assistant response]"
        }

        return cleanedMessage
      }

      // For user messages, clean any tool-related content from array content
      if (message.role === "user" && Array.isArray((message as any).content)) {
        const filteredContent = (
          (message as any).content as Array<{ type?: string }>
        ).filter((part: { type?: string }) => {
          if (part && typeof part === "object" && part.type) {
            const isToolPart =
              part.type === "tool-call" ||
              part.type === "tool-result" ||
              part.type === "tool-invocation"
            return !isToolPart
          }
          return true
        })

        if (
          filteredContent.length !== ((message as any).content as Array<unknown>).length
        ) {
          return {
            ...message,
            content:
              filteredContent.length > 0 ? filteredContent : "User message",
          } as MessageAISDK
        }
      }

      return message
    })
    .filter((msg): msg is MessageAISDK => msg !== null)

  // Ensure we have at least one message
  if (cleanedMessages.length === 0) {
    return [
      {
        id: "fallback-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      } as any,
    ]
  }

  // The last message should be from the user
  const lastMessage = cleanedMessages[cleanedMessages.length - 1]
  if (lastMessage.role !== "user") {
    // Ensure last message is always from user for API requirements
    cleanedMessages.push({
      id: `user-fallback-${Date.now()}`,
      role: "user",
      content: "Continue",
      createdAt: new Date(),
    } as any)
  }

  return cleanedMessages
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message?.includes('Incorrect API key')) {
      return 'Invalid API key. Please check your settings.'
    }
    if (error.message?.includes('rate limit')) {
      return 'Rate limit exceeded. Please try again later.'
    }
    if (error.message?.includes('context length')) {
      return 'Message too long. Please shorten your input.'
    }
    return error.message
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as any
    if (err.error?.message) return err.error.message
    if (err.message) return err.message
    if (err.statusText) return err.statusText
  }
  
  return 'An unexpected error occurred'
}

export function createErrorResponse(error: {
  code?: string
  message?: string
  statusCode?: number
}) {
  const status = error.statusCode || 500
  const message = error.message || 'Internal server error'
  
  return new Response(
    JSON.stringify({ 
      error: message,
      code: error.code 
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}