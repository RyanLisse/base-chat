import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as embeddingsPOST } from '@/app/api/transcription/embeddings/route'
import { POST as indexPOST } from '@/app/api/transcription/index/route'
import { POST as searchPOST } from '@/app/api/transcription/search/route'
import { POST as cleanupPOST, GET as cleanupGET } from '@/app/api/transcription/cleanup/route'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import OpenAI from 'openai'
import { decryptKey } from '@/lib/encryption'

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
vi.mock('@/lib/encryption')

// Mock fetch for internal API calls
global.fetch = vi.fn()

describe('Transcription API Routes', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('POST /api/transcription/embeddings', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const request = new NextRequest('http://localhost/api/transcription/embeddings', {
        method: 'POST',
        body: JSON.stringify({ texts: ['Hello world'] }),
      })

      const response = await embeddingsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should generate embeddings successfully', async () => {
      // Mock user key data
      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            encrypted_key: 'encrypted-key',
            iv: 'iv-data',
            auth_tag: 'auth-tag'
          },
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFromQuery)
      vi.mocked(decryptKey).mockReturnValue('sk-test-key')

      // Mock OpenAI embeddings response
      const mockOpenAI = {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [
              { embedding: [0.1, 0.2, 0.3] },
              { embedding: [0.4, 0.5, 0.6] }
            ]
          })
        }
      }
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const request = new NextRequest('http://localhost/api/transcription/embeddings', {
        method: 'POST',
        body: JSON.stringify({ texts: ['Hello world', 'Goodbye world'] }),
      })

      const response = await embeddingsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.embeddings).toHaveLength(2)
      expect(data.embeddings[0]).toEqual([0.1, 0.2, 0.3])
      expect(data.embeddings[1]).toEqual([0.4, 0.5, 0.6])
    })

    it('should return 400 when texts array is missing', async () => {
      const request = new NextRequest('http://localhost/api/transcription/embeddings', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await embeddingsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('texts array is required')
    })
  })

  describe('POST /api/transcription/index', () => {
    it('should index transcriptions successfully', async () => {
      // Mock successful embedding fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        })
      } as Response)

      // Mock database insert
      const mockFromQuery = {
        upsert: vi.fn().mockResolvedValue({
          error: null
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      const transcriptItems = [
        {
          id: 'item-1',
          type: 'MESSAGE',
          role: 'user',
          content: 'Hello world test content',
          createdAtMs: Date.now()
        },
        {
          id: 'item-2', 
          type: 'MESSAGE',
          role: 'user',
          content: 'Another test message',
          createdAtMs: Date.now()
        }
      ]

      const request = new NextRequest('http://localhost/api/transcription/index', {
        method: 'POST',
        body: JSON.stringify({ 
          transcriptItems,
          sessionId: 'session-123'
        }),
      })

      const response = await indexPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.indexed).toBe(2)
      expect(data.message).toBe('Successfully indexed 2 transcription items')
    })

    it('should filter out items with insufficient content', async () => {
      const transcriptItems = [
        {
          id: 'item-1',
          type: 'MESSAGE',
          role: 'user', 
          content: 'Hi', // Too short
          createdAtMs: Date.now()
        },
        {
          id: 'item-2',
          type: 'MESSAGE',
          role: 'user',
          content: 'This is a long enough message to be indexed properly',
          createdAtMs: Date.now()
        }
      ]

      const request = new NextRequest('http://localhost/api/transcription/index', {
        method: 'POST',
        body: JSON.stringify({ transcriptItems }),
      })

      const response = await indexPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.indexed).toBe(0)
      expect(data.message).toBe('No items with sufficient content to index')
    })
  })

  describe('POST /api/transcription/search', () => {
    it('should search transcriptions successfully', async () => {
      // Mock successful embedding fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: [[0.1, 0.2, 0.3]]
        })
      } as Response)

      // Mock database search results
      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              transcript_id: 'item-1',
              content: 'Hello world',
              embedding: [0.1, 0.2, 0.3],
              metadata: {
                timestamp: Date.now(),
                role: 'user',
                wordCount: 2
              }
            }
          ],
          error: null
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFromQuery)

      const request = new NextRequest('http://localhost/api/transcription/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hello',
          limit: 10,
          threshold: 0.7
        }),
      })

      const response = await searchPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(1)
      expect(data.count).toBe(1)
      expect(data.query).toBe('hello')
    })

    it('should return 400 when query is missing', async () => {
      const request = new NextRequest('http://localhost/api/transcription/search', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await searchPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('query string is required')
    })
  })

  describe('Cleanup API', () => {
    describe('GET /api/transcription/cleanup', () => {
      it('should return cleanup status', async () => {
        // Mock total count query
        const mockFromQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
        }
        
        // First call for total count
        mockFromQuery.eq.mockReturnValueOnce({
          ...mockFromQuery,
          // Return 150 total items
          then: (callback: any) => callback({ data: new Array(150), error: null })
        })
        
        // Second call for old count  
        mockFromQuery.eq.mockReturnValueOnce({
          ...mockFromQuery,
          lt: vi.fn().mockReturnValue({
            ...mockFromQuery,
            // Return 120 old items
            then: (callback: any) => callback({ data: new Array(120), error: null })
          })
        })

        mockSupabaseClient.from.mockReturnValue(mockFromQuery)

        const request = new NextRequest('http://localhost/api/transcription/cleanup')

        const response = await cleanupGET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.totalTranscriptions).toBe(150)
        expect(data.oldTranscriptions).toBe(120)
        expect(data.cleanupRecommended).toBe(true) // >100 old items
      })
    })

    describe('POST /api/transcription/cleanup', () => {
      it('should cleanup old transcriptions', async () => {
        // Mock select old items
        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              { id: 'old-1', metadata: { timestamp: Date.now() - 86400000 * 35 } },
              { id: 'old-2', metadata: { timestamp: Date.now() - 86400000 * 40 } }
            ],
            error: null
          })
        }

        // Mock delete operation
        const deleteQuery = {
          delete: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            error: null
          })
        }

        mockSupabaseClient.from
          .mockReturnValueOnce(selectQuery) // First call for select
          .mockReturnValueOnce(deleteQuery) // Second call for delete

        const request = new NextRequest('http://localhost/api/transcription/cleanup', {
          method: 'POST',
          body: JSON.stringify({
            olderThanDays: 30,
            maxItems: 100
          }),
        })

        const response = await cleanupPOST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.deleted).toBe(2)
        expect(data.message).toBe('Successfully deleted 2 old transcription items')
      })
    })
  })
})