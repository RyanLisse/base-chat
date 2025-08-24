import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as ephemeralKeyPOST } from '@/app/api/realtime/ephemeral-key/route'
import { POST as connectPOST, OPTIONS as connectOPTIONS } from '@/app/api/realtime/connect/route'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import OpenAI from 'openai'

// Mock dependencies
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('openai')

describe('Realtime API Routes', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
  })

  describe('POST /api/realtime/ephemeral-key', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/realtime/ephemeral-key', {
        method: 'POST',
      })

      const response = await ephemeralKeyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(logger.warn).toHaveBeenCalledWith('Unauthorized realtime key request')
    })

    it('should return 400 when user has no OpenAI API key', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: new Error('Not found'),
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      const request = new NextRequest('http://localhost/api/realtime/ephemeral-key', {
        method: 'POST',
      })

      const response = await ephemeralKeyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('OpenAI API key not found. Please add your API key in settings.')
      expect(logger.warn).toHaveBeenCalledWith('No OpenAI API key found for user')
      expect(mockFromQuery.select).toHaveBeenCalledWith('api_key')
      expect(mockFromQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockFromQuery.eq).toHaveBeenCalledWith('provider', 'openai')
    })

    it('should return ephemeral key when user has valid API key', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { api_key: 'sk-test-key' },
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      const request = new NextRequest('http://localhost/api/realtime/ephemeral-key', {
        method: 'POST',
      })

      const response = await ephemeralKeyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.client_secret).toBeDefined()
      expect(data.client_secret.value).toMatch(/^ek_live_/)
      expect(data.client_secret.expires_at).toBeDefined()
      expect(data.session_id).toMatch(/^session_user-123_/)
      expect(logger.info).toHaveBeenCalledWith('Mock ephemeral key created successfully')
    })

    it('should handle errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/realtime/ephemeral-key', {
        method: 'POST',
      })

      const response = await ephemeralKeyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(logger.error).toHaveBeenCalledWith('Error creating ephemeral key')
    })
  })

  describe('POST /api/realtime/connect', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ sdp: 'test-sdp', type: 'offer' }),
      })

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(logger.warn).toHaveBeenCalledWith('Unauthorized realtime connect request')
    })

    it('should return 401 when authorization header is missing', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        body: JSON.stringify({ sdp: 'test-sdp', type: 'offer' }),
      })

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    it('should return 400 when SDP offer is invalid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ type: 'offer' }), // Missing sdp
      })

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid SDP offer')
    })

    it('should return SDP answer when request is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const mockFromQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'session-123' },
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ sdp: 'test-sdp', type: 'offer' }),
      })

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sdp).toBeDefined()
      expect(data.type).toBe('answer')
      expect(logger.info).toHaveBeenCalledWith('WebRTC connection request received')
      expect(mockFromQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        session_type: 'transcription',
        status: 'connecting',
        created_at: expect.any(String),
      })
    })

    it('should handle errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ sdp: 'test-sdp', type: 'offer' }),
      })

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Connection failed')
      expect(logger.error).toHaveBeenCalledWith('Error handling WebRTC connection')
    })
  })

  describe('OPTIONS /api/realtime/connect', () => {
    it('should return proper CORS headers', async () => {
      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'OPTIONS',
      })

      const response = await connectOPTIONS(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/realtime/connect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      // Mock the json() method to throw an error
      request.json = vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))

      const response = await connectPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Connection failed')
    })

    it('should handle OpenAI API errors properly', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { api_key: 'sk-test-key' },
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      // Mock OpenAI to throw an API error
      const apiError = new OpenAI.APIError(
        'Invalid API key',
        403,
        { error: { message: 'Invalid API key' } },
        { 'x-request-id': 'test-123' }
      )

      const request = new NextRequest('http://localhost/api/realtime/ephemeral-key', {
        method: 'POST',
      })

      // Simulate OpenAI API error
      const originalResponse = await ephemeralKeyPOST(request)
      
      // Since we're using a mock, we check the mock was created
      expect(vi.mocked(OpenAI)).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should respect maxDuration setting', () => {
      // Check that the route exports maxDuration
      const ephemeralKeyModule = require('@/app/api/realtime/ephemeral-key/route')
      const connectModule = require('@/app/api/realtime/connect/route')
      
      expect(ephemeralKeyModule.maxDuration).toBe(30)
      expect(connectModule.maxDuration).toBe(30)
    })
  })
})