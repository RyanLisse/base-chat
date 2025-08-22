import { useCallback, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage as Message } from '@ai-sdk/react'
import { useChatStore } from '@/lib/stores/chat-store'
import { storage } from '@/lib/storage/local-storage'
import { toast } from '@/components/ui/toast'

interface UseOptimizedChatOptions {
  chatId: string | null
  userId: string | null
  initialMessages?: Message[]
  systemPrompt?: string
  selectedModel?: string
  onFinish?: (message: Message) => void
  onError?: (error: Error) => void
}

const DRAFT_STORAGE_KEY = (chatId: string | null) => `chat-draft-${chatId || 'new'}`
const MESSAGE_CACHE_KEY = (chatId: string) => `messages-${chatId}`

export function useOptimizedChat({
  chatId,
  userId,
  initialMessages = [],
  systemPrompt,
  selectedModel = 'gpt-4',
  onFinish,
  onError,
}: UseOptimizedChatOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const { addMessage } = useChatStore()
  
  const getDraftFromStorage = useCallback(async () => {
    try {
      const draft = await storage.getItem<string>(DRAFT_STORAGE_KEY(chatId))
      return draft || ''
    } catch {
      return ''
    }
  }, [chatId])
  
  const saveDraftToStorage = useCallback(
    async (draft: string) => {
      try {
        if (draft.trim()) {
          await storage.setItem(DRAFT_STORAGE_KEY(chatId), draft, 1000 * 60 * 60 * 24)
        } else {
          await storage.removeItem(DRAFT_STORAGE_KEY(chatId))
        }
      } catch (error) {
        console.error('Failed to save draft:', error)
      }
    },
    [chatId]
  )
  
  const clearDraft = useCallback(async () => {
    await storage.removeItem(DRAFT_STORAGE_KEY(chatId))
  }, [chatId])
  
  const {
    messages,
    input,
    handleSubmit: baseHandleSubmit,
    status,
    error,
    reload,
    stop,
    setMessages,
    setInput,
    sendMessage,
  } = useChat({
    api: '/api/chat',
    initialMessages,
    onFinish: async (message) => {
      setIsSubmitting(false)
      
      if (chatId) {
        addMessage(chatId, message)
        await storage.setItem(MESSAGE_CACHE_KEY(chatId), messages, 1000 * 60 * 5)
      }
      
      onFinish?.(message)
    },
    onError: (error) => {
      setIsSubmitting(false)
      toast({ title: error.message, status: 'error' })
      onError?.(error)
    },
    body: {
      chatId,
      userId,
      model: selectedModel,
      systemPrompt,
      enableSearch,
    },
  })
  
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current)
      }
      
      submitTimeoutRef.current = setTimeout(() => {
        saveDraftToStorage(value)
      }, 500)
    },
    [setInput, saveDraftToStorage]
  )
  
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      
      if (!input.trim() && files.length === 0) return
      if (isSubmitting) return
      
      setIsSubmitting(true)
      clearDraft()
      
      try {
        let attachments: Array<{ name: string; contentType: string; url: string; size: number }> = []
        
        if (files.length > 0) {
          attachments = await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              contentType: file.type,
              url: URL.createObjectURL(file),
              size: file.size,
            }))
          )
        }
        
        const optimisticMessage: Message = {
          id: `optimistic-${Date.now()}`,
          role: 'user',
          content: input,
          createdAt: new Date(),
          ...(attachments.length > 0 && { experimental_attachments: attachments }),
        }
        
        setMessages((prev) => [...prev, optimisticMessage])
        setInput('')
        setFiles([])
        
        try {
          await baseHandleSubmit(e, {
            experimental_attachments: attachments,
          })
        } finally {
          // Revoke object URLs
          for (const a of attachments) {
            try { URL.revokeObjectURL(a.url) } catch {}
          }
        }
      } catch (error) {
        setIsSubmitting(false)
        console.error('Submit error:', error)
      }
    },
    [input, files, isSubmitting, clearDraft, baseHandleSubmit, setMessages, setInput]
  )
  
  const handleStop = useCallback(() => {
    stop()
    setIsSubmitting(false)
  }, [stop])
  
  const handleReload = useCallback(async () => {
    if (messages.length === 0) return
    
    setIsSubmitting(true)
    try {
      await reload()
    } finally {
      setIsSubmitting(false)
    }
  }, [messages.length, reload])
  
  const canSubmit = useMemo(
    () => !isSubmitting && (input.trim().length > 0 || files.length > 0),
    [isSubmitting, input, files.length]
  )
  
  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    handleReload,
    handleStop,
    status,
    error,
    isSubmitting,
    canSubmit,
    files,
    setFiles,
    enableSearch,
    setEnableSearch,
    sendMessage,
    setMessages,
  }
}