import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fileSearchTool, searchMultipleStores } from '@/lib/tools/file-search'

// Integration tests for file search functionality
// These tests mock external APIs but test the full integration flow

// Mock environment variables for tests
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: vi.fn().mockImplementation(async (query, storeId, openai, config) => {
    // Simulate realistic API responses based on store ID
    const mockResponses = {
      'store-documents': [
        {
          id: 'doc1',
          file_id: 'doc1',
          file_name: 'technical-guide.pdf',
          content: 'This is a comprehensive technical guide covering advanced topics in software development.',
          score: 0.92,
          metadata: { type: 'pdf', pages: 50 }
        },
        {
          id: 'doc2', 
          file_id: 'doc2',
          file_name: 'api-reference.md',
          content: 'API reference documentation with detailed endpoint descriptions and examples.',
          score: 0.87,
          metadata: { type: 'markdown', sections: 12 }
        }
      ],
      'store-research': [
        {
          id: 'research1',
          file_id: 'research1', 
          file_name: 'ml-research-paper.pdf',
          content: 'Research paper on machine learning algorithms and their practical applications.',
          score: 0.89,
          metadata: { type: 'pdf', authors: ['Dr. Smith', 'Dr. Jones'] }
        }
      ],
      'store-empty': [],
      'store-error': null // This will cause the mock to throw
    }

    if (storeId === 'store-error') {
      throw new Error('Simulated API error')
    }

    const results = mockResponses[storeId as keyof typeof mockResponses] || []
    
    // Apply topK limit if specified
    const limit = config?.topK || 5
    return results.slice(0, limit)
  })
}))

// Mock OpenAI constructor
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: {
        vectorStores: {
          list: vi.fn().mockResolvedValue({
            data: [
              { id: 'store-documents', name: 'Documents Store' },
              { id: 'store-research', name: 'Research Store' }
            ]
          }),
          create: vi.fn().mockResolvedValue({
            id: 'new-store-123',
            name: 'New Store'
          })
        }
      }
    }))
  }
})

