import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, ToolSet } from "ai"
import { fileSearchTool } from "@/lib/tools/file-search"
import { createLangSmithRun, isLangSmithEnabled } from "@/lib/langsmith/client"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  reasoningEffort?: string
  message_group_id?: string
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      reasoningEffort = "medium",
      message_group_id,
    } = (await req.json()) as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    })

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId })
    }

    const userMessage = messages[messages.length - 1]

    if (supabase && userMessage?.role === "user") {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: userMessage.content,
        attachments: userMessage.experimental_attachments as Attachment[],
        model,
        isAuthenticated,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    // Use RoboRail system prompt when file search is enabled
    const effectiveSystemPrompt = enableSearch 
      ? FILE_SEARCH_SYSTEM_PROMPT 
      : (systemPrompt || SYSTEM_PROMPT_DEFAULT)

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(model)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    // Create LangSmith run if enabled
    let langsmithRunId: string | undefined
    if (isLangSmithEnabled()) {
      try {
        const run = await createLangSmithRun({
          name: "chat-completion",
          inputs: {
            model,
            messages: messages.length,
            enableSearch,
            reasoningEffort,
            systemPrompt: effectiveSystemPrompt.substring(0, 100) + "..."
          },
          metadata: {
            userId,
            chatId,
            isAuthenticated
          }
        })
        langsmithRunId = run?.id as string | undefined
      } catch (error) {
        console.error("Failed to create LangSmith run:", error)
      }
    }

    // Configure tools based on enableSearch
    const tools = enableSearch ? { fileSearch: fileSearchTool } : {}

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { 
        enableSearch, 
        reasoningEffort 
      }),
      system: effectiveSystemPrompt,
      messages: messages,
      tools: tools as ToolSet,
      maxSteps: 10,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
          })
        }

        // Update LangSmith run if enabled
        if (langsmithRunId && isLangSmithEnabled()) {
          try {
            await createLangSmithRun({
              name: "chat-completion-finish",
              inputs: {
                runId: langsmithRunId,
                tokensUsed: response.usage?.totalTokens || 0,
                finishReason: response.finishReason
              },
              outputs: {
                messageCount: response.messages?.length || 0,
                hasToolCalls: response.toolCalls?.length > 0
              },
              parentRunId: langsmithRunId
            })
          } catch (error) {
            console.error("Failed to update LangSmith run:", error)
          }
        }
      },
    })

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
