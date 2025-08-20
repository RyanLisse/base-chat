import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  submitMessageScenario,
  handleFileUploadScenario,
  validateUserLimitsScenario,
  validateMessageInput,
  submitSuggestionScenario,
  prepareReloadScenario,
  handleChatError,
  type MessageSubmissionContext,
  type ChatOperationDependencies,
} from '@/app/components/chat/chat-business-logic'
import { toast } from '@/components/ui/toast'

// Mock dependencies
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}))


vi.mock('@/lib/config', () => ({
  MESSAGE_MAX_LENGTH: 32000,
  SYSTEM_PROMPT_DEFAULT: 'You are a helpful assistant.',
}))

describe('Chat Business Logic', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  }

  const mockDependencies: ChatOperationDependencies = {
    checkLimitsAndNotify: vi.fn(),
    ensureChatExists: vi.fn(),
    handleFileUploads: vi.fn(),
    createOptimisticAttachments: vi.fn(),
    cleanupOptimisticAttachments: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateMessageInput', () => {
    it('should accept valid message input', () => {
      const result = validateMessageInput('Hello, how are you?')
      expect(result.success).toBe(true)
    })

    it('should reject empty messages', () => {
      const result = validateMessageInput('')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Message cannot be empty')
    })

    it('should reject messages with only whitespace', () => {
      const result = validateMessageInput('   \n\t  ')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Message cannot be empty')
    })

    it('should reject messages exceeding maximum length', () => {
      const longMessage = 'a'.repeat(32001)
      const result = validateMessageInput(longMessage)
      expect(result.success).toBe(false)
      expect(result.error).toContain('too long')
      expect(result.error).toContain('32000 characters')
    })

    it('should accept messages at maximum length', () => {
      const maxLengthMessage = 'a'.repeat(32000)
      const result = validateMessageInput(maxLengthMessage)
      expect(result.success).toBe(true)
    })
  })

  describe('validateUserLimitsScenario', () => {
    it('should allow user when within limits', async () => {
      const checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      
      const result = await validateUserLimitsScenario('user-123', checkLimitsAndNotify)
      
      expect(result.success).toBe(true)
      expect(checkLimitsAndNotify).toHaveBeenCalledWith('user-123')
    })

    it('should reject user when exceeding limits', async () => {
      const checkLimitsAndNotify = vi.fn().mockResolvedValue(false)
      
      const result = await validateUserLimitsScenario('user-123', checkLimitsAndNotify)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should handle errors during limit checking', async () => {
      const checkLimitsAndNotify = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      
      const result = await validateUserLimitsScenario('user-123', checkLimitsAndNotify)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Service unavailable')
    })
  })

  describe('handleFileUploadScenario', () => {
    it('should handle empty file list', async () => {
      const result = await handleFileUploadScenario([], 'user-123', 'chat-123', vi.fn())
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should handle successful file upload', async () => {
      const mockAttachments = [
        { name: 'test.pdf', type: 'application/pdf', url: 'mock-url' },
      ]
      const handleFileUploads = vi.fn().mockResolvedValue(mockAttachments)
      const files = [new File(['test'], 'test.pdf', { type: 'application/pdf' })]
      
      const result = await handleFileUploadScenario(files, 'user-123', 'chat-123', handleFileUploads)
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockAttachments)
      expect(handleFileUploads).toHaveBeenCalledWith('user-123', 'chat-123')
    })

    it('should handle failed file upload', async () => {
      const handleFileUploads = vi.fn().mockResolvedValue(null)
      const files = [new File(['test'], 'test.pdf', { type: 'application/pdf' })]
      
      const result = await handleFileUploadScenario(files, 'user-123', 'chat-123', handleFileUploads)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('File upload failed')
    })

    it('should handle file upload errors', async () => {
      const handleFileUploads = vi.fn().mockRejectedValue(new Error('Upload service down'))
      const files = [new File(['test'], 'test.pdf', { type: 'application/pdf' })]
      
      const result = await handleFileUploadScenario(files, 'user-123', 'chat-123', handleFileUploads)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Upload service down')
    })
  })

  describe('submitMessageScenario', () => {
    const mockContext: MessageSubmissionContext = {
      input: 'Test message',
      files: [],
      user: mockUser,
      selectedModel: 'gpt-4',
      isAuthenticated: true,
      systemPrompt: 'Test prompt',
      enableSearch: false,
      reasoningEffort: 'medium',
      chatId: 'chat-123',
    }

    beforeEach(async () => {
      // Mock getOrCreateGuestUserId to return user ID
      const api = await import('@/lib/api')
      vi.mocked(api.getOrCreateGuestUserId).mockResolvedValue('user-123')
    })

    it('should successfully submit a valid message', async () => {
      // Setup successful dependencies
      mockDependencies.checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      mockDependencies.ensureChatExists = vi.fn().mockResolvedValue('chat-123')
      mockDependencies.handleFileUploads = vi.fn().mockResolvedValue([])
      mockDependencies.createOptimisticAttachments = vi.fn().mockReturnValue([])

      const result = await submitMessageScenario(mockContext, mockDependencies)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.chatId).toBe('chat-123')
      expect(result.data!.optimisticMessage.content).toBe('Test message')
      expect(result.data!.optimisticMessage.role).toBe('user')
      expect(result.data!.requestOptions.body).toMatchObject({
        chatId: 'chat-123',
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: true,
        systemPrompt: 'Test prompt',
        enableSearch: false,
        reasoningEffort: 'medium',
      })
    })

    it('should handle user ID retrieval failure', async () => {
      const { getOrCreateGuestUserId } = require('@/lib/api')
      getOrCreateGuestUserId.mockResolvedValue(null)

      const result = await submitMessageScenario(mockContext, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to get user ID')
    })

    it('should handle rate limit failure', async () => {
      mockDependencies.checkLimitsAndNotify = vi.fn().mockResolvedValue(false)

      const result = await submitMessageScenario(mockContext, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should handle invalid input', async () => {
      const invalidContext = { ...mockContext, input: '' }
      
      const result = await submitMessageScenario(invalidContext, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message cannot be empty')
    })

    it('should handle chat creation failure', async () => {
      mockDependencies.checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      mockDependencies.ensureChatExists = vi.fn().mockResolvedValue(null)

      const result = await submitMessageScenario(mockContext, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create or access chat')
    })

    it('should handle file upload failure', async () => {
      const contextWithFiles = {
        ...mockContext,
        files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })],
      }
      
      mockDependencies.checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      mockDependencies.ensureChatExists = vi.fn().mockResolvedValue('chat-123')
      mockDependencies.handleFileUploads = vi.fn().mockResolvedValue(null)

      const result = await submitMessageScenario(contextWithFiles, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File upload failed')
    })

    it('should handle files with optimistic attachments', async () => {
      const contextWithFiles = {
        ...mockContext,
        files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })],
      }
      
      const mockOptimisticAttachments = [
        { name: 'test.pdf', contentType: 'application/pdf', url: 'blob:mock-url' },
      ]
      
      mockDependencies.checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      mockDependencies.ensureChatExists = vi.fn().mockResolvedValue('chat-123')
      mockDependencies.handleFileUploads = vi.fn().mockResolvedValue([])
      mockDependencies.createOptimisticAttachments = vi.fn().mockReturnValue(mockOptimisticAttachments)

      const result = await submitMessageScenario(contextWithFiles, mockDependencies)

      expect(result.success).toBe(true)
      expect(result.data!.optimisticMessage.experimental_attachments).toEqual(mockOptimisticAttachments)
      expect(mockDependencies.createOptimisticAttachments).toHaveBeenCalledWith(contextWithFiles.files)
    })

    it('should handle unexpected errors', async () => {
      const { getOrCreateGuestUserId } = require('@/lib/api')
      getOrCreateGuestUserId.mockRejectedValue(new Error('Database connection failed'))

      const result = await submitMessageScenario(mockContext, mockDependencies)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })
  })

  describe('submitSuggestionScenario', () => {
    const mockContext = {
      user: mockUser,
      selectedModel: 'gpt-4',
      isAuthenticated: true,
      reasoningEffort: 'medium' as const,
      chatId: 'chat-123',
    }

    const mockDeps = {
      checkLimitsAndNotify: vi.fn(),
      ensureChatExists: vi.fn(),
    }

    beforeEach(async () => {
      const api = await import('@/lib/api')
      vi.mocked(api.getOrCreateGuestUserId).mockResolvedValue('user-123')
    })

    it('should successfully submit a suggestion', async () => {
      mockDeps.checkLimitsAndNotify = vi.fn().mockResolvedValue(true)
      mockDeps.ensureChatExists = vi.fn().mockResolvedValue('chat-123')

      const result = await submitSuggestionScenario('Test suggestion', mockContext, mockDeps)

      expect(result.success).toBe(true)
      expect(result.data!.optimisticMessage.content).toBe('Test suggestion')
      expect(result.data!.requestOptions.body.systemPrompt).toBe('You are a helpful assistant.')
    })

    it('should handle rate limiting for suggestions', async () => {
      mockDeps.checkLimitsAndNotify = vi.fn().mockResolvedValue(false)

      const result = await submitSuggestionScenario('Test suggestion', mockContext, mockDeps)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })
  })

  describe('prepareReloadScenario', () => {
    const mockContext = {
      user: mockUser,
      chatId: 'chat-123',
      selectedModel: 'gpt-4',
      isAuthenticated: true,
      systemPrompt: 'Custom prompt',
      reasoningEffort: 'high' as const,
    }

    beforeEach(async () => {
      const api = await import('@/lib/api')
      vi.mocked(api.getOrCreateGuestUserId).mockResolvedValue('user-123')
    })

    it('should successfully prepare reload options', async () => {
      const result = await prepareReloadScenario(mockContext)

      expect(result.success).toBe(true)
      expect(result.data!.requestOptions.body).toMatchObject({
        chatId: 'chat-123',
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: true,
        systemPrompt: 'Custom prompt',
        reasoningEffort: 'high',
      })
    })

    it('should use default system prompt when not provided', async () => {
      const contextWithoutPrompt = { ...mockContext, systemPrompt: undefined }
      
      const result = await prepareReloadScenario(contextWithoutPrompt)

      expect(result.success).toBe(true)
      expect(result.data!.requestOptions.body.systemPrompt).toBe('You are a helpful assistant.')
    })

    it('should handle user ID retrieval failure', async () => {
      const { getOrCreateGuestUserId } = require('@/lib/api')
      getOrCreateGuestUserId.mockResolvedValue(null)

      const result = await prepareReloadScenario(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to get user ID')
    })
  })

  describe('handleChatError', () => {
    it('should log error and show toast', () => {
      const mockError = new Error('Test error message')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      handleChatError(mockError, 'Test operation')

      expect(consoleSpy).toHaveBeenCalledWith('Test operation error:', mockError)
      expect(consoleSpy).toHaveBeenCalledWith('Error message:', 'Test error message')
      expect(toast).toHaveBeenCalledWith({
        title: 'Test error message',
        status: 'error',
      })

      consoleSpy.mockRestore()
    })

    it('should handle generic error messages', () => {
      const mockError = new Error('An error occurred')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      handleChatError(mockError)

      expect(toast).toHaveBeenCalledWith({
        title: 'Something went wrong. Please try again.',
        status: 'error',
      })

      consoleSpy.mockRestore()
    })

    it('should handle fetch failed error', () => {
      const mockError = new Error('fetch failed')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      handleChatError(mockError)

      expect(toast).toHaveBeenCalledWith({
        title: 'Something went wrong. Please try again.',
        status: 'error',
      })

      consoleSpy.mockRestore()
    })

    it('should handle errors without message', () => {
      const mockError = new Error('')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      handleChatError(mockError)

      expect(toast).toHaveBeenCalledWith({
        title: 'Something went wrong.',
        status: 'error',
      })

      consoleSpy.mockRestore()
    })
  })
})