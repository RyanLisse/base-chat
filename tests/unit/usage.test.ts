import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkUsage,
  incrementUsage,
  checkProUsage,
  incrementProUsage,
  checkUsageByModel,
  incrementUsageByModel,
} from '@/lib/usage'
import { UsageLimitError } from '@/lib/api'

// Mock config values
vi.mock('@/lib/config', () => ({
  AUTH_DAILY_MESSAGE_LIMIT: 100,
  NON_AUTH_DAILY_MESSAGE_LIMIT: 10,
  DAILY_LIMIT_PRO_MODELS: 50,
  FREE_MODELS_IDS: ['gpt-3.5-turbo', 'claude-3-haiku-20240307'],
}))

describe('Usage Management', () => {
  const mockSupabase = {
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    })
  })

  describe('checkUsage', () => {
    it('should successfully check usage for authenticated user', async () => {
      const mockUserData = {
        message_count: 50,
        daily_message_count: 5,
        daily_reset: new Date().toISOString(),
        anonymous: false,
        premium: false,
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      const result = await checkUsage(mockSupabase as any, 'user-123')

      expect(result.userData).toEqual(mockUserData)
      expect(result.dailyCount).toBe(5)
      expect(result.dailyLimit).toBe(100) // AUTH_DAILY_MESSAGE_LIMIT
    })

    it('should successfully check usage for anonymous user', async () => {
      const mockUserData = {
        message_count: 5,
        daily_message_count: 3,
        daily_reset: new Date().toISOString(),
        anonymous: true,
        premium: false,
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      const result = await checkUsage(mockSupabase as any, 'user-123')

      expect(result.userData).toEqual(mockUserData)
      expect(result.dailyCount).toBe(3)
      expect(result.dailyLimit).toBe(10) // NON_AUTH_DAILY_MESSAGE_LIMIT
    })

    it('should reset daily count when day changes', async () => {
      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)

      const mockUserData = {
        message_count: 50,
        daily_message_count: 15,
        daily_reset: yesterday.toISOString(),
        anonymous: false,
        premium: false,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      const result = await checkUsage(mockSupabase as any, 'user-123')

      expect(result.dailyCount).toBe(0)
      expect(mockSupabase.from).toHaveBeenCalledWith('users')
      expect(mockUpdateQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          daily_message_count: 0,
          daily_reset: expect.any(String),
        })
      )
    })

    it('should throw UsageLimitError when daily limit is reached for authenticated user', async () => {
      const mockUserData = {
        message_count: 150,
        daily_message_count: 100, // At limit
        daily_reset: new Date().toISOString(),
        anonymous: false,
        premium: false,
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      await expect(checkUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        UsageLimitError
      )
    })

    it('should throw UsageLimitError when daily limit is reached for anonymous user', async () => {
      const mockUserData = {
        message_count: 15,
        daily_message_count: 10, // At limit
        daily_reset: new Date().toISOString(),
        anonymous: true,
        premium: false,
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      await expect(checkUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        UsageLimitError
      )
    })

    it('should throw error when user data fetch fails', async () => {
      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      await expect(checkUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'Error fetchClienting user data: Database connection failed'
      )
    })

    it('should throw error when user not found', async () => {
      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: null, error: null })

      await expect(checkUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'User record not found for id: user-123'
      )
    })

    it('should handle users with null daily_reset', async () => {
      const mockUserData = {
        message_count: 5,
        daily_message_count: 3,
        daily_reset: null,
        anonymous: false,
        premium: false,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      const result = await checkUsage(mockSupabase as any, 'user-123')

      // Should reset because no previous reset date
      expect(result.dailyCount).toBe(0)
      expect(mockUpdateQuery).toHaveBeenCalled()
    })
  })

  describe('incrementUsage', () => {
    it('should successfully increment usage counters', async () => {
      const mockUserData = {
        message_count: 50,
        daily_message_count: 5,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementUsage(mockSupabase as any, 'user-123')

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        message_count: 51,
        daily_message_count: 6,
        last_active_at: expect.any(String),
      })
    })

    it('should handle null counters by treating them as 0', async () => {
      const mockUserData = {
        message_count: null,
        daily_message_count: null,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementUsage(mockSupabase as any, 'user-123')

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        message_count: 1,
        daily_message_count: 1,
        last_active_at: expect.any(String),
      })
    })

    it('should throw error when user data fetch fails', async () => {
      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      })

      await expect(incrementUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'Error fetchClienting user data: Connection timeout'
      )
    })

    it('should throw error when user not found', async () => {
      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: null, error: null })

      await expect(incrementUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'Error fetchClienting user data: User not found'
      )
    })

    it('should throw error when update fails', async () => {
      const mockUserData = {
        message_count: 50,
        daily_message_count: 5,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: { message: 'Update failed' } })

      await expect(incrementUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'Failed to update usage data: Update failed'
      )
    })
  })

  describe('checkProUsage', () => {
    it('should successfully check pro usage', async () => {
      const mockUserData = {
        daily_pro_message_count: 25,
        daily_pro_reset: new Date().toISOString(),
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      const result = await checkProUsage(mockSupabase as any, 'user-123')

      expect(result.dailyProCount).toBe(25)
      expect(result.limit).toBe(50) // DAILY_LIMIT_PRO_MODELS
    })

    it('should reset pro usage on new day', async () => {
      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)

      const mockUserData = {
        daily_pro_message_count: 40,
        daily_pro_reset: yesterday.toISOString(),
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      const result = await checkProUsage(mockSupabase as any, 'user-123')

      expect(result.dailyProCount).toBe(0)
      expect(mockUpdateQuery).toHaveBeenCalledWith({
        daily_pro_message_count: 0,
        daily_pro_reset: expect.any(String),
      })
    })

    it('should throw UsageLimitError when pro limit is reached', async () => {
      const mockUserData = {
        daily_pro_message_count: 50, // At limit
        daily_pro_reset: new Date().toISOString(),
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      await expect(checkProUsage(mockSupabase as any, 'user-123')).rejects.toThrow(
        'Daily Pro model limit reached.'
      )
    })
  })

  describe('incrementProUsage', () => {
    it('should successfully increment pro usage', async () => {
      const mockUserData = {
        daily_pro_message_count: 25,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementProUsage(mockSupabase as any, 'user-123')

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        daily_pro_message_count: 26,
        last_active_at: expect.any(String),
      })
    })

    it('should handle null pro count', async () => {
      const mockUserData = {
        daily_pro_message_count: null,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementProUsage(mockSupabase as any, 'user-123')

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        daily_pro_message_count: 1,
        last_active_at: expect.any(String),
      })
    })
  })

  describe('checkUsageByModel', () => {
    it('should check pro usage for pro models with authentication', async () => {
      const mockUserData = {
        daily_pro_message_count: 25,
        daily_pro_reset: new Date().toISOString(),
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      const result = await checkUsageByModel(
        mockSupabase as any,
        'user-123',
        'gpt-4', // Pro model
        true // Authenticated
      )

      expect(result.dailyProCount).toBe(25)
      expect(result.limit).toBe(50)
    })

    it('should throw error for pro models without authentication', async () => {
      await expect(
        checkUsageByModel(
          mockSupabase as any,
          'user-123',
          'gpt-4', // Pro model
          false // Not authenticated
        )
      ).rejects.toThrow('You must log in to use this model.')
    })

    it('should check regular usage for free models', async () => {
      const mockUserData = {
        message_count: 50,
        daily_message_count: 5,
        daily_reset: new Date().toISOString(),
        anonymous: false,
        premium: false,
      }

      const mockQuery = mockSupabase.from().select().eq().maybeSingle
      mockQuery.mockResolvedValue({ data: mockUserData, error: null })

      const result = await checkUsageByModel(
        mockSupabase as any,
        'user-123',
        'gpt-3.5-turbo', // Free model
        false // Authentication doesn't matter for free models
      )

      expect(result.dailyCount).toBe(5)
      expect(result.dailyLimit).toBe(100)
    })
  })

  describe('incrementUsageByModel', () => {
    it('should increment pro usage for pro models with authentication', async () => {
      const mockUserData = {
        daily_pro_message_count: 25,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementUsageByModel(
        mockSupabase as any,
        'user-123',
        'gpt-4', // Pro model
        true // Authenticated
      )

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        daily_pro_message_count: 26,
        last_active_at: expect.any(String),
      })
    })

    it('should not increment for pro models without authentication', async () => {
      const result = await incrementUsageByModel(
        mockSupabase as any,
        'user-123',
        'gpt-4', // Pro model
        false // Not authenticated
      )

      expect(result).toBeUndefined()
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should increment regular usage for free models', async () => {
      const mockUserData = {
        message_count: 50,
        daily_message_count: 5,
      }

      const mockSelectQuery = mockSupabase.from().select().eq().maybeSingle
      mockSelectQuery.mockResolvedValue({ data: mockUserData, error: null })

      const mockUpdateQuery = mockSupabase.from().update().eq
      mockUpdateQuery.mockResolvedValue({ error: null })

      await incrementUsageByModel(
        mockSupabase as any,
        'user-123',
        'claude-3-haiku-20240307', // Free model
        true
      )

      expect(mockUpdateQuery).toHaveBeenCalledWith({
        message_count: 51,
        daily_message_count: 6,
        last_active_at: expect.any(String),
      })
    })
  })
})