import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { UIMessage as Message } from '@ai-sdk/react'
import type { Chats } from '@/lib/types/index'
import { get, set as idbSet, del } from 'idb-keyval'

interface ChatState {
  chats: Chats[]
  messagesByChatId: Record<string, Message[]>
  currentChatId: string | null
  isLoading: boolean
  error: string | null
}

interface ChatActions {
  setChats: (chats: Chats[]) => void
  addChat: (chat: Chats) => void
  updateChat: (id: string, updates: Partial<Chats>) => void
  deleteChat: (id: string) => void
  setMessages: (chatId: string, messages: Message[]) => void
  addMessage: (chatId: string, message: Message) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (chatId: string, messageId: string) => void
  setCurrentChatId: (id: string | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  bumpChat: (id: string) => void
}

type ChatStore = ChatState & ChatActions

const initialState: ChatState = {
  chats: [],
  messagesByChatId: {},
  currentChatId: null,
  isLoading: false,
  error: null,
}

export const useChatStore = create<ChatStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          ...initialState,
          
          setChats: (chats) =>
            set((state) => {
              const ts = (c: Chats) => Date.parse(c.updated_at ?? c.created_at ?? 0) || 0
              state.chats = [...chats].sort((a, b) => ts(b) - ts(a))
              state.error = null
            }),
          
          addChat: (chat) =>
            set((state) => {
              if (!state.chats.some((c) => c.id === chat.id)) {
                state.chats.unshift(chat)
              }
            }),
          
          updateChat: (id, updates) =>
            set((state) => {
              const chatIndex = state.chats.findIndex((c) => c.id === id)
              if (chatIndex !== -1) {
                Object.assign(state.chats[chatIndex], updates)
              }
            }),
          
          deleteChat: (id) =>
            set((state) => {
              state.chats = state.chats.filter((c) => c.id !== id)
              delete state.messagesByChatId[id]
              if (state.currentChatId === id) {
                state.currentChatId = null
              }
            }),
          
          setMessages: (chatId, messages) =>
            set((state) => {
              state.messagesByChatId[chatId] = messages
            }),
          
          addMessage: (chatId, message) =>
            set((state) => {
              const messages = state.messagesByChatId[chatId] || []
              state.messagesByChatId[chatId] = [...messages, message]
            }),
          
          updateMessage: (chatId, messageId, updates) =>
            set((state) => {
              const messages = state.messagesByChatId[chatId]
              if (messages) {
                const messageIndex = messages.findIndex((m) => m.id === messageId)
                if (messageIndex !== -1) {
                  Object.assign(messages[messageIndex], updates)
                }
              }
            }),
          
          deleteMessage: (chatId, messageId) =>
            set((state) => {
              const messages = state.messagesByChatId[chatId]
              if (messages) {
                state.messagesByChatId[chatId] = messages.filter((m) => m.id !== messageId)
              }
            }),
          
          setCurrentChatId: (id) =>
            set((state) => {
              state.currentChatId = id
            }),
          
          setLoading: (isLoading) =>
            set((state) => {
              state.isLoading = isLoading
            }),
          
          setError: (error) =>
            set((state) => {
              state.error = error
              state.isLoading = false
            }),
          
          reset: () => set(initialState),
          
          bumpChat: (id) =>
            set((state) => {
              const chatIndex = state.chats.findIndex((c) => c.id === id)
              if (chatIndex !== -1) {
                state.chats[chatIndex].updated_at = new Date().toISOString()
                const ts = (c: Chats) => Date.parse(c.updated_at ?? c.created_at ?? 0) || 0
                state.chats.sort((a, b) => ts(b) - ts(a))
              }
            }),
        })),
        {
          name: 'chat-store',
          storage: createJSONStorage(() => ({
            getItem: (name) => get(name),
            setItem: (name, value) => idbSet(name, value),
            removeItem: (name) => del(name),
          })),
          partialize: (state) => ({
            chats: state.chats,
            messagesByChatId: state.messagesByChatId,
            currentChatId: state.currentChatId,
          }),
        }
      )
    ),
    {
      name: 'chat-store',
    }
  )
)

export const chatStoreSelectors = {
  chats: (state: ChatStore) => state.chats,
  messagesByChatId: (state: ChatStore) => state.messagesByChatId,
  currentChatId: (state: ChatStore) => state.currentChatId,
  currentMessages: (state: ChatStore) =>
    state.currentChatId ? state.messagesByChatId[state.currentChatId] || [] : [],
  isLoading: (state: ChatStore) => state.isLoading,
  error: (state: ChatStore) => state.error,
  getChatById: (id: string) => (state: ChatStore) => 
    state.chats.find((c) => c.id === id),
}