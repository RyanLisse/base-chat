// Environment variable validation for security-critical variables

export interface EnvValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateSecurityEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Only validate in Node.js environment
  if (typeof window !== 'undefined') {
    return { isValid: true, errors: [], warnings: [] }
  }

  // Required in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PASSWORD_PEPPER) {
      errors.push('PASSWORD_PEPPER environment variable is required in production')
    }
    
    if (!process.env.ENCRYPTION_KEY) {
      errors.push('ENCRYPTION_KEY environment variable is required in production')
    }
    
    if (!process.env.CSRF_SECRET) {
      errors.push('CSRF_SECRET environment variable is required in production')
    }
  }

  // Validate pepper strength
  if (process.env.PASSWORD_PEPPER) {
    if (process.env.PASSWORD_PEPPER.length < 32) {
      warnings.push('PASSWORD_PEPPER should be at least 32 characters for optimal security')
    }
    
    if (process.env.PASSWORD_PEPPER.includes('Default') || process.env.PASSWORD_PEPPER.includes('BaseChat')) {
      errors.push('PASSWORD_PEPPER appears to be a default value - use a unique secret in production')
    }
  }

  // Validate encryption key strength  
  if (process.env.ENCRYPTION_KEY) {
    if (process.env.ENCRYPTION_KEY.length < 32) {
      warnings.push('ENCRYPTION_KEY should be at least 32 characters for optimal security')
    }
    
    if (process.env.ENCRYPTION_KEY.includes('Default') || process.env.ENCRYPTION_KEY.includes('BaseChat')) {
      errors.push('ENCRYPTION_KEY appears to be a default value - use a unique secret in production')
    }
  }

  // Validate CSRF secret
  if (process.env.CSRF_SECRET) {
    if (process.env.CSRF_SECRET.length < 32) {
      warnings.push('CSRF_SECRET should be at least 32 characters for optimal security')
    }
  }

  // Check for common API keys that might be accidentally exposed
  const potentialApiKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 
    'LANGSMITH_API_KEY',
    'GOOGLE_API_KEY'
  ]

  for (const keyName of potentialApiKeys) {
    if (process.env[keyName] && process.env[keyName]!.length < 16) {
      warnings.push(`${keyName} appears to be too short - verify it's a valid API key`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function throwOnInvalidEnvironment(): void {
  const validation = validateSecurityEnvironmentVariables()
  
  if (!validation.isValid) {
    throw new Error(`Environment validation failed:\n${validation.errors.join('\n')}`)
  }
  
  if (validation.warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('Environment validation warnings:\n', validation.warnings.join('\n'))
  }
}

// Auto-validate in server environment
if (typeof window === 'undefined') {
  try {
    throwOnInvalidEnvironment()
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error
    } else {
      console.warn('Environment validation:', error)
    }
  }
}