import { hashApiKey, verifyApiKey } from '@/lib/security/password-encryption'
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/security/web-crypto'
import { secureStorage } from '@/lib/storage/local-storage'

interface StoredApiKey {
  provider: string
  maskedKey: string
  encryptedKey: string
  iv: string
  hash: string
  salt: string
  isActive: boolean
  lastUsed?: string
  createdAt: string
  updatedAt: string
}

const API_KEYS_STORAGE_KEY = 'secure-api-keys'

export class SecureApiKeyManager {
  private async getStoredKeys(): Promise<StoredApiKey[]> {
    const keys = await secureStorage.getItem<StoredApiKey[]>(API_KEYS_STORAGE_KEY)
    return keys || []
  }

  private async saveKeys(keys: StoredApiKey[]): Promise<void> {
    await secureStorage.setItem(API_KEYS_STORAGE_KEY, keys)
  }

  async addApiKey(provider: string, apiKey: string, userId?: string): Promise<void> {
    if (!provider || !apiKey) {
      throw new Error('Provider and API key are required')
    }

    const keys = await this.getStoredKeys()
    
    const existingIndex = keys.findIndex((k) => k.provider === provider)
    
    const { encrypted, iv, masked } = await encryptApiKey(apiKey)
    const { hash, salt } = await hashApiKey(apiKey)
    
    const newKey: StoredApiKey = {
      provider,
      maskedKey: masked,
      encryptedKey: encrypted,
      iv,
      hash,
      salt,
      isActive: true,
      createdAt: existingIndex >= 0 ? keys[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    if (existingIndex >= 0) {
      keys[existingIndex] = newKey
    } else {
      keys.push(newKey)
    }
    
    await this.saveKeys(keys)
    
    await this.syncWithServer(provider, apiKey, userId)
  }

  async getApiKey(provider: string, userId?: string): Promise<string | null> {
    const keys = await this.getStoredKeys()
    const key = keys.find((k) => k.provider === provider && k.isActive)
    
    if (!key) return null
    
    try {
      const decrypted = await decryptApiKey(
        key.encryptedKey,
        key.iv
      )
      
      key.lastUsed = new Date().toISOString()
      await this.saveKeys(keys)
      
      return decrypted
    } catch (error) {
      console.error('Failed to decrypt API key:', error)
      return null
    }
  }

  async verifyApiKey(provider: string, apiKey: string): Promise<boolean> {
    const keys = await this.getStoredKeys()
    const key = keys.find((k) => k.provider === provider)
    
    if (!key) return false
    
    return await verifyApiKey(apiKey, key.hash, key.salt)
  }

  async removeApiKey(provider: string): Promise<void> {
    const keys = await this.getStoredKeys()
    const filtered = keys.filter((k) => k.provider !== provider)
    await this.saveKeys(filtered)
    
    await this.deleteFromServer(provider)
  }

  async toggleApiKey(provider: string, isActive: boolean): Promise<void> {
    const keys = await this.getStoredKeys()
    const key = keys.find((k) => k.provider === provider)
    
    if (key) {
      key.isActive = isActive
      key.updatedAt = new Date().toISOString()
      await this.saveKeys(keys)
    }
  }

  async listApiKeys(): Promise<Array<{
    provider: string
    maskedKey: string
    isActive: boolean
    lastUsed?: string
    createdAt: string
  }>> {
    const keys = await this.getStoredKeys()
    return keys.map((k) => ({
      provider: k.provider,
      maskedKey: k.maskedKey,
      isActive: k.isActive,
      lastUsed: k.lastUsed,
      createdAt: k.createdAt,
    }))
  }

  async rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<void> {
    await this.addApiKey(provider, newApiKey, userId)
  }

  private async syncWithServer(provider: string, apiKey: string, userId?: string): Promise<void> {
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      })
      
      if (!response.ok) {
        console.error('Failed to sync API key with server')
      }
    } catch (error) {
      console.error('Failed to sync with server:', error)
    }
  }

  private async deleteFromServer(provider: string): Promise<void> {
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      
      if (!response.ok) {
        console.error('Failed to delete API key from server')
      }
    } catch (error) {
      console.error('Failed to delete from server:', error)
    }
  }

  async clearAllKeys(): Promise<void> {
    await secureStorage.removeItem(API_KEYS_STORAGE_KEY)
    
    try {
      const response = await fetch('/api/settings/api-keys/clear', {
        method: 'POST',
      })
      
      if (!response.ok) {
        console.error('Failed to clear API keys from server')
      }
    } catch (error) {
      console.error('Failed to clear from server:', error)
    }
  }
}

export const apiKeyManager = new SecureApiKeyManager()