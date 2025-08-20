import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// Mock idb-keyval storage before importing the store to avoid IndexedDB dependency
const memoryStore = new Map<string, string>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => memoryStore.get(k),
  set: async (k: string, v: string) => void memoryStore.set(k, v),
  del: async (k: string) => void memoryStore.delete(k),
}))

type ChatStoreModule = typeof import('../..//lib/stores/chat-store')
let chatStoreModule: ChatStoreModule

beforeAll(async () => {
  chatStoreModule = await import('../../lib/stores/chat-store')
})

const makeChat = (id: string, created?: string, updated?: string) => ({
  id,
  created_at: created,
  updated_at: updated,
} as any)

afterEach(() => {
  chatStoreModule.useChatStore.getState().reset()
  memoryStore.clear()
})

describe('stores/chat-store', () => {
  it('setChats sorts by updated_at then created_at desc', () => {
    const { setChats } = chatStoreModule.useChatStore.getState()
    const now = new Date()
    const t = (d: number) => new Date(now.getTime() + d * 1_000).toISOString()
    setChats([
      makeChat('a', t(0), t(1)), // updated 1
      makeChat('b', t(2), t(2)), // updated 2
      makeChat('c', t(3), undefined), // created 3
      makeChat('d', t(1), t(1)), // updated 1
    ])
    const chats = chatStoreModule.chatStoreSelectors.chats(chatStoreModule.useChatStore.getState())
    expect(chats.map(c => c.id)).toEqual(['c', 'b', 'a', 'd']) // c has highest created when no updated
  })

  it('addChat inserts when unique and updateChat mutates existing', () => {
    const store = chatStoreModule.useChatStore.getState()
    store.addChat(makeChat('x'))
    store.addChat(makeChat('x'))
    expect(store.chats.length).toBe(1)
    store.updateChat('x', { title: 'Hello' } as any)
    expect(store.chats[0]).toMatchObject({ id: 'x', title: 'Hello' })
  })

  it('deleteChat removes chat, messages and resets currentChatId if needed', () => {
    const store = chatStoreModule.useChatStore.getState()
    store.setChats([makeChat('x'), makeChat('y')])
    store.setCurrentChatId('x')
    store.setMessages('x', [{ id: 'm1', role: 'user', content: 'hi' }] as any)
    store.deleteChat('x')
    expect(store.chats.map(c => c.id)).toEqual(['y'])
    expect(store.messagesByChatId['x']).toBeUndefined()
    expect(store.currentChatId).toBeNull()
  })

  it('message operations add/update/delete correctly', () => {
    const store = chatStoreModule.useChatStore.getState()
    store.setMessages('x', [])
    store.addMessage('x', { id: 'm1', role: 'user', content: 'hi' } as any)
    store.addMessage('x', { id: 'm2', role: 'assistant', content: 'hey' } as any)

    store.updateMessage('x', 'm2', { content: 'hey there' } as any)
    expect(store.messagesByChatId['x'][1]).toMatchObject({ id: 'm2', content: 'hey there' })

    store.deleteMessage('x', 'm1')
    expect(store.messagesByChatId['x'].map(m => m.id)).toEqual(['m2'])
  })

  it('bumpChat updates timestamp and moves chat to top', () => {
    const store = chatStoreModule.useChatStore.getState()
    const now = new Date().toISOString()
    store.setChats([
      { id: 'a', updated_at: now } as any,
      { id: 'b', updated_at: now } as any,
    ])
    store.bumpChat('b')
    const ids = store.chats.map(c => c.id)
    expect(ids[0]).toBe('b')
  })

  it('selectors: currentMessages and getChatById work', () => {
    const store = chatStoreModule.useChatStore.getState()
    store.setChats([{ id: 'c1' } as any])
    store.setMessages('c1', [{ id: 'm1' } as any])
    store.setCurrentChatId('c1')

    const currentMessages = chatStoreModule.chatStoreSelectors.currentMessages(
      chatStoreModule.useChatStore.getState()
    )
    expect(currentMessages.map(m => m.id)).toEqual(['m1'])

    const c1 = chatStoreModule.chatStoreSelectors.getChatById('c1')(
      chatStoreModule.useChatStore.getState()
    )
    expect(c1?.id).toBe('c1')
  })
})
