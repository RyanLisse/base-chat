// Client-side encryption using Web Crypto API
// This file is deprecated - use web-crypto.ts instead for client-side encryption

// Conditional import to prevent errors in browser environment
let crypto: any = null
if (typeof window === 'undefined') {
  try {
    crypto = require('crypto')
  } catch (e) {
    console.warn('Node.js crypto module not available')
  }
}

// Enhanced encryption with multiple layers of security
const ALGORITHM = "aes-256-gcm"
const SALT_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const ITERATIONS = 100000

// Get encryption key from environment (Node.js only)
function getEncryptionKey(): any {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side encryption not available. Use web-crypto.ts for client-side encryption.')
  }

  const masterKey = process.env.ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }

  // Derive key using PBKDF2 for additional security
  const salt = process.env.ENCRYPTION_SALT || "BaseChat-Default-Salt-2025"
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, 32, "sha256")
}

// Encrypt API key with AES-256-GCM (Node.js only)
export function encryptApiKey(plaintext: string, userId?: string): {
  encrypted: string
  iv: string
  authTag: string
  masked: string
} {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side encryption not available. Use web-crypto.ts for client-side encryption.')
  }

  if (!plaintext) {
    throw new Error("API key cannot be empty")
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Add additional authenticated data (AAD) if userId provided
  if (userId) {
    cipher.setAAD(Buffer.from(userId), { plaintextLength: plaintext.length })
  }

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    masked: maskApiKey(plaintext)
  }
}

// Decrypt API key (Node.js only)
export function decryptApiKey(
  encryptedData: string, 
  ivHex: string, 
  authTagHex?: string,
  userId?: string
): string {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side encryption not available. Use web-crypto.ts for client-side encryption.')
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

  // Set auth tag if provided (for GCM mode)
  if (authTagHex && crypto) {
    const authTag = Buffer.from(authTagHex, "hex")
    decipher.setAuthTag(authTag)
  }

  // Add AAD if userId provided
  if (userId) {
    decipher.setAAD(Buffer.from(userId))
  }

  let decrypted = decipher.update(encryptedData, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
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

// Hash API key for comparison without decryption (Node.js only)
export function hashApiKey(key: string, salt?: string): string {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side hashing not available. Use password-encryption.ts for client-compatible hashing.')
  }

  const actualSalt = salt || crypto.randomBytes(16).toString("hex")
  const hash = crypto.pbkdf2Sync(key, actualSalt, ITERATIONS, 64, "sha512")
  return `${actualSalt}:${hash.toString("hex")}`
}

// Verify hashed API key (Node.js only)
export function verifyHashedApiKey(key: string, hashedKey: string): boolean {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side hashing not available. Use password-encryption.ts for client-compatible hashing.')
  }

  const [salt, hash] = hashedKey.split(":")
  if (!salt || !hash) return false

  const computedHash = crypto.pbkdf2Sync(key, salt, ITERATIONS, 64, "sha512")
  return computedHash.toString("hex") === hash
}

// Generate a secure random API key (Node.js only)
export function generateApiKey(prefix: string = "sk"): string {
  if (!crypto || typeof window !== 'undefined') {
    throw new Error('Server-side random generation not available. Use web-crypto.ts for client-side generation.')
  }

  const randomPart = crypto.randomBytes(32).toString("base64url")
  return `${prefix}-${randomPart}`
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

// Rotate encryption key (for key rotation)
export function rotateApiKey(
  oldEncrypted: string,
  oldIv: string,
  oldAuthTag?: string,
  userId?: string
): {
  encrypted: string
  iv: string
  authTag: string
} {
  // Decrypt with old key
  const plaintext = decryptApiKey(oldEncrypted, oldIv, oldAuthTag, userId)
  
  // Re-encrypt with new key
  const { encrypted, iv, authTag } = encryptApiKey(plaintext, userId)
  
  return { encrypted, iv, authTag }
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

// Export types
export interface EncryptedApiKey {
  encrypted: string
  iv: string
  authTag: string
  masked: string
}

export interface ApiKeyValidation {
  isValid: boolean
  error?: string
}