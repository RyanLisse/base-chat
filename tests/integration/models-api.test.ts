import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/models/route'

// Mock the models library
vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(),
  getModelsForUserProviders: vi.fn(),
  getModelsWithAccessFlags: vi.fn(),
  refreshModelsCache: vi.fn(),
}))

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('Models API Integration Tests', () => {
  const mockModels = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      context_length: 8192,
      max_output_tokens: 4096,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      context_length: 200000,
      max_output_tokens: 8192,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      context_length: 2000000,
      max_output_tokens: 8192,
    },
  ]

  const mockModelsWithAccessFlags = mockModels.map(model => ({
    ...model,
    accessible: true,
    requires_auth: model.id === 'gpt-4',
  }))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/models', () => {
    it('should return all models when no Supabase client', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getAllModels } = await import('@/lib/models')
      
      createClient.mockResolvedValue(null)
      getAllModels.mockResolvedValue(mockModels)

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toHaveLength(3)
      expect(body.models[0]).toMatchObject({
        ...mockModels[0],
        accessible: true,
      })
      expect(getAllModels).toHaveBeenCalled()
    })

    it('should return models with access flags for unauthenticated users', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsWithAccessFlags } = await import('@/lib/models')
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccessFlags)

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toHaveLength(3)
      expect(body.models[0].accessible).toBeDefined()
      expect(getModelsWithAccessFlags).toHaveBeenCalled()
    })

    it('should return models with access flags when user ID is missing', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsWithAccessFlags } = await import('@/lib/models')
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ 
            data: { user: { id: null } } 
          }),
        },
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccessFlags)

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toEqual(mockModelsWithAccessFlags)
      expect(getModelsWithAccessFlags).toHaveBeenCalled()
    })

    it('should return user-specific models when user has API keys', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsForUserProviders } = await import('@/lib/models')
      
      const mockUserKeys = [
        { provider: 'openai' },
        { provider: 'anthropic' },
      ]
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ 
            data: { user: { id: 'user-123' } } 
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockUserKeys,
              error: null,
            }),
          }),
        }),
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsForUserProviders.mockResolvedValue(
        mockModels.filter(m => ['openai', 'anthropic'].includes(m.provider))
      )

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toHaveLength(2) // Only OpenAI and Anthropic models
      expect(getModelsForUserProviders).toHaveBeenCalledWith(['openai', 'anthropic'])
    })

    it('should handle error when fetching user keys', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsWithAccessFlags } = await import('@/lib/models')
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ 
            data: { user: { id: 'user-123' } } 
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccessFlags)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const response = await GET()
      
      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user keys:', { message: 'Database error' })
      expect(getModelsWithAccessFlags).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should return access flags when user has no API keys', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsWithAccessFlags } = await import('@/lib/models')
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ 
            data: { user: { id: 'user-123' } } 
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [], // No user keys
              error: null,
            }),
          }),
        }),
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccessFlags)

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toEqual(mockModelsWithAccessFlags)
      expect(getModelsWithAccessFlags).toHaveBeenCalled()
    })

    it('should handle general errors', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      
      createClient.mockRejectedValue(new Error('Connection failed'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const response = await GET()
      
      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.error).toBe('Failed to fetch models')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching models:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should handle null user keys data', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getModelsWithAccessFlags } = await import('@/lib/models')
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ 
            data: { user: { id: 'user-123' } } 
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null, // No data
              error: null,
            }),
          }),
        }),
      }
      
      createClient.mockResolvedValue(mockSupabase)
      getModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccessFlags)

      const response = await GET()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.models).toEqual(mockModelsWithAccessFlags)
      expect(getModelsWithAccessFlags).toHaveBeenCalled()
    })
  })

  describe('POST /api/models', () => {
    it('should refresh models cache successfully', async () => {
      const { refreshModelsCache, getAllModels } = await import('@/lib/models')
      
      refreshModelsCache.mockResolvedValue(undefined)
      getAllModels.mockResolvedValue(mockModels)

      const response = await POST()
      
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.message).toBe('Models cache refreshed')
      expect(body.models).toEqual(mockModels)
      expect(body.timestamp).toBeDefined()
      expect(body.count).toBe(3)
      
      expect(refreshModelsCache).toHaveBeenCalled()
      expect(getAllModels).toHaveBeenCalled()
    })

    it('should handle refresh cache errors', async () => {
      const { refreshModelsCache } = await import('@/lib/models')
      
      refreshModelsCache.mockRejectedValue(new Error('Cache refresh failed'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const response = await POST()
      
      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.error).toBe('Failed to refresh models')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh models:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should handle getAllModels errors during refresh', async () => {
      const { refreshModelsCache, getAllModels } = await import('@/lib/models')
      
      refreshModelsCache.mockResolvedValue(undefined)
      getAllModels.mockRejectedValue(new Error('Failed to get models'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const response = await POST()
      
      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.error).toBe('Failed to refresh models')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Response format validation', () => {
    it('should return properly formatted JSON response', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const { getAllModels } = await import('@/lib/models')
      
      createClient.mockResolvedValue(null)
      getAllModels.mockResolvedValue(mockModels)

      const response = await GET()
      
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body).toHaveProperty('models')
      expect(Array.isArray(body.models)).toBe(true)
    })

    it('should return valid timestamps in POST response', async () => {
      const { refreshModelsCache, getAllModels } = await import('@/lib/models')
      
      refreshModelsCache.mockResolvedValue(undefined)
      getAllModels.mockResolvedValue(mockModels)

      const beforeTime = new Date()
      const response = await POST()
      const afterTime = new Date()
      
      const body = await response.json()
      const responseTime = new Date(body.timestamp)
      
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })
})