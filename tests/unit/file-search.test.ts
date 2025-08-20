import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import OpenAI from 'openai'
import {
  fileSearchTool,
  createVectorStore,
  uploadFileForSearch,
  enableFileSearchForAssistant,
  batchUploadFiles,
  searchMultipleStores,
} from '@/lib/tools/file-search'

// Mock OpenAI
vi.mock('openai')
const MockedOpenAI = vi.mocked(OpenAI)

// Mock the retrieval function
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: vi.fn(),
}))

import { enhancedRetrieval } from '@/lib/retrieval/query-rewriting'
const mockedEnhancedRetrieval = vi.mocked(enhancedRetrieval)

describe('File Search Module', () => {
  let mockOpenAI: {
    beta: {
      vectorStores: {
        list: Mock
        create: Mock
      }
    }
    files: {
      create: Mock
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOpenAI = {
      beta: {
        vectorStores: {
          list: vi.fn(),
          create: vi.fn(),
        },
      },
      files: {
        create: vi.fn(),
      },
    }

    MockedOpenAI.mockImplementation(() => mockOpenAI as any)
  })

  describe('fileSearchTool', () => {
    it('should handle successful search with default vector store', async () => {
      const mockResults = [
        {
          id: 'file1',
          file_id: 'file1',
          file_name: 'document1.pdf',
          content: 'This is a test document with relevant content for the search query',
          score: 0.95,
          metadata: { type: 'pdf' }
        }
      ]

      mockOpenAI.beta.vectorStores.list.mockResolvedValue({
        data: [{ id: 'store1', name: 'Default Store' }]
      })
      
      mockedEnhancedRetrieval.mockResolvedValue(mockResults)

      const result = await fileSearchTool.execute({
        query: 'test query',
        max_results: 5,
      }, { apiKey: 'test-api-key' })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toMatchObject({
        rank: 1,
        file_id: 'file1',
        file_name: 'document1.pdf',
        score: 0.95
      })
      expect(result.total_results).toBe(1)
    })

    it('should create new vector store if none exists', async () => {
      mockOpenAI.beta.vectorStores.list.mockResolvedValue({ data: [] })
      mockOpenAI.beta.vectorStores.create.mockResolvedValue({
        id: 'new-store-id',
        name: 'Base Chat Default Store'
      })
      mockedEnhancedRetrieval.mockResolvedValue([])

      const result = await fileSearchTool.execute({
        query: 'test query',
      }, { apiKey: 'test-api-key' })

      expect(mockOpenAI.beta.vectorStores.create).toHaveBeenCalledWith({
        name: 'Base Chat Default Store',
        metadata: {
          created_by: 'Base Chat',
          purpose: 'file_search'
        }
      })
      expect(result.success).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      mockOpenAI.beta.vectorStores.list.mockRejectedValue(new Error('API Error'))

      const result = await fileSearchTool.execute({
        query: 'test query',
      }, { apiKey: 'test-api-key' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('API Error')
      expect(result.results).toEqual([])
    })

    it('should require API key', async () => {
      const result = await fileSearchTool.execute({
        query: 'test query',
      }, {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('OpenAI API key is required for file search')
    })

    it('should handle query rewriting options', async () => {
      mockOpenAI.beta.vectorStores.list.mockResolvedValue({
        data: [{ id: 'store1' }]
      })
      mockedEnhancedRetrieval.mockResolvedValue([])

      await fileSearchTool.execute({
        query: 'test query',
        enable_rewriting: true,
        rewrite_strategy: 'expansion',
        enable_reranking: true,
        reranking_method: 'semantic',
      }, { apiKey: 'test-api-key' })

      expect(mockedEnhancedRetrieval).toHaveBeenCalledWith(
        'test query',
        'store1',
        expect.any(Object),
        expect.objectContaining({
          queryRewriting: true,
          rewriteStrategy: 'expansion',
          reranking: true,
          rerankingMethod: 'semantic',
        })
      )
    })
  })

  describe('createVectorStore', () => {
    it('should create vector store with files and metadata', async () => {
      const mockStore = {
        id: 'vector-store-123',
        name: 'Test Store',
      }
      
      mockOpenAI.beta.vectorStores.create.mockResolvedValue(mockStore)

      const result = await createVectorStore(
        'test-api-key',
        'Test Store',
        ['file1', 'file2'],
        { custom: 'metadata' }
      )

      expect(result).toBe('vector-store-123')
      expect(mockOpenAI.beta.vectorStores.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Store',
          file_ids: ['file1', 'file2'],
          metadata: expect.objectContaining({
            custom: 'metadata',
            file_count: 2,
          }),
          chunking_strategy: {
            type: 'static',
            static: {
              max_chunk_size_tokens: 800,
              chunk_overlap_tokens: 400,
            }
          }
        })
      )
    })

    it('should handle creation errors', async () => {
      mockOpenAI.beta.vectorStores.create.mockRejectedValue(new Error('Creation failed'))

      await expect(createVectorStore('test-api-key', 'Test Store', ['file1']))
        .rejects.toThrow('Failed to create vector store')
    })
  })

  describe('uploadFileForSearch', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      mockOpenAI.files.create.mockResolvedValue({ id: 'file-123' })

      const result = await uploadFileForSearch(
        'test-api-key',
        mockFile,
        'test.txt',
        'assistants',
        { custom: 'metadata' }
      )

      expect(result).toBe('file-123')
      expect(mockOpenAI.files.create).toHaveBeenCalledWith({
        file: mockFile,
        purpose: 'assistants',
      })
    })

    it('should handle upload errors', async () => {
      mockOpenAI.files.create.mockRejectedValue(new Error('Upload failed'))

      await expect(uploadFileForSearch('test-api-key', new File([''], 'test.txt'), 'test.txt'))
        .rejects.toThrow('Failed to upload file for search')
    })
  })

  describe('enableFileSearchForAssistant', () => {
    it('should add file search tool to assistant config', () => {
      const assistantConfig = {
        name: 'Test Assistant',
        tools: [{ type: 'code_interpreter' }],
      }

      const result = enableFileSearchForAssistant(assistantConfig, ['store1', 'store2'])

      expect(result.tools).toHaveLength(2)
      expect(result.tools[1]).toEqual({
        type: 'file_search',
        file_search: {
          max_num_results: 10,
          ranking_options: {
            ranker: 'default_2024_08_21',
            score_threshold: 0.5,
          }
        }
      })
      expect(result.tool_resources.file_search.vector_store_ids).toEqual(['store1', 'store2'])
    })

    it('should handle empty vector store list', () => {
      const assistantConfig = { name: 'Test Assistant' }
      const result = enableFileSearchForAssistant(assistantConfig)

      expect(result.tool_resources.file_search.vector_store_ids).toEqual([])
    })
  })

  describe('batchUploadFiles', () => {
    it('should upload files in parallel and create vector store', async () => {
      const files = [
        { file: new File(['1'], '1.txt'), name: '1.txt' },
        { file: new File(['2'], '2.txt'), name: '2.txt' },
      ]

      mockOpenAI.files.create
        .mockResolvedValueOnce({ id: 'file1' })
        .mockResolvedValueOnce({ id: 'file2' })
      
      mockOpenAI.beta.vectorStores.create.mockResolvedValue({ id: 'store123' })

      const result = await batchUploadFiles('test-api-key', files, 'Batch Store')

      expect(result).toEqual({
        vectorStoreId: 'store123',
        fileIds: ['file1', 'file2']
      })
      expect(mockOpenAI.files.create).toHaveBeenCalledTimes(2)
    })

    it('should handle batch upload errors', async () => {
      mockOpenAI.files.create.mockRejectedValue(new Error('Upload failed'))

      await expect(batchUploadFiles('test-api-key', [{ file: new File([''], 'test.txt'), name: 'test.txt' }], 'Test Store'))
        .rejects.toThrow('Failed to batch upload files')
    })
  })

  describe('searchMultipleStores', () => {
    const mockResults1 = [
      { id: 'r1', file_id: 'f1', file_name: 'doc1.pdf', content: 'content 1', score: 0.9 },
      { id: 'r2', file_id: 'f2', file_name: 'doc2.pdf', content: 'content 2', score: 0.8 },
    ]
    
    const mockResults2 = [
      { id: 'r3', file_id: 'f3', file_name: 'doc3.pdf', content: 'content 3', score: 0.85 },
      { id: 'r1', file_id: 'f1', file_name: 'doc1.pdf', content: 'content 1', score: 0.88 }, // Duplicate
    ]

    it('should search multiple stores and deduplicate results', async () => {
      mockedEnhancedRetrieval
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2)

      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1', 'store2']
      )

      expect(result).toHaveLength(3) // Deduplicated
      expect(result[0].score).toBe(0.9) // Highest score result kept
      expect(result.map(r => r.id)).toEqual(['r1', 'r3', 'r2']) // Sorted by score descending
    })

    it('should handle empty vector store list', async () => {
      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        []
      )

      expect(result).toEqual([])
    })

    it('should validate input parameters', async () => {
      await expect(searchMultipleStores('', 'test query', ['store1']))
        .rejects.toThrow('API key is required for multi-store search')

      await expect(searchMultipleStores('api-key', '', ['store1']))
        .rejects.toThrow('Query cannot be empty')

      await expect(searchMultipleStores('api-key', '   ', ['store1']))
        .rejects.toThrow('Query cannot be empty')
    })

    it('should handle individual store failures gracefully', async () => {
      mockedEnhancedRetrieval
        .mockResolvedValueOnce(mockResults1)
        .mockRejectedValueOnce(new Error('Store 2 failed'))

      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1', 'store2']
      )

      expect(result).toHaveLength(2) // Only results from successful store
      expect(result.map(r => r.id)).toEqual(['r1', 'r2'])
    })

    it('should apply diversity filtering', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        file_id: `f${i}`,
        file_name: i < 5 ? 'same-file.pdf' : `unique-file-${i}.pdf`,
        content: `content ${i}`,
        score: 0.9 - i * 0.01
      }))

      mockedEnhancedRetrieval.mockResolvedValueOnce(manyResults)

      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1'],
        { topK: 5, reranking: true }
      )

      expect(result).toHaveLength(5)
      
      // Count results per file name
      const fileNameCounts = result.reduce((acc, r) => {
        acc[r.file_name] = (acc[r.file_name] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Should have max 2 results from same-file.pdf due to diversity filtering
      expect(fileNameCounts['same-file.pdf']).toBeLessThanOrEqual(2)
    })

    it('should handle config options correctly', async () => {
      mockedEnhancedRetrieval.mockResolvedValue(mockResults1)

      await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1'],
        {
          topK: 3,
          reranking: true,
          queryRewriting: false,
        }
      )

      expect(mockedEnhancedRetrieval).toHaveBeenCalledWith(
        'test query',
        'store1',
        expect.any(Object),
        expect.objectContaining({
          topK: 5, // Increased for better ranking (3 * 1.5 rounded up)
          reranking: true,
          queryRewriting: false,
        })
      )
    })

    it('should return empty array when all stores fail', async () => {
      mockedEnhancedRetrieval.mockRejectedValue(new Error('All stores failed'))

      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1', 'store2']
      )

      expect(result).toEqual([])
    })

    it('should handle no results from any store', async () => {
      mockedEnhancedRetrieval.mockResolvedValue([])

      const result = await searchMultipleStores(
        'test-api-key',
        'test query',
        ['store1', 'store2']
      )

      expect(result).toEqual([])
    })
  })
})