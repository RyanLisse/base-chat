import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useChatStore } from '@/lib/stores/chat-store'
import type { Chats } from '@/lib/types/index'
import type { Message } from '@ai-sdk/react'

const CHATS_QUERY_KEY = ['chats'] as const
const MESSAGES_QUERY_KEY = (chatId: string) => ['messages', chatId] as const

async function fetchChats(userId: string): Promise<Chats[]> {
  const response = await fetch(`/api/chats?userId=${userId}`)
  if (!response.ok) throw new Error('Failed to fetch chats')
  return response.json()
}

async function fetchMessages(chatId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages/${chatId}`)
  if (!response.ok) throw new Error('Failed to fetch messages')
  return response.json()
}

async function createChat(data: {
  userId: string
  title?: string
  model?: string
  systemPrompt?: string
}): Promise<Chats> {
  const response = await fetch('/api/create-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to create chat')
  return response.json()
}

async function updateChatTitle(chatId: string, title: string): Promise<void> {
  const response = await fetch(`/api/chats/${chatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error('Failed to update chat title')
}

async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`/api/chats/${chatId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete chat')
}

export function useChatsQuery(userId?: string) {
  const queryClient = useQueryClient()
  const { setChats, setLoading, setError } = useChatStore()
  
  const query = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: () => fetchChats(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    onSuccess: (data) => {
      setChats(data)
      setLoading(false)
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Unknown error')
    },
  })
  
  const createMutation = useMutation({
    mutationFn: createChat,
    onMutate: async (newChat) => {
      await queryClient.cancelQueries({ queryKey: CHATS_QUERY_KEY })
      const previousChats = queryClient.getQueryData<Chats[]>(CHATS_QUERY_KEY)
      
      const optimisticChat: Chats = {
        id: `temp-${Date.now()}`,
        title: newChat.title || 'New Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        model: newChat.model || 'gpt-4',
        system_prompt: newChat.systemPrompt || '',
        user_id: newChat.userId,
        public: false,
        project_id: null,
      }
      
      if (previousChats) {
        queryClient.setQueryData(CHATS_QUERY_KEY, [optimisticChat, ...previousChats])
      }
      
      return { previousChats }
    },
    onError: (err, newChat, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(CHATS_QUERY_KEY, context.previousChats)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY })
    },
  })
  
  const updateTitleMutation = useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
      updateChatTitle(chatId, title),
    onMutate: async ({ chatId, title }) => {
      await queryClient.cancelQueries({ queryKey: CHATS_QUERY_KEY })
      const previousChats = queryClient.getQueryData<Chats[]>(CHATS_QUERY_KEY)
      
      if (previousChats) {
        const updatedChats = previousChats.map((chat) =>
          chat.id === chatId ? { ...chat, title } : chat
        )
        queryClient.setQueryData(CHATS_QUERY_KEY, updatedChats)
      }
      
      return { previousChats }
    },
    onError: (err, variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(CHATS_QUERY_KEY, context.previousChats)
      }
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: deleteChat,
    onMutate: async (chatId) => {
      await queryClient.cancelQueries({ queryKey: CHATS_QUERY_KEY })
      const previousChats = queryClient.getQueryData<Chats[]>(CHATS_QUERY_KEY)
      
      if (previousChats) {
        const filteredChats = previousChats.filter((chat) => chat.id !== chatId)
        queryClient.setQueryData(CHATS_QUERY_KEY, filteredChats)
      }
      
      return { previousChats }
    },
    onError: (err, chatId, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(CHATS_QUERY_KEY, context.previousChats)
      }
    },
    onSuccess: (data, chatId) => {
      queryClient.removeQueries({ queryKey: MESSAGES_QUERY_KEY(chatId) })
    },
  })
  
  return {
    chats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createChat: createMutation.mutate,
    updateTitle: updateTitleMutation.mutate,
    deleteChat: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateTitleMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}

export function useMessagesQuery(chatId: string | null) {
  const { setMessages, setLoading, setError } = useChatStore()
  
  const query = useQuery({
    queryKey: MESSAGES_QUERY_KEY(chatId!),
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId,
    staleTime: 1000 * 60, // 1 minute
    onSuccess: (data) => {
      if (chatId) {
        setMessages(chatId, data)
        setLoading(false)
      }
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Unknown error')
    },
  })
  
  return {
    messages: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}