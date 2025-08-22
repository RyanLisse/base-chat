import { SYSTEM_PROMPT_DEFAULT, FILE_SEARCH_SYSTEM_PROMPT } from "@/lib/config"
import { logger } from "@/lib/logger"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import type { LanguageModelUsage } from 'ai'
import { streamText, convertToModelMessages } from "ai"
import type { UIMessage as MessageAISDK, ToolSet } from "ai"
import { fileSearchTool } from "@/lib/tools/file-search"
import {
  isLangSmithEnabled,
  createRun,
  updateRun,
  extractRunId,
  logMetrics,
} from "@/lib/langsmith/client"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

// Narrow AI SDK response metadata to include optional usage for logging
type TokenUsage = {
  totalTokens: number
  promptTokens: number
  completionTokens: number
}

type ResponseWithUsage = {
  usage?: LanguageModelUsage
  messages: unknown[]
}

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  verbosity?: 'low' | 'medium' | 'high'
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
      message_group_id,
      reasoningEffort = 'medium',
      verbosity,
    } = (await req.json()) as ChatRequest

    // Normalize legacy/alias model IDs
    const resolvedModel = model === 'gpt-4o-mini' ? 'gpt-5-mini' : model

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing or invalid messages" }),
        { status: 400 }
      )
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model: resolvedModel,
      isAuthenticated,
    })

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId })
    }

    const userMessage = messages[messages.length - 1]

    if (supabase && userMessage?.role === "user") {
      // Extract text content - v5 UIMessage has content as string
      const textContent = (userMessage as any).content || ''
      const attachments = (userMessage as any).attachments || []
      
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: textContent,
        attachments: attachments as any[],
        model: resolvedModel,
        isAuthenticated,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === resolvedModel)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    // Use file search system prompt for GPT-5 models with file search enabled
    const isGPT5Model = resolvedModel.startsWith('gpt-5')

    // Log request context
    try {
      const provider = getProviderForModel(resolvedModel)
      logger.info({
        at: "api.chat.POST",
        model: resolvedModel,
        provider,
        enableSearch,
        reasoningEffort,
        verbosity,
        temperature: isGPT5Model ? 1 : undefined,
      }, "chat request")
    } catch {}
    const effectiveSystemPrompt = enableSearch && isGPT5Model 
      ? FILE_SEARCH_SYSTEM_PROMPT 
      : (systemPrompt || SYSTEM_PROMPT_DEFAULT)

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(resolvedModel)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    // Create LangSmith run if enabled
    let langsmithRunId: string | null = null
    if (isLangSmithEnabled()) {
      const run = (await createRun({
        name: 'chat-completion',
        inputs: {
          model: resolvedModel,
          messages: messages.map((m: MessageAISDK) => ({ role: m.role, content: (m as any).content || '' })),
          reasoningEffort,
          enableSearch,
        },
        runType: 'chain',
        metadata: {
          userId,
          chatId,
          model: resolvedModel,
          reasoningEffort,
          enableSearch,
        },
      })) as { id?: string } | null
      langsmithRunId = run?.id || null
    }

    // Configure tools based on file search enablement
    const tools: ToolSet = enableSearch && isGPT5Model 
      ? { fileSearch: fileSearchTool } 
      : ({} as ToolSet)

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch,
      reasoningEffort,
      verbosity,
      headers: isGPT5Model ? {
        'X-Reasoning-Effort': reasoningEffort,
        ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
      } : undefined,
    }

    // Convert UIMessages to ModelMessages for v5
    // v5 expects messages with 'parts' array, not 'content' string
    // Transform messages to the expected format
    const messagesArray = Array.isArray(messages) ? messages : []
    
    const transformedMessages = messagesArray.map((msg: any) => {
      // Ensure msg has proper structure
      if (!msg || typeof msg !== 'object') {
        console.warn('Invalid message format:', msg)
        return {
          role: 'user',
          parts: [{ type: 'text', text: String(msg || '[Invalid message]') }]
        }
      }
      
      // If message already has parts array, use it as-is
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg
      }
      
      // Convert content to parts array format for v5
      let parts: any[] = []
      
      // Handle string content
      if (typeof msg.content === 'string') {
        parts = [{ type: 'text', text: msg.content }]
      }
      // Handle array content (tool messages, etc.)
      else if (Array.isArray(msg.content)) {
        // Convert content array to parts
        parts = msg.content.map((part: any) => {
          if (typeof part === 'string') {
            return { type: 'text', text: part }
          } else if (part && typeof part === 'object') {
            // Already structured part
            return part
          }
          return { type: 'text', text: String(part || '') }
        })
      }
      // Handle object content
      else if (typeof msg.content === 'object' && msg.content !== null) {
        const textContent = (msg.content as any).text || (msg.content as any).content || ''
        parts = [{ type: 'text', text: String(textContent) }]
      }
      // Fallback
      else {
        parts = [{ 
          type: 'text', 
          text: String(msg.content || (msg.role === 'assistant' ? '[Assistant response]' : '[User message]'))
        }]
      }
      
      // Return message in v5 format with parts array
      return {
        role: msg.role || 'user',
        parts,
        ...(msg.id && { id: msg.id })
      }
    })
    
    // Add null check for transformedMessages
    if (!transformedMessages || !Array.isArray(transformedMessages)) {
      console.error('transformedMessages is not an array:', transformedMessages)
      return new Response(
        JSON.stringify({ error: "Failed to transform messages" }),
        { status: 500 }
      )
    }
    
    // Ensure all messages have valid parts before conversion
    const validatedMessages = transformedMessages.filter((msg: any) => 
      msg && msg.role && msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0
    )
    
    if (validatedMessages.length === 0) {
      console.error('No valid messages after filtering:', { original: messages, transformed: transformedMessages })
      return new Response(
        JSON.stringify({ error: "No valid messages to process" }),
        { status: 400 }
      )
    }
    
    // Log before conversion
    console.log('Before convertToModelMessages:', {
      validatedMessages: JSON.stringify(validatedMessages),
      isArray: Array.isArray(validatedMessages),
      length: validatedMessages.length
    })
    
    let modelMessages;
    try {
      modelMessages = convertToModelMessages(validatedMessages)
    } catch (conversionError) {
      console.error('Error in convertToModelMessages:', conversionError)
      console.error('validatedMessages that caused error:', validatedMessages)
      return new Response(
        JSON.stringify({ error: "Failed to convert messages to model format" }),
        { status: 500 }
      )
    }
    
    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      tools,
      // GPT-5 models only support default temperature = 1
      temperature: isGPT5Model ? 1 : undefined,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        // Resolve final run ID from response (if available)
        const actualRunId = extractRunId(response) || langsmithRunId

        // Store assistant message with LangSmith run ID
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
            langsmithRunId: actualRunId,
            reasoningEffort,
          })
        }

        // Update LangSmith run if enabled
        if (actualRunId && isLangSmithEnabled()) {
          await updateRun({
            runId: actualRunId,
            outputs: {
              messages: response.messages,
              usage: (response as ResponseWithUsage).usage,
            },
          })

          // Log metrics
          const usage = (response as ResponseWithUsage).usage
          if (usage) {
            await logMetrics({
              runId: actualRunId,
              metrics: {
                totalTokens: usage.totalTokens,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                reasoningEffort,
                enableSearch,
              },
            })
          }
        }
      },
    })

    // v5 uses toUIMessageStreamResponse for useChat hook compatibility
    return result.toUIMessageStreamResponse();
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
