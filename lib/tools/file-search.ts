import { tool } from 'ai'
import { z } from 'zod'
import OpenAI from 'openai'
import { enhancedRetrieval, type RetrievalPipelineConfig } from '@/lib/retrieval/query-rewriting'
import { createOptimizedPrompt, addSecurityContext } from '@/lib/prompt-engineering/best-practices'

interface FileSearchResult {
  file_id: string
  file_name: string
  content: string
  score: number
  metadata?: Record<string, any>
}

export const fileSearchTool = tool({
  description: 'Advanced search through uploaded documents using OpenAI vector stores with query rewriting and reranking',
  inputSchema: z.object({
    query: z.string().describe('Search query to find relevant information'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to return'),
    file_types: z.array(z.string()).optional().describe('Filter by file types (e.g., pdf, txt, docx)'),
    vector_store_id: z.string().optional().describe('Specific vector store to search in'),
    enable_rewriting: z.boolean().optional().default(true).describe('Enable query rewriting for better results'),
    rewrite_strategy: z.enum(['expansion', 'refinement', 'decomposition', 'multi-perspective']).optional().default('expansion'),
    enable_reranking: z.boolean().optional().default(true).describe('Enable result reranking'),
    reranking_method: z.enum(['semantic', 'cross-encoder', 'diversity']).optional().default('semantic'),
  }),
  execute: async ({ 
    query, 
    max_results = 5, 
    file_types, 
    vector_store_id,
    enable_rewriting = true,
    rewrite_strategy = 'expansion',
    enable_reranking = true,
    reranking_method = 'semantic'
  }, { apiKey }) => {
    try {
      if (!apiKey) {
        throw new Error('OpenAI API key is required for file search')
      }

      const openai = new OpenAI({ apiKey })

      // If no vector store ID provided, get the default one or create a new one
      if (!vector_store_id) {
        // Try to get the user's default vector store
        const stores = await openai.beta.vectorStores.list({ limit: 1 })
        if (stores.data.length > 0) {
          vector_store_id = stores.data[0].id
        } else {
          // Create a new vector store if none exists
          const newStore = await openai.beta.vectorStores.create({
            name: 'Base Chat Default Store',
            metadata: {
              created_by: 'Base Chat',
              purpose: 'file_search'
            }
          })
          vector_store_id = newStore.id
        }
      }

      // Configure retrieval pipeline
      const retrievalConfig: RetrievalPipelineConfig = {
        queryRewriting: enable_rewriting,
        rewriteStrategy: rewrite_strategy,
        reranking: enable_reranking,
        rerankingMethod: reranking_method,
        topK: max_results,
        metadataFilters: file_types ? { fileTypes: file_types } : undefined,
      }

      // Use enhanced retrieval with query rewriting and reranking
      const results = await enhancedRetrieval(
        query,
        vector_store_id,
        openai,
        retrievalConfig
      )

      // Format results for output
      const formattedResults = results.map((result, index) => ({
        rank: index + 1,
        file_id: result.file_id || result.id,
        file_name: result.file_name || `Document ${index + 1}`,
        content: result.content.substring(0, 500) + '...',
        score: result.score,
        metadata: result.metadata,
      }))

      // Create a summary of the search results
      const summary = formattedResults.length > 0
        ? `Found ${formattedResults.length} relevant documents. Top result has ${Math.round(formattedResults[0].score * 100)}% relevance.`
        : 'No relevant documents found. Try rephrasing your query or uploading more documents.'

      return {
        success: true,
        query,
        enhanced_query: enable_rewriting ? `Query enhanced with ${rewrite_strategy} strategy` : query,
        results: formattedResults,
        total_results: formattedResults.length,
        summary,
        search_config: {
          vector_store_id,
          query_rewriting: enable_rewriting,
          rewrite_strategy,
          reranking: enable_reranking,
          reranking_method,
        }
      }
    } catch (error) {
      console.error('File search error:', error)
      return {
        success: false,
        query,
        results: [],
        total_results: 0,
        error: error instanceof Error ? error.message : 'Failed to perform file search',
      }
    }
  },
})

// Enhanced vector store creation with optimized settings
export async function createVectorStore(
  apiKey: string,
  name: string,
  fileIds: string[],
  metadata?: Record<string, any>
): Promise<string> {
  const openai = new OpenAI({ apiKey })

  try {
    const vectorStore = await openai.beta.vectorStores.create({
      name,
      file_ids: fileIds,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        file_count: fileIds.length,
      },
      chunking_strategy: {
        type: 'static',
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        }
      }
    } as any)

    return vectorStore.id
  } catch (error) {
    console.error('Error creating vector store:', error)
    throw new Error('Failed to create vector store')
  }
}

