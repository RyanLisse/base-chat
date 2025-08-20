import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Message } from '@ai-sdk/react'
import type { Chats } from '@/lib/types/index'
import { get, set as idbSet, del } from 'idb-keyval'

interface ChatState {
  chats: Chats[]
  messages: Map<string, Message[]>
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
  messages: new Map(),
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
              state.chats = chats
              state.error = null
            }),
          
          addChat: (chat) =>
            set((state) => {
              state.chats.unshift(chat)
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
              state.messages.delete(id)
              if (state.currentChatId === id) {
                state.currentChatId = null
              }
            }),
          
          setMessages: (chatId, messages) =>
            set((state) => {
              state.messages.set(chatId, messages)
            }),
          
          addMessage: (chatId, message) =>
            set((state) => {
              const messages = state.messages.get(chatId) || []
              state.messages.set(chatId, [...messages, message])
            }),
          
          updateMessage: (chatId, messageId, updates) =>
            set((state) => {
              const messages = state.messages.get(chatId)
              if (messages) {
                const messageIndex = messages.findIndex((m) => m.id === messageId)
                if (messageIndex !== -1) {
                  Object.assign(messages[messageIndex], updates)
                }
              }
            }),
          
          deleteMessage: (chatId, messageId) =>
            set((state) => {
              const messages = state.messages.get(chatId)
              if (messages) {
                state.messages.set(
                  chatId,
                  messages.filter((m) => m.id !== messageId)
                )
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
                state.chats.sort(
                  (a, b) => 
                    new Date(b.updated_at || '').getTime() - 
                    new Date(a.updated_at || '').getTime()
                )
              }
            }),
        })),
        {
          name: 'chat-store',
          storage: {
            getItem: async (name) => {
              const value = await get(name)
              if (value) {
                const parsed = JSON.parse(value)
                parsed.state.messages = new Map(parsed.state.messages)
                return parsed
              }
              return null
            },
            setItem: async (name, value) => {
              const serializable = {
                ...value,
                state: {
                  ...value.state,
                  messages: Array.from(value.state.messages.entries()),
                },
              }
              await idbSet(name, JSON.stringify(serializable))
            },
            removeItem: async (name) => {
              await del(name)
            },
          },
          partialize: (state) => ({
            chats: state.chats,
            messages: state.messages,
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
  messages: (state: ChatStore) => state.messages,
  currentChatId: (state: ChatStore) => state.currentChatId,
  currentMessages: (state: ChatStore) => 
    state.currentChatId ? state.messages.get(state.currentChatId) || [] : [],
  isLoading: (state: ChatStore) => state.isLoading,
  error: (state: ChatStore) => state.error,
  getChatById: (id: string) => (state: ChatStore) => 
    state.chats.find((c) => c.id === id),
}