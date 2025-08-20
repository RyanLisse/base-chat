"use client"

import { useOptimizedUser } from '@/lib/providers/optimized-user-provider'
import { useOptimizedChat } from '@/lib/providers/optimized-chat-provider'
import { useUserStore } from '@/lib/stores/user-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { apiKeyManager } from '@/lib/api/secure-api-keys'
import { storage, withCache } from '@/lib/storage/local-storage'
import { useState, useCallback, useMemo } from 'react'

export function OptimizedUsageExample() {
  const { user, isLoading, updateUser } = useOptimizedUser()
  const { chats, createChat, currentChatId } = useOptimizedChat()
  
  const isAuthenticated = useUserStore((state) => !!state.user?.id)
  const messages = useChatStore((state) => 
    state.currentChatId ? state.messages.get(state.currentChatId) || [] : []
  )
  
  const [apiKeyProvider, setApiKeyProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  
  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyProvider || !apiKey) return
    
    try {
      await apiKeyManager.addApiKey(apiKeyProvider, apiKey, user?.id)
      setApiKey('')
      console.log('API key saved securely')
    } catch (error) {
      console.error('Failed to save API key:', error)
    }
  }, [apiKeyProvider, apiKey, user?.id])
  
  const fetchDataWithCache = useCallback(async () => {
    const data = await withCache(
      'example-data',
      async () => {
        const response = await fetch('/api/example')
        return response.json()
      },
      1000 * 60 * 5 // 5 minutes cache
    )
    
    return data
  }, [])
  
  const derivedValue = useMemo(() => {
    return chats.filter((chat) => 
      chat.created_at && 
      new Date(chat.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length
  }, [chats])
  
  const handleCreateChat = useCallback(async () => {
    if (!user?.id) return
    
    await createChat({
      userId: user.id,
      title: 'New Optimized Chat',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful assistant.',
    })
  }, [user?.id, createChat])
  
  const handleUpdateProfile = useCallback(async () => {
    await updateUser({
      display_name: 'Updated Name',
      bio: 'Updated bio with optimized state management',
    })
  }, [updateUser])
  
  const handleLocalStorageExample = useCallback(async () => {
    await storage.setItem('example-key', { data: 'example value' }, 1000 * 60)
    
    const retrieved = await storage.getItem('example-key')
    console.log('Retrieved from storage:', retrieved)
  }, [])
  
  if (isLoading) {
    return <div>Loading optimized state...</div>
  }
  
  return (
    <div className="space-y-4 p-4">
      <section>
        <h2 className="text-xl font-bold mb-2">Optimized State Management Example</h2>
        
        <div className="space-y-2">
          <p>User: {user?.display_name || 'Not logged in'}</p>
          <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
          <p>Total chats: {chats.length}</p>
          <p>Recent chats (last 7 days): {derivedValue}</p>
          <p>Current chat: {currentChatId || 'None'}</p>
          <p>Messages in current chat: {messages.length}</p>
        </div>
      </section>
      
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Secure API Key Storage</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Provider (e.g., openai)"
            value={apiKeyProvider}
            onChange={(e) => setApiKeyProvider(e.target.value)}
            className="px-2 py-1 border rounded"
          />
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="px-2 py-1 border rounded"
          />
          <button
            onClick={handleSaveApiKey}
            className="px-4 py-1 bg-primary text-white rounded"
          >
            Save Securely
          </button>
        </div>
      </section>
      
      <section className="flex gap-2">
        <button
          onClick={handleCreateChat}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Create Chat
        </button>
        <button
          onClick={handleUpdateProfile}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Update Profile
        </button>
        <button
          onClick={fetchDataWithCache}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Fetch with Cache
        </button>
        <button
          onClick={handleLocalStorageExample}
          className="px-4 py-2 bg-orange-500 text-white rounded"
        >
          Test LocalStorage
        </button>
      </section>
    </div>
  )
}