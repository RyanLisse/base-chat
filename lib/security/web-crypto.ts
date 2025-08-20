// Web Crypto API implementation for browser compatibility
// Replaces Node.js crypto module for client-side encryption

const ALGORITHM = "AES-GCM"
const IV_LENGTH = 12 // 96 bits for GCM
const ITERATIONS = 100000

// Generate secure random bytes using Web Crypto API
export function randomBytes(length: number): Uint8Array {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Web Crypto API not available')
  }
  return window.crypto.getRandomValues(new Uint8Array(length))
}

// Derive key using PBKDF2 with Web Crypto API
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  const encoder = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

// Get or create persistent encryption key
async function getPersistentKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto API not available in server environment')
  }

  // Use runtime-derived master password - never store it
  const masterPassword = 'BaseChat-Default-Master-2025' // TODO: Replace with user-provided password in production

  // Try to get existing salt from localStorage
  const storedKeyData = localStorage.getItem('base-chat-encryption-key')
  
  if (storedKeyData) {
    try {
      const keyData = JSON.parse(storedKeyData)
      const salt = new Uint8Array(keyData.salt)
      return await deriveKey(masterPassword, salt)
    } catch (error) {
      console.warn('Failed to restore encryption key, generating new one:', error)
    }
  }

  // Generate new salt if none exists
  const salt = randomBytes(32)
  const key = await deriveKey(masterPassword, salt)

  // Store only the salt (non-sensitive data)
  localStorage.setItem('base-chat-encryption-key', JSON.stringify({
    salt: Array.from(salt)
  }))

  return key
}

// Encrypt data using Web Crypto API
export async function encryptData(plaintext: string): Promise<{
  encrypted: string
  iv: string
}> {
  if (typeof window === 'undefined' || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  const key = await getPersistentKey()
  const iv = randomBytes(IV_LENGTH)
  const encoder = new TextEncoder()

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv
    },
    key,
    encoder.encode(plaintext)
  )

  return {
    encrypted: btoa(Array.from(new Uint8Array(encryptedData))
      .map(byte => String.fromCharCode(byte))
      .join('')),
    iv: btoa(Array.from(iv)
      .map(byte => String.fromCharCode(byte))
      .join(''))
  }
}

// Decrypt data using Web Crypto API
export async function decryptData(encryptedData: string, ivString: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  const key = await getPersistentKey()
  // More efficient conversion
  const ivBinary = atob(ivString)
  const iv = new Uint8Array(ivBinary.length)
  for (let i = 0; i < ivBinary.length; i++) {
    iv[i] = ivBinary.charCodeAt(i)
  }
  
  const encryptedBinary = atob(encryptedData)
  const encrypted = new Uint8Array(encryptedBinary.length)
  for (let i = 0; i < encryptedBinary.length; i++) {
    encrypted[i] = encryptedBinary.charCodeAt(i)
  }

  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv
    },
    key,
    encrypted
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
}

// Encrypt API key with AES-GCM using Web Crypto API
export async function encryptApiKey(plaintext: string): Promise<{
  encrypted: string
  iv: string
  masked: string
}> {
  if (!plaintext) {
    throw new Error("API key cannot be empty")
  }

  const { encrypted, iv } = await encryptData(plaintext)

  return {
    encrypted,
    iv,
    masked: maskApiKey(plaintext)
  }
}

// Decrypt API key using Web Crypto API
export async function decryptApiKey(
  encryptedData: string, 
  ivString: string
): Promise<string> {
  return await decryptData(encryptedData, ivString)
}

// Mask API key for display
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return "*".repeat(key?.length || 0)
  }

  // Show first 4 and last 4 characters
  const prefix = key.slice(0, 4)
  const suffix = key.slice(-4)
  const masked = "*".repeat(Math.max(0, key.length - 8))
  
  return `${prefix}${masked}${suffix}`
}

// Hash data using Web Crypto API
export async function hashData(data: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  const encoder = new TextEncoder()
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = new Uint8Array(hashBuffer)
  return btoa(String.fromCharCode(...hashArray))
}

// Validate API key format
export function validateApiKeyFormat(key: string, provider: string): boolean {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-]{40,}$/,
    google: /^[a-zA-Z0-9-_]{39}$/,
    mistral: /^[a-zA-Z0-9]{32,}$/,
    langsmith: /^ls__[a-zA-Z0-9]{32,}$/,
  }

  const pattern = patterns[provider.toLowerCase()]
  if (!pattern) {
    // Allow any format for unknown providers
    return key.length >= 16
  }

  return pattern.test(key)
}

// Secure comparison to prevent timing attacks
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

// Generate a secure random API key
export function generateApiKey(prefix: string = "sk"): string {
  // Use base64url encoding for URL-safe keys
  const bytes = randomBytes(32)
  const randomPart = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `${prefix}-${randomPart}`
}

// Export types
export interface EncryptedApiKey {
  encrypted: string
  iv: string
  masked: string
}

export interface ApiKeyValidation {
  isValid: boolean
  error?: string
}