// Enhanced file upload with metadata extraction
export async function uploadFileForSearch(
  apiKey: string,
  file: File | Buffer,
  fileName: string,
  purpose: 'assistants' = 'assistants',
  metadata?: Record<string, any>
): Promise<string> {
  const openai = new OpenAI({ apiKey })

  try {
    // Extract file extension for metadata
    const fileExtension = fileName.split('.').pop()?.toLowerCase()
    
    const uploadedFile = await openai.files.create({
      file: file as any,
      purpose,
    })

    // Store metadata for better search
    if (metadata) {
      // In a real implementation, you would store this metadata
      // in your database linked to the file ID
      console.log('File metadata:', {
        file_id: uploadedFile.id,
        file_name: fileName,
        file_type: fileExtension,
        ...metadata
      })
    }

    return uploadedFile.id
  } catch (error) {
    console.error('Error uploading file:', error)
    throw new Error('Failed to upload file for search')
  }
}

// Helper function to enable file search on an assistant with enhanced configuration
export function enableFileSearchForAssistant(assistantConfig: any, vectorStoreIds: string[] = []) {
  return {
    ...assistantConfig,
    tools: [
      ...(assistantConfig.tools || []),
      { 
        type: 'file_search',
        file_search: {
          max_num_results: 10,
          ranking_options: {
            ranker: 'default_2024_08_21',
            score_threshold: 0.5,
          }
        }
      },
    ],
    tool_resources: {
      file_search: {
        vector_store_ids: vectorStoreIds.length > 0 ? vectorStoreIds : assistantConfig.vector_store_ids || [],
      },
    },
  }
}

// Batch file upload for efficiency
export async function batchUploadFiles(
  apiKey: string,
  files: Array<{ file: File | Buffer; name: string; metadata?: Record<string, any> }>,
  vectorStoreName: string
): Promise<{ vectorStoreId: string; fileIds: string[] }> {
  const openai = new OpenAI({ apiKey })
  
  try {
    // Upload all files in parallel
    const uploadPromises = files.map(({ file, name, metadata }) => 
      uploadFileForSearch(apiKey, file, name, 'assistants', metadata)
    )
    
    const fileIds = await Promise.all(uploadPromises)
    
    // Create vector store with all files
    const vectorStoreId = await createVectorStore(
      apiKey,
      vectorStoreName,
      fileIds,
      {
        total_files: files.length,
        batch_upload: true,
      }
    )
    
    return { vectorStoreId, fileIds }
  } catch (error) {
    console.error('Error in batch upload:', error)
    throw new Error('Failed to batch upload files')
  }
}

// Search across multiple vector stores
export async function searchMultipleStores(
  apiKey: string,
  query: string,
  vectorStoreIds: string[],
  config?: RetrievalPipelineConfig
): Promise<FileSearchResult[]> {
  const openai = new OpenAI({ apiKey })
  
  try {
    // Search each vector store in parallel
    const searchPromises = vectorStoreIds.map(storeId =>
      enhancedRetrieval(query, storeId, openai, config)
    )
    
    const allResults = await Promise.all(searchPromises)
    
    // Combine and deduplicate results
    const combinedResults = allResults.flat()
    const uniqueResults = Array.from(
      new Map(combinedResults.map(r => [r.id, r])).values()
    )
    
    // Re-rank combined results
    if (config?.reranking) {
      // Apply final reranking on combined results
      return uniqueResults.sort((a, b) => b.score - a.score).slice(0, config.topK || 5)
    }
    
    return uniqueResults
  } catch (error) {
    console.error('Error searching multiple stores:', error)
    throw new Error('Failed to search across multiple vector stores')
  }
}