"use client"

import { useChatsQuery, useMessagesQuery } from '@/lib/hooks/use-chat-query'
import { useChatStore, chatStoreSelectors } from '@/lib/stores/chat-store'
import type { Chats } from '@/lib/types/index'
import type { Message } from '@ai-sdk/react'
import { createContext, useContext, ReactNode, useMemo } from 'react'

interface ChatContextType {
  chats: Chats[]
  messages: Message[]
  currentChatId: string | null
  isLoadingChats: boolean
  isLoadingMessages: boolean
  error: Error | null
  createChat: (data: {
    userId: string
    title?: string
    model?: string
    systemPrompt?: string
  }) => void
  updateTitle: (chatId: string, title: string) => void
  deleteChat: (chatId: string) => void
  setCurrentChatId: (id: string | null) => void
  getChatById: (id: string) => Chats | undefined
  bumpChat: (id: string) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function OptimizedChatProvider({
  children,
  userId,
}: {
  children: ReactNode
  userId?: string
}) {
  const currentChatId = useChatStore(chatStoreSelectors.currentChatId)
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId)
  const bumpChat = useChatStore((state) => state.bumpChat)
  const storeChats = useChatStore(chatStoreSelectors.chats)
  const storeMessages = useChatStore((state) => 
    currentChatId ? state.messages.get(currentChatId) || [] : []
  )
  
  const {
    chats: queryChats,
    isLoading: isLoadingChats,
    error: chatsError,
    createChat,
    updateTitle,
    deleteChat: deleteChatMutation,
  } = useChatsQuery(userId)
  
  const {
    messages: queryMessages,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useMessagesQuery(currentChatId)
  
  const chats = queryChats ?? storeChats
  const messages = queryMessages ?? storeMessages
  
  const getChatById = useMemo(
    () => (id: string) => chats.find((c) => c.id === id),
    [chats]
  )
  
  const handleDeleteChat = (chatId: string) => {
    deleteChatMutation(chatId)
    if (chatId === currentChatId) {
      setCurrentChatId(null)
    }
  }
  
  const contextValue: ChatContextType = {
    chats,
    messages,
    currentChatId,
    isLoadingChats,
    isLoadingMessages,
    error: chatsError || messagesError,
    createChat,
    updateTitle: (chatId, title) => updateTitle({ chatId, title }),
    deleteChat: handleDeleteChat,
    setCurrentChatId,
    getChatById,
    bumpChat,
  }
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

export function useOptimizedChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useOptimizedChat must be used within OptimizedChatProvider')
  }
  return context
}