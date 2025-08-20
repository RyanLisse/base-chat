import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import './env-validation' // Auto-validate environment on import

const SALT_ROUNDS = 12
// Validate pepper is set in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.PASSWORD_PEPPER) {
  throw new Error('PASSWORD_PEPPER environment variable must be set in production')
}

const PEPPER = process.env.PASSWORD_PEPPER || (
  process.env.NODE_ENV === 'production' 
    ? undefined 
    : 'BaseChat-Default-Pepper-2025-DEV-ONLY'
)

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long')
  }
  
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const pepperedPassword = `${password}${PEPPER}`
  const hashedPassword = await bcrypt.hash(pepperedPassword, SALT_ROUNDS)
  
  return hashedPassword
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    return false
  }
  
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const pepperedPassword = `${password}${PEPPER}`
  
  try {
    return await bcrypt.compare(pepperedPassword, hashedPassword)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

export async function hashApiKey(apiKey: string): Promise<{
  hash: string
  salt: string
}> {
  if (!apiKey || apiKey.length < 16) {
    throw new Error('API key must be at least 16 characters long')
  }
  
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const salt = randomBytes(16).toString('hex')
  const pepperedKey = `${apiKey}${PEPPER}${salt}`
  const hash = await bcrypt.hash(pepperedKey, SALT_ROUNDS)
  
  return { hash, salt }
}

export async function verifyApiKey(
  apiKey: string,
  hashedKey: string,
  salt: string
): Promise<boolean> {
  if (!apiKey || !hashedKey || !salt) {
    return false
  }
  
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const pepperedKey = `${apiKey}${PEPPER}${salt}`
  
  try {
    return await bcrypt.compare(pepperedKey, hashedKey)
  } catch (error) {
    console.error('API key verification error:', error)
    return false
  }
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url')
}

export function hashSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

export async function generatePasswordResetToken(userId: string): Promise<{
  token: string
  hashedToken: string
  expiresAt: Date
}> {
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const token = generateSecureToken(32)
  const hashedToken = hashSHA256(`${token}${userId}${PEPPER}`)
  const expiresAt = new Date(Date.now() + 3600000)
  
  return { token, hashedToken, expiresAt }
}

export async function verifyPasswordResetToken(
  token: string,
  userId: string,
  hashedToken: string
): Promise<boolean> {
  if (!PEPPER) {
    throw new Error('PASSWORD_PEPPER environment variable is required')
  }
  
  const expectedHash = hashSHA256(`${token}${userId}${PEPPER}`)
  return timingSafeEqual(expectedHash, hashedToken)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

export interface PasswordStrength {
  score: number
  feedback: string[]
  isStrong: boolean
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0
  
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  
  if (score < 3) feedback.push('Password is too weak')
  if (password.length < 8) feedback.push('Use at least 8 characters')
  if (!/[a-z]/.test(password)) feedback.push('Include lowercase letters')
  if (!/[A-Z]/.test(password)) feedback.push('Include uppercase letters')
  if (!/[0-9]/.test(password)) feedback.push('Include numbers')
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Include special characters')
  
  return {
    score: Math.min(score, 5),
    feedback,
    isStrong: score >= 5,
  }
}