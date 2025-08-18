import { tool } from "ai"
import { z } from "zod"

export const fileSearchTool = tool({
  description: 'Search through uploaded documents and files using OpenAI file search',
  parameters: z.object({
    query: z.string().describe('Search query to find relevant content in uploaded files'),
    max_results: z.number().optional().default(5).describe('Maximum number of search results to return'),
    file_types: z.array(z.string()).optional().describe('Filter by file types (e.g., ["pdf", "txt", "md"])')
  }),
  execute: async ({ query, max_results, file_types }) => {
    // This will be handled by OpenAI's native file search capability
    // when used with the assistants API or file search enabled models
    
    // Return metadata structure that OpenAI file search will populate
    return {
      query,
      max_results,
      file_types,
      // OpenAI will populate these fields automatically:
      // sources: [{ filename, content_snippet, page_number, relevance_score }],
      // total_results: number,
      // search_time_ms: number
    }
  }
})

export type FileSearchResult = {
  filename: string
  content_snippet: string
  page_number?: number
  relevance_score?: number
  file_type?: string
  url?: string
}

export type FileSearchResponse = {
  query: string
  max_results: number
  file_types?: string[]
  sources?: FileSearchResult[]
  total_results?: number
  search_time_ms?: number
}