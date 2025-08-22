import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/chat/route'

// Mock external dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(() => [
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  ]),
}))

vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn((model) => {
    const providerMap: Record<string, string> = {
      'gpt-4': 'openai',
      'claude-3-5-sonnet-20241022': 'anthropic',
    }
    return providerMap[model] || 'openai'
  }),
}))

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: () => new Response('mocked stream response'),
    finishReason: 'stop',
    usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
  })),
}))

vi.mock('@/lib/tools/file-search', () => ({
  fileSearchTool: { name: 'file_search', description: 'Mock file search tool' },
}))

vi.mock('@/lib/langsmith/client', () => ({
  isLangSmithEnabled: vi.fn(() => false),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  extractRunId: vi.fn(),
  logMetrics: vi.fn(),
}))

vi.mock('@/app/api/chat/api', () => ({
  incrementMessageCount: vi.fn(),
  logUserMessage: vi.fn(() => Promise.resolve('message-123')),
  storeAssistantMessage: vi.fn(() => Promise.resolve()),
  validateAndTrackUsage: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}))

vi.mock('@/lib/config', () => ({
  SYSTEM_PROMPT_DEFAULT: 'You are a helpful assistant.',
  FILE_SEARCH_SYSTEM_PROMPT: 'You are a file search assistant.',
}))

describe('Chat API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockRequest = (body: any) => {
    return new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  const validChatRequest = {
    messages: [
      { role: 'user' as const, content: 'Hello, how are you?' }
    ],
    chatId: 'chat-123',
    userId: 'user-123',
    model: 'gpt-4',
    isAuthenticated: true,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium' as const,
  }

  describe('POST /api/chat', () => {
    it('should handle valid chat request successfully', async () => {
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('should return 400 for missing required fields', async () => {
      const invalidRequest = { ...validChatRequest }
      delete invalidRequest.messages
      
      const request = createMockRequest(invalidRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.error).toBe('Error, missing information')
    })

    it('should return 400 for missing chatId', async () => {
      const invalidRequest = { ...validChatRequest }
      delete invalidRequest.chatId
      
      const request = createMockRequest(invalidRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })

    it('should return 400 for missing userId', async () => {
      const invalidRequest = { ...validChatRequest }
      delete invalidRequest.userId
      
      const request = createMockRequest(invalidRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })

    it('should handle model resolution (gpt-4o-mini -> gpt-5-mini)', async () => {
      const requestWithOldModel = { 
        ...validChatRequest, 
        model: 'gpt-4o-mini' 
      }
      
      const request = createMockRequest(requestWithOldModel)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      // The model should be resolved to gpt-5-mini internally
    })

    it('should handle chat request with file search enabled', async () => {
      const requestWithSearch = { 
        ...validChatRequest, 
        enableSearch: true 
      }
      
      const request = createMockRequest(requestWithSearch)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle different reasoning effort levels', async () => {
      const reasoningLevels = ['low', 'medium', 'high'] as const
      
      for (const effort of reasoningLevels) {
        const requestWithEffort = { 
          ...validChatRequest, 
          reasoningEffort: effort 
        }
        
        const request = createMockRequest(requestWithEffort)
        const response = await POST(request)
        
        expect(response.status).toBe(200)
      }
    })

    it('should handle unauthenticated user request', async () => {
      const unauthenticatedRequest = { 
        ...validChatRequest, 
        isAuthenticated: false 
      }
      
      const request = createMockRequest(unauthenticatedRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle request with message_group_id', async () => {
      const requestWithGroupId = { 
        ...validChatRequest, 
        message_group_id: 'group-123' 
      }
      
      const request = createMockRequest(requestWithGroupId)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle request with verbosity setting', async () => {
      const requestWithVerbosity = { 
        ...validChatRequest, 
        verbosity: 'high' as const 
      }
      
      const request = createMockRequest(requestWithVerbosity)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle different AI models', async () => {
      const models = ['gpt-4', 'claude-3-5-sonnet-20241022', 'gpt-3.5-turbo']
      
      for (const model of models) {
        const requestWithModel = { 
          ...validChatRequest, 
          model 
        }
        
        const request = createMockRequest(requestWithModel)
        const response = await POST(request)
        
        expect(response.status).toBe(200)
      }
    })

    it('should handle multi-turn conversation', async () => {
      const multiTurnRequest = {
        ...validChatRequest,
        messages: [
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
          { role: 'user' as const, content: 'What about 3+3?' },
        ],
      }
      
      const request = createMockRequest(multiTurnRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle empty message content gracefully', async () => {
      const requestWithEmptyMessage = {
        ...validChatRequest,
        messages: [
          { role: 'user' as const, content: '' }
        ],
      }
      
      const request = createMockRequest(requestWithEmptyMessage)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle malformed JSON request', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })

    it('should call validateAndTrackUsage with correct parameters', async () => {
      const { validateAndTrackUsage } = await import('@/app/api/chat/api')
      
      const request = createMockRequest(validChatRequest)
      await POST(request)
      
      expect(validateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: true,
      })
    })

    it('should handle usage validation failure', async () => {
      const { validateAndTrackUsage } = await import('@/app/api/chat/api')
      validateAndTrackUsage.mockRejectedValueOnce(new Error('Usage limit exceeded'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })

    it('should handle streamText errors', async () => {
      const { streamText } = await import('ai')
      streamText.mockRejectedValueOnce(new Error('AI service unavailable'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })
  })

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      const { validateAndTrackUsage } = await import('@/app/api/chat/api')
      validateAndTrackUsage.mockRejectedValueOnce(new Error('Network timeout'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body).toHaveProperty('error')
    })

    it('should handle database connection errors', async () => {
      const { validateAndTrackUsage } = await import('@/app/api/chat/api')
      validateAndTrackUsage.mockRejectedValueOnce(new Error('Database connection failed'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })

    it('should handle provider API errors', async () => {
      const { streamText } = await import('ai')
      streamText.mockRejectedValueOnce(new Error('API key invalid'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })
  })

  describe('LangSmith integration', () => {
    it('should handle LangSmith when enabled', async () => {
      const { isLangSmithEnabled, createRun } = await import('@/lib/langsmith/client')
      isLangSmithEnabled.mockReturnValue(true)
      createRun.mockResolvedValue({ id: 'run-123' })
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(createRun).toHaveBeenCalled()
    })

    it('should handle LangSmith errors gracefully', async () => {
      const { isLangSmithEnabled, createRun } = await import('@/lib/langsmith/client')
      isLangSmithEnabled.mockReturnValue(true)
      createRun.mockRejectedValue(new Error('LangSmith unavailable'))
      
      const request = createMockRequest(validChatRequest)
      const response = await POST(request)
      
      // Should still work even if LangSmith fails
      expect(response.status).toBe(200)
    })
  })
})