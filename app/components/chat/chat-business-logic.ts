import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import type { UserProfile } from "@/lib/user/types"
import type { UIMessage as Message } from "@ai-sdk/react"

/**
 * BDD-style chat operations extracted from use-chat-core.ts
 * Following behavior-driven development patterns for testability
 */

// Types for operation results
export type OperationResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

export type MessageSubmissionContext = {
  input: string
  files: File[]
  user: UserProfile | null
  selectedModel: string
  isAuthenticated: boolean
  systemPrompt?: string
  enableSearch: boolean
  reasoningEffort: 'low' | 'medium' | 'high'
  chatId: string | null
}

export type OptimisticMessageData = {
  id: string
  content: string
  role: "user"
  createdAt: Date
  experimental_attachments?: Array<{ name: string; contentType: string; url: string }>
}

export type ChatOperationDependencies = {
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (uid: string, chatId: string) => Promise<Attachment[] | null>
  createOptimisticAttachments: (files: File[]) => Array<{ name: string; contentType: string; url: string }>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
}

/**
 * BDD Scenario: "Given user input, When submitting message, Then validate and send"
 * 
 * This encapsulates the core message submission business logic:
 * - User authentication validation
 * - Rate limiting checks  
 * - Input validation
 * - File upload processing
 * - Message preparation
 */
export async function submitMessageScenario(
  context: MessageSubmissionContext,
  dependencies: ChatOperationDependencies
): Promise<OperationResult<{
  chatId: string
  requestOptions: any
  optimisticMessage: OptimisticMessageData
}>> {
  const { input, files, user, selectedModel, isAuthenticated, systemPrompt, enableSearch, reasoningEffort, chatId } = context
  const { checkLimitsAndNotify, ensureChatExists, handleFileUploads, createOptimisticAttachments, cleanupOptimisticAttachments } = dependencies

  try {
    // Given: User wants to submit a message
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(uid, checkLimitsAndNotify)
    if (!limitResult.success) {
      return limitResult
    }

    // When: Validating input
    const inputValidation = validateMessageInput(input)
    if (!inputValidation.success) {
      return inputValidation
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, input)
    if (!currentChatId) {
      return { success: false, error: "Failed to create or access chat" }
    }

    // When: Processing file uploads
    const fileResult = await handleFileUploadScenario(files, uid, currentChatId, handleFileUploads)
    if (!fileResult.success) {
      return fileResult
    }

    // When: Creating optimistic message
    const optimisticAttachments = files.length > 0 ? createOptimisticAttachments(files) : []
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      content: input,
      role: "user",
      createdAt: new Date(),
      experimental_attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    }

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        reasoningEffort,
      },
      experimental_attachments: fileResult.data || undefined,
    }

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      }
    }

  } catch (error) {
    console.error("Message submission error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }
  }
}

/**
 * BDD Scenario: "Given files selected, When uploading, Then validate and process"
 * 
 * Handles file upload validation and processing
 */
export async function handleFileUploadScenario(
  files: File[],
  uid: string,
  chatId: string,
  handleFileUploads: (uid: string, chatId: string) => Promise<Attachment[] | null>
): Promise<OperationResult<Attachment[] | null>> {
  
  if (files.length === 0) {
    return { success: true, data: [] }
  }

  try {
    // Given: Files are selected for upload
    // When: Processing file uploads
    const attachments = await handleFileUploads(uid, chatId)
    
    if (attachments === null) {
      // Then: Upload failed
      return { success: false, error: "File upload failed" }
    }

    // Then: Upload succeeded
    return { success: true, data: attachments }
  } catch (error) {
    console.error("File upload error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "File upload failed" 
    }
  }
}

/**
 * BDD Scenario: "Given user action, When checking limits, Then enforce rate limits"
 * 
 * Validates user rate limits and permissions
 */
export async function validateUserLimitsScenario(
  uid: string,
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
): Promise<OperationResult> {
  try {
    // Given: User wants to perform an action
    // When: Checking rate limits
    const allowed = await checkLimitsAndNotify(uid)
    
    if (!allowed) {
      // Then: User has exceeded limits
      return { success: false, error: "Rate limit exceeded" }
    }

    // Then: User is within limits
    return { success: true }
  } catch (error) {
    console.error("Limit validation error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Limit validation failed" 
    }
  }
}

/**
 * BDD Scenario: "Given message input, When validating, Then check constraints"
 * 
 * Validates message input against business rules
 */
export function validateMessageInput(input: string): OperationResult {
  // Given: User has provided message input
  // When: Validating input length
  if (input.length > MESSAGE_MAX_LENGTH) {
    // Then: Input exceeds maximum length
    return { 
      success: false, 
      error: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)` 
    }
  }

  if (input.trim().length === 0) {
    // Then: Input is empty
    return { 
      success: false, 
      error: "Message cannot be empty" 
    }
  }

  // Then: Input is valid
  return { success: true }
}

/**
 * BDD Scenario: "Given suggestion text, When submitting, Then validate and send"
 * 
 * Handles suggestion submission with simpler validation
 */
export async function submitSuggestionScenario(
  suggestion: string,
  context: Omit<MessageSubmissionContext, 'input' | 'files'>,
  dependencies: Pick<ChatOperationDependencies, 'checkLimitsAndNotify' | 'ensureChatExists'>
): Promise<OperationResult<{
  chatId: string
  requestOptions: any
  optimisticMessage: OptimisticMessageData
}>> {
  const { user, selectedModel, isAuthenticated, reasoningEffort } = context
  const { checkLimitsAndNotify, ensureChatExists } = dependencies

  try {
    // Given: User wants to submit a suggestion
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(uid, checkLimitsAndNotify)
    if (!limitResult.success) {
      return limitResult
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, suggestion)
    if (!currentChatId) {
      return { success: false, error: "Failed to create or access chat" }
    }

    // When: Creating optimistic message for suggestion
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      content: suggestion,
      role: "user",
      createdAt: new Date(),
    }

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    }

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      }
    }

  } catch (error) {
    console.error("Suggestion submission error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }
  }
}

/**
 * BDD Scenario: "Given chat reload request, When preparing, Then validate and setup"
 * 
 * Prepares chat reload with proper context
 */
export async function prepareReloadScenario(
  context: {
    user: UserProfile | null
    chatId: string | null
    selectedModel: string
    isAuthenticated: boolean
    systemPrompt?: string
    reasoningEffort: 'low' | 'medium' | 'high'
  }
): Promise<OperationResult<{ requestOptions: any }>> {
  const { user, chatId, selectedModel, isAuthenticated, systemPrompt, reasoningEffort } = context

  try {
    // Given: User wants to reload chat
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Preparing reload options
    const requestOptions = {
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    }

    // Then: Return prepared options
    return {
      success: true,
      data: { requestOptions }
    }

  } catch (error) {
    console.error("Reload preparation error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Reload preparation failed" 
    }
  }
}

/**
 * Centralized error handling for chat operations
 */
export function handleChatError(error: Error, context: string = "Chat operation") {
  console.error(`${context} error:`, error)
  console.error("Error message:", error.message)
  
  let errorMsg = error.message || "Something went wrong."
  
  if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
    errorMsg = "Something went wrong. Please try again."
  }
  
  toast({
    title: errorMsg,
    status: "error",
  })
}