describe('File Search Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Single Store Search Integration', () => {
    it('should perform end-to-end search with realistic data', async () => {
      const result = await fileSearchTool.execute({
        query: 'technical documentation',
        max_results: 5,
        vector_store_id: 'store-documents',
        enable_rewriting: true,
        enable_reranking: true
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(result.query).toBe('technical documentation')
      expect(result.enhanced_query).toContain('Query enhanced with')
      
      // Check result structure and content
      const firstResult = result.results[0]
      expect(firstResult).toMatchObject({
        rank: 1,
        file_id: 'doc1',
        file_name: 'technical-guide.pdf',
        score: 0.92
      })
      expect(firstResult.content).toContain('This is a comprehensive technical guide')

      // Verify search configuration
      expect(result.search_config).toMatchObject({
        vector_store_id: 'store-documents',
        query_rewriting: true,
        rewrite_strategy: 'expansion',
        reranking: true,
        reranking_method: 'semantic'
      })
    })

    it('should handle search with file type filtering', async () => {
      const result = await fileSearchTool.execute({
        query: 'API documentation',
        max_results: 3,
        file_types: ['pdf', 'md'],
        vector_store_id: 'store-documents'
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(2)
      
      // Results should be filtered by file types in metadata
      const fileTypes = result.results.map(r => r.metadata?.type)
      expect(fileTypes).toEqual(['pdf', 'markdown'])
    })

    it('should generate appropriate summary for results', async () => {
      const result = await fileSearchTool.execute({
        query: 'machine learning research',
        vector_store_id: 'store-research'
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(true)
      expect(result.summary).toContain('Found 1 relevant document')
      expect(result.summary).toContain('89% relevance')
    })

    it('should handle empty results gracefully', async () => {
      const result = await fileSearchTool.execute({
        query: 'non-existent topic',
        vector_store_id: 'store-empty'
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(0)
      expect(result.summary).toBe('No relevant documents found. Try rephrasing your query or uploading more documents.')
    })
  })

  describe('Multi-Store Search Integration', () => {
    it('should search across multiple stores and combine results', async () => {
      const result = await searchMultipleStores(
        'test-integration-key',
        'comprehensive documentation',
        ['store-documents', 'store-research'],
        {
          topK: 5,
          reranking: true,
          queryRewriting: true,
          rewriteStrategy: 'expansion'
        }
      )

      expect(result).toHaveLength(3) // 2 from documents + 1 from research
      
      // Results should be sorted by score descending
      const scores = result.map(r => r.score)
      expect(scores).toEqual(scores.slice().sort((a, b) => b - a))
      
      // Should contain results from both stores
      const fileNames = result.map(r => r.file_name)
      expect(fileNames).toContain('technical-guide.pdf')
      expect(fileNames).toContain('ml-research-paper.pdf')
    })

    it('should handle mixed success/failure across stores', async () => {
      const result = await searchMultipleStores(
        'test-integration-key',
        'test query',
        ['store-documents', 'store-error', 'store-research'],
        { topK: 10 }
      )

      // Should return results from successful stores only
      expect(result).toHaveLength(3) // 2 from documents + 1 from research
      expect(result.every(r => r.file_name !== undefined)).toBe(true)
    })

    it('should apply diversity filtering in multi-store search', async () => {
      // Create a scenario with many results from the same document type
      vi.mocked(require('@/lib/retrieval/query-rewriting').enhancedRetrieval)
        .mockResolvedValue([
          ...Array.from({ length: 8 }, (_, i) => ({
            id: `same${i}`,
            file_id: `same${i}`,
            file_name: 'repeated-doc.pdf', // Same file name
            content: `Content variation ${i}`,
            score: 0.9 - i * 0.01
          }))
        ])

      const result = await searchMultipleStores(
        'test-integration-key',
        'repeated content',
        ['store-documents'],
        { topK: 5, reranking: true }
      )

      // Should limit results from same file due to diversity filtering
      expect(result).toHaveLength(2) // Max 2 per file name
      expect(result.every(r => r.file_name === 'repeated-doc.pdf')).toBe(true)
    })

    it('should handle performance with many stores', async () => {
      const manyStores = Array.from({ length: 10 }, (_, i) => `store-${i}`)
      
      // Mock to return small result sets for each store
      vi.mocked(require('@/lib/retrieval/query-rewriting').enhancedRetrieval)
        .mockImplementation(async (query, storeId) => [
          {
            id: `result-${storeId}`,
            file_id: `file-${storeId}`,
            file_name: `document-${storeId}.pdf`,
            content: `Content from ${storeId}`,
            score: 0.8 + Math.random() * 0.2
          }
        ])

      const startTime = Date.now()
      const result = await searchMultipleStores(
        'test-integration-key',
        'performance test',
        manyStores,
        { topK: 5 }
      )
      const duration = Date.now() - startTime

      expect(result).toHaveLength(5) // Limited by topK
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Results should be from different stores
      const uniqueStores = new Set(result.map(r => r.file_name.split('-')[1]))
      expect(uniqueStores.size).toBe(5)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API rate limiting gracefully', async () => {
      vi.mocked(require('@/lib/retrieval/query-rewriting').enhancedRetrieval)
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const result = await fileSearchTool.execute({
        query: 'rate limited query',
        vector_store_id: 'store-documents'
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
      expect(result.results).toEqual([])
    })

    it('should handle network timeout in multi-store search', async () => {
      vi.mocked(require('@/lib/retrieval/query-rewriting').enhancedRetrieval)
        .mockImplementation(async (query, storeId) => {
          if (storeId === 'store-timeout') {
            await new Promise(resolve => setTimeout(resolve, 100))
            throw new Error('Request timeout')
          }
          return [{
            id: 'success-result',
            file_id: 'success-result', 
            file_name: 'success.pdf',
            content: 'Successful content',
            score: 0.9
          }]
        })

      const result = await searchMultipleStores(
        'test-integration-key',
        'timeout test',
        ['store-documents', 'store-timeout'],
        { topK: 5 }
      )

      // Should return results from successful store
      expect(result).toHaveLength(1)
      expect(result[0].file_name).toBe('success.pdf')
    })
  })

  describe('Configuration Integration', () => {
    it('should respect different rewriting strategies', async () => {
      const strategies = ['expansion', 'refinement', 'decomposition', 'multi-perspective'] as const
      
      for (const strategy of strategies) {
        const result = await fileSearchTool.execute({
          query: 'strategy test',
          vector_store_id: 'store-documents',
          rewrite_strategy: strategy,
          enable_rewriting: true
        }, { apiKey: 'test-integration-key' })

        expect(result.success).toBe(true)
        expect(result.enhanced_query).toContain(`Query enhanced with ${strategy}`)
        expect(result.search_config.rewrite_strategy).toBe(strategy)
      }
    })

    it('should respect different reranking methods', async () => {
      const methods = ['semantic', 'cross-encoder', 'diversity'] as const
      
      for (const method of methods) {
        const result = await fileSearchTool.execute({
          query: 'reranking test',
          vector_store_id: 'store-documents',
          reranking_method: method,
          enable_reranking: true
        }, { apiKey: 'test-integration-key' })

        expect(result.success).toBe(true)
        expect(result.search_config.reranking_method).toBe(method)
      }
    })

    it('should handle max_results parameter correctly', async () => {
      const result = await fileSearchTool.execute({
        query: 'max results test',
        max_results: 1,
        vector_store_id: 'store-documents'
      }, { apiKey: 'test-integration-key' })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(1) // Limited by max_results
      expect(result.total_results).toBe(1)
    })
  })
})