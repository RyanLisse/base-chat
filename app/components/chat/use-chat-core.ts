import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import type { UIMessage as Message } from "@ai-sdk/react"
import { useChat } from "@ai-sdk/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  submitMessageScenario,
  submitSuggestionScenario,
  prepareReloadScenario,
  handleChatError,
  type ChatOperationDependencies,
  type MessageSubmissionContext,
} from "./chat-business-logic"

type UseChatCoreProps = {
  initialMessages: Message[]
  draftValue: string
  cacheAndAddMessage: (message: Message) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  checkLimitsAndNotify,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium')

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Handle errors using extracted error handler
  const handleError = useCallback((error: Error) => {
    handleChatError(error, "Chat")
  }, [])

  // Initialize useChat
  // Manage input state separately for v5
  const [inputValue, setInputValue] = useState(draftValue)
  
  const {
    messages,
    input,
    status,
    error,
    reload,
    stop,
    setMessages,
    sendMessage,
  } = useChat({
    api: API_ROUTE_CHAT,
    initialMessages,
    initialInput: draftValue,
    onFinish: cacheAndAddMessage,
    onError: handleError,
  })

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInputValue(prompt))
    }
  }, [prompt, setInputValue])

  // Reset messages when navigating from a chat to home
  if (
    prevChatIdRef.current !== null &&
    chatId === null &&
    messages.length > 0
  ) {
    setMessages([])
  }
  prevChatIdRef.current = chatId

  // Prepare operation dependencies for BDD scenarios
  const operationDependencies: ChatOperationDependencies = useMemo(() => ({
    checkLimitsAndNotify,
    ensureChatExists,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
  }), [checkLimitsAndNotify, ensureChatExists, handleFileUploads, createOptimisticAttachments, cleanupOptimisticAttachments])

  // Submit action using BDD-style operations
  const submit = useCallback(async () => {
    setIsSubmitting(true)

    const currentInput = inputValue
    const submittedFiles = [...files]
    
    // Clear input immediately for better UX
    setInputValue("")
    setFiles([])

    try {
      // Use BDD scenario for message submission
      const context: MessageSubmissionContext = {
        input: currentInput,
        files: submittedFiles,
        user,
        selectedModel,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        reasoningEffort,
        chatId,
      }

      const result = await submitMessageScenario(context, operationDependencies)

      if (!result.success) {
        // Handle operation failure - restore input
        setInputValue(currentInput)
        setFiles(submittedFiles)
        
        if (result.error) {
          toast({ title: result.error, status: "error" })
        }
        return
      }

      // Operation succeeded - proceed with submission
      const { chatId: currentChatId, requestOptions } = result.data!

      // In v5, use sendMessage which handles everything including optimistic updates
      // v5 expects an object with text property
      await sendMessage({ text: currentInput }, requestOptions)
      
      clearDraft()

      // Bump chat if there were previous messages
      if (messages.length > 0) {
        bumpChat(currentChatId)
      }

    } catch (error) {
      // Handle unexpected errors - restore input
      setInputValue(currentInput)
      setFiles(submittedFiles)
      handleChatError(error as Error, "Message submission")
    } finally {
      setIsSubmitting(false)
    }
  }, [
    inputValue,
    files,
    user,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    reasoningEffort,
    chatId,
    operationDependencies,
    createOptimisticAttachments,
    setMessages,
    setInputValue,
    setFiles,
    cleanupOptimisticAttachments,
    sendMessage,
    cacheAndAddMessage,
    clearDraft,
    messages.length,
    bumpChat,
  ])

  // Handle suggestion using BDD-style operations
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)

      try {
        // Use BDD scenario for suggestion submission
        const context = {
          user,
          selectedModel,
          isAuthenticated,
          reasoningEffort,
          chatId,
          enableSearch,
          systemPrompt,
        }

        const dependencies = {
          checkLimitsAndNotify,
          ensureChatExists,
        }

        const result = await submitSuggestionScenario(suggestion, context, dependencies)

        if (!result.success) {
          if (result.error) {
            toast({ title: result.error, status: "error" })
          }
          return
        }

        // Operation succeeded - proceed with sendMessage
        const { requestOptions } = result.data!

        // v5 sendMessage expects an object with text property for proper formatting
        await sendMessage({ text: suggestion }, requestOptions)

      } catch (error) {
        handleChatError(error as Error, "Suggestion submission")
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      user,
      selectedModel,
      isAuthenticated,
      reasoningEffort,
      chatId,
      enableSearch,
      systemPrompt,
      checkLimitsAndNotify,
      ensureChatExists,
      sendMessage,
      setMessages,
    ]
  )

  // Handle reload using BDD-style operations
  const handleReload = useCallback(async () => {
    try {
      // Use BDD scenario for reload preparation
      const context = {
        user,
        chatId,
        selectedModel,
        isAuthenticated,
        systemPrompt,
        reasoningEffort,
      }

      const result = await prepareReloadScenario(context)

      if (!result.success) {
        if (result.error) {
          toast({ title: result.error, status: "error" })
        }
        return
      }

      // Proceed with reload using prepared options
      reload(result.data!.requestOptions)

    } catch (error) {
      handleChatError(error as Error, "Chat reload")
    }
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, reasoningEffort, reload])

  // Handle input change - manage input state locally for v5
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
      setDraftValue(value)
    },
    [setInputValue, setDraftValue]
  )

  return {
    // Chat state
    messages,
    input: inputValue,
    status,
    error,
    reload,
    stop,
    setMessages,
    setInput: setInputValue,
    sendMessage,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,
    reasoningEffort,
    setReasoningEffort,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  }
}
