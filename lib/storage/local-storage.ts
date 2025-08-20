import { get, set, del, clear, keys } from 'idb-keyval'

interface StorageOptions {
  fallbackToLocalStorage?: boolean
  encrypt?: boolean
  ttl?: number // Time to live in milliseconds
}

interface StoredItem<T> {
  value: T
  timestamp: number
  ttl?: number
}

class StorageManager {
  private fallbackToLocalStorage: boolean
  private encrypt: boolean

  constructor(options: StorageOptions = {}) {
    this.fallbackToLocalStorage = options.fallbackToLocalStorage ?? true
    this.encrypt = options.encrypt ?? false
  }

  private isExpired<T>(item: StoredItem<T>): boolean {
    if (!item.ttl) return false
    return Date.now() - item.timestamp > item.ttl
  }

  private async encryptData(data: string): Promise<string> {
    if (!this.encrypt || typeof window === 'undefined') return data
    
    try {
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)
      
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      )
      
      const exportedKey = await window.crypto.subtle.exportKey('raw', key)
      const keyArray = new Uint8Array(exportedKey)
      
      const combined = new Uint8Array(
        keyArray.length + iv.length + encryptedData.byteLength
      )
      combined.set(keyArray, 0)
      combined.set(iv, keyArray.length)
      combined.set(new Uint8Array(encryptedData), keyArray.length + iv.length)
      
      return btoa(String.fromCharCode.apply(null, Array.from(combined)))
    } catch (error) {
      console.error('Encryption failed:', error)
      return data
    }
  }

  private async decryptData(encryptedData: string): Promise<string> {
    if (!this.encrypt || typeof window === 'undefined') return encryptedData
    
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map((c) => c.charCodeAt(0))
      )
      
      const keyArray = combined.slice(0, 32)
      const iv = combined.slice(32, 44)
      const encrypted = combined.slice(44)
      
      const key = await window.crypto.subtle.importKey(
        'raw',
        keyArray,
        'AES-GCM',
        false,
        ['decrypt']
      )
      
      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      )
      
      const decoder = new TextDecoder()
      return decoder.decode(decryptedData)
    } catch (error) {
      console.error('Decryption failed:', error)
      return encryptedData
    }
  }

  async setItem<T>(key: string, value: T, ttl?: number): Promise<void> {
    const item: StoredItem<T> = {
      value,
      timestamp: Date.now(),
      ttl,
    }

    const serialized = JSON.stringify(item)
    const data = this.encrypt ? await this.encryptData(serialized) : serialized

    try {
      await set(key, data)
    } catch (error) {
      if (this.fallbackToLocalStorage && typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, data)
        } catch (localStorageError) {
          console.error('Both IndexedDB and localStorage failed:', error, localStorageError)
          throw error
        }
      } else {
        throw error
      }
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      let data = await get(key)
      
      if (!data && this.fallbackToLocalStorage && typeof window !== 'undefined') {
        data = localStorage.getItem(key)
      }

      if (!data) return null

      const decrypted = this.encrypt ? await this.decryptData(data as string) : data
      const item: StoredItem<T> = JSON.parse(decrypted as string)

      if (this.isExpired(item)) {
        await this.removeItem(key)
        return null
      }

      return item.value
    } catch (error) {
      console.error('Failed to get item:', error)
      return null
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await del(key)
    } catch (error) {
      console.error('Failed to remove from IndexedDB:', error)
    }

    if (this.fallbackToLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('Failed to remove from localStorage:', error)
      }
    }
  }

  async clear(): Promise<void> {
    try {
      await clear()
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error)
    }

    if (this.fallbackToLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.clear()
      } catch (error) {
        console.error('Failed to clear localStorage:', error)
      }
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const idbKeys = await keys()
      
      if (this.fallbackToLocalStorage && typeof window !== 'undefined') {
        const localKeys = Object.keys(localStorage)
        const allKeys = new Set([...idbKeys.map(String), ...localKeys])
        return Array.from(allKeys)
      }
      
      return idbKeys.map(String)
    } catch (error) {
      console.error('Failed to get keys:', error)
      return []
    }
  }

  async getSize(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return estimate.usage || 0
      }
      return 0
    } catch (error) {
      console.error('Failed to get storage size:', error)
      return 0
    }
  }

  async persist(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist()
    }
    return false
  }
}

export const storage = new StorageManager({ fallbackToLocalStorage: true })
export const secureStorage = new StorageManager({ 
  fallbackToLocalStorage: true, 
  encrypt: true 
})

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 1000 * 60 * 5 // 5 minutes default
): Promise<T> {
  const cached = await storage.getItem<T>(key)
  if (cached !== null) {
    return cached
  }

  const fresh = await fetcher()
  await storage.setItem(key, fresh, ttl)
  return fresh
}

export async function invalidateCache(pattern?: string): Promise<void> {
  if (!pattern) {
    await storage.clear()
    return
  }

  const allKeys = await storage.getAllKeys()
  const keysToDelete = allKeys.filter((key) => key.includes(pattern))
  
  await Promise.all(keysToDelete.map((key) => storage.removeItem(key)))
}