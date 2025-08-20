/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  hashApiKey,
  verifyHashedApiKey,
  generateApiKey,
  validateApiKeyFormat,
  rotateApiKey,
  secureCompare,
} from '@/lib/security/encryption'

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
  process.env.ENCRYPTION_KEY = 'test-master-key-for-testing-purposes-only'
  process.env.ENCRYPTION_SALT = 'test-salt-for-key-derivation-testing'
})

afterEach(() => {
  process.env = originalEnv
})

describe('Encryption Module (Server-side)', () => {
  describe('maskApiKey', () => {
    it('should mask API key correctly for standard length keys', () => {
      const key = 'sk-abcdef1234567890'
      const masked = maskApiKey(key)
      expect(masked).toBe('sk-a********7890')
    })

    it('should handle short keys', () => {
      const key = 'abc'
      const masked = maskApiKey(key)
      expect(masked).toBe('***')
    })

    it('should handle empty keys', () => {
      const masked = maskApiKey('')
      expect(masked).toBe('')
    })

    it('should handle very long keys', () => {
      const key = 'sk-' + 'a'.repeat(100)
      const masked = maskApiKey(key)
      expect(masked).toBe('sk-a' + '*'.repeat(96) + 'aaaa')
    })

    it('should handle exactly 8 character keys', () => {
      const key = 'abcd1234'
      const masked = maskApiKey(key)
      expect(masked).toBe('abcd1234') // No masking needed
    })
  })

  describe('validateApiKeyFormat', () => {
    it('should validate OpenAI API key format', () => {
      const validKey = 'sk-' + 'a'.repeat(50)
      expect(validateApiKeyFormat(validKey, 'openai')).toBe(true)
      
      const invalidKey = 'invalid-key'
      expect(validateApiKeyFormat(invalidKey, 'openai')).toBe(false)
    })

    it('should validate Anthropic API key format', () => {
      const validKey = 'sk-ant-' + 'a'.repeat(50)
      expect(validateApiKeyFormat(validKey, 'anthropic')).toBe(true)
      
      const invalidKey = 'sk-wrong-format'
      expect(validateApiKeyFormat(invalidKey, 'anthropic')).toBe(false)
    })

    it('should validate Google API key format', () => {
      const validKey = 'a'.repeat(39)
      expect(validateApiKeyFormat(validKey, 'google')).toBe(true)
      
      const invalidKey = 'a'.repeat(30)
      expect(validateApiKeyFormat(invalidKey, 'google')).toBe(false)
    })

    it('should validate Mistral API key format', () => {
      const validKey = 'a'.repeat(35)
      expect(validateApiKeyFormat(validKey, 'mistral')).toBe(true)
      
      const invalidKey = 'a'.repeat(20)
      expect(validateApiKeyFormat(invalidKey, 'mistral')).toBe(false)
    })

    it('should validate Langsmith API key format', () => {
      const validKey = 'ls__' + 'a'.repeat(35)
      expect(validateApiKeyFormat(validKey, 'langsmith')).toBe(true)
      
      const invalidKey = 'ls_' + 'a'.repeat(35)
      expect(validateApiKeyFormat(invalidKey, 'langsmith')).toBe(false)
    })

    it('should allow any format for unknown providers if key is long enough', () => {
      const validKey = 'a'.repeat(20)
      expect(validateApiKeyFormat(validKey, 'unknown-provider')).toBe(true)
      
      const invalidKey = 'a'.repeat(10)
      expect(validateApiKeyFormat(invalidKey, 'unknown-provider')).toBe(false)
    })

    it('should be case insensitive for provider names', () => {
      const validKey = 'sk-' + 'a'.repeat(50)
      expect(validateApiKeyFormat(validKey, 'OPENAI')).toBe(true)
      expect(validateApiKeyFormat(validKey, 'OpenAI')).toBe(true)
    })
  })

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      expect(secureCompare('hello', 'hello')).toBe(true)
      expect(secureCompare('', '')).toBe(true)
    })

    it('should return false for different strings', () => {
      expect(secureCompare('hello', 'world')).toBe(false)
      expect(secureCompare('abc', 'def')).toBe(false)
    })

    it('should return false for strings of different lengths', () => {
      expect(secureCompare('short', 'longer')).toBe(false)
      expect(secureCompare('a', '')).toBe(false)
    })

    it('should handle special characters', () => {
      expect(secureCompare('áéíóú', 'áéíóú')).toBe(true)
      expect(secureCompare('!@#$%', '!@#$%')).toBe(true)
      expect(secureCompare('!@#$%', '!@#$^')).toBe(false)
    })
  })

  describe('Server-side encryption functions', () => {
    it('should throw error when environment variables are missing', () => {
      delete process.env.ENCRYPTION_KEY
      
      expect(() => {
        encryptApiKey('test-key')
      }).toThrow('ENCRYPTION_KEY environment variable is required')
    })

    it('should throw error when salt is missing', () => {
      delete process.env.ENCRYPTION_SALT
      
      expect(() => {
        encryptApiKey('test-key')
      }).toThrow('ENCRYPTION_SALT environment variable is required')
    })

    it('should encrypt and decrypt API key successfully', () => {
      const originalKey = 'sk-test1234567890abcdef'
      const userId = 'user-123'
      
      const encrypted = encryptApiKey(originalKey, userId)
      expect(encrypted.encrypted).toBeTruthy()
      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.authTag).toBeTruthy()
      expect(encrypted.masked).toBe('sk-t**************cdef')
      
      const decrypted = decryptApiKey(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.authTag,
        userId
      )
      expect(decrypted).toBe(originalKey)
    })

    it('should encrypt and decrypt without userId', () => {
      const originalKey = 'test-api-key-without-userid'
      
      const encrypted = encryptApiKey(originalKey)
      const decrypted = decryptApiKey(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.authTag
      )
      expect(decrypted).toBe(originalKey)
    })

    it('should throw error for empty API key', () => {
      expect(() => {
        encryptApiKey('')
      }).toThrow('API key cannot be empty')
    })

    it('should fail decryption with wrong auth tag', () => {
      const originalKey = 'test-key'
      const encrypted = encryptApiKey(originalKey)
      
      expect(() => {
        decryptApiKey(
          encrypted.encrypted,
          encrypted.iv,
          'wrong-auth-tag',
          undefined
        )
      }).toThrow()
    })

    it('should fail decryption with wrong userId', () => {
      const originalKey = 'test-key'
      const encrypted = encryptApiKey(originalKey, 'user-1')
      
      expect(() => {
        decryptApiKey(
          encrypted.encrypted,
          encrypted.iv,
          encrypted.authTag,
          'user-2' // Different user
        )
      }).toThrow()
    })

    it('should generate valid API key', () => {
      const apiKey = generateApiKey()
      expect(apiKey).toMatch(/^sk-[a-zA-Z0-9_-]+$/)
      
      const customPrefix = generateApiKey('test')
      expect(customPrefix).toMatch(/^test-[a-zA-Z0-9_-]+$/)
    })

    it('should hash and verify API key', () => {
      const originalKey = 'test-api-key'
      const hashed = hashApiKey(originalKey)
      
      expect(hashed).toContain(':') // Salt:hash format
      expect(verifyHashedApiKey(originalKey, hashed)).toBe(true)
      expect(verifyHashedApiKey('wrong-key', hashed)).toBe(false)
    })

    it('should hash with custom salt', () => {
      const originalKey = 'test-api-key'
      const customSalt = 'custom-salt'
      const hashed = hashApiKey(originalKey, customSalt)
      
      expect(hashed.startsWith(customSalt + ':')).toBe(true)
      expect(verifyHashedApiKey(originalKey, hashed)).toBe(true)
    })

    it('should handle invalid hash format in verification', () => {
      expect(verifyHashedApiKey('key', 'invalid-format')).toBe(false)
      expect(verifyHashedApiKey('key', 'only-one-part')).toBe(false)
      expect(verifyHashedApiKey('key', '')).toBe(false)
    })

    it('should rotate API key successfully', () => {
      const originalKey = 'original-api-key'
      const userId = 'user-123'
      
      // First encryption
      const firstEncrypted = encryptApiKey(originalKey, userId)
      
      // Rotate the key
      const rotated = rotateApiKey(
        firstEncrypted.encrypted,
        firstEncrypted.iv,
        firstEncrypted.authTag,
        userId
      )
      
      // Should be able to decrypt with new encryption data
      const decrypted = decryptApiKey(
        rotated.encrypted,
        rotated.iv,
        rotated.authTag,
        userId
      )
      expect(decrypted).toBe(originalKey)
      
      // New encryption should be different from original
      expect(rotated.encrypted).not.toBe(firstEncrypted.encrypted)
      expect(rotated.iv).not.toBe(firstEncrypted.iv)
    })

    it('should handle different encryption outputs for same input', () => {
      const key = 'same-input-key'
      
      const encrypted1 = encryptApiKey(key)
      const encrypted2 = encryptApiKey(key)
      
      // Different IVs should produce different encrypted outputs
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      
      // But both should decrypt to the same value
      const decrypted1 = decryptApiKey(
        encrypted1.encrypted,
        encrypted1.iv,
        encrypted1.authTag
      )
      const decrypted2 = decryptApiKey(
        encrypted2.encrypted,
        encrypted2.iv,
        encrypted2.authTag
      )
      
      expect(decrypted1).toBe(key)
      expect(decrypted2).toBe(key)
    })

    it('should require auth tag for decryption', () => {
      const key = 'test-key'
      const encrypted = encryptApiKey(key)
      
      expect(() => {
        decryptApiKey(encrypted.encrypted, encrypted.iv, '')
      }).toThrow('authTagHex is required for AES-GCM decryption')
    })
  })
})