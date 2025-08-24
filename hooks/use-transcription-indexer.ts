'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranscriptionStore } from '@/lib/stores/transcription-store'
import { TranscriptionIndexer } from '@/lib/vector-store/transcription-indexer'
import { createClient } from '@/lib/supabase/client'
import type { TranscriptItem } from '@/lib/types/transcription'
import { toast } from '@/components/ui/toast'

interface UseTranscriptionIndexerOptions {
  userId?: string
  autoIndex?: boolean
}

export function useTranscriptionIndexer({
  userId,
  autoIndex = true
}: UseTranscriptionIndexerOptions = {}) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  
  const {
    transcriptItems,
    currentSession
  } = useTranscriptionStore()

  // Get user's OpenAI API key
  const { data: apiKey } = useQuery({
    queryKey: ['openai-api-key', userId],
    queryFn: async () => {
      if (!userId) return null
      
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (error || !data?.api_key) {
        throw new Error('OpenAI API key not found')
      }

      return data.api_key
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Create indexer instance
  const indexer = useMemo(() => {
    if (!apiKey) return null
    return new TranscriptionIndexer(apiKey)
  }, [apiKey])

  // Index a single transcription
  const indexTranscriptionMutation = useMutation({
    mutationFn: async ({
      transcriptItem,
      sessionId
    }: {
      transcriptItem: TranscriptItem
      sessionId?: string
    }) => {
      if (!indexer || !userId) {
        throw new Error('Indexer not available')
      }
      
      await indexer.indexTranscription(userId, transcriptItem, sessionId)
    },
    onSuccess: () => {
      // Invalidate search queries to refresh results
      queryClient.invalidateQueries({ 
        queryKey: ['transcription-search', userId] 
      })
    },
    onError: (error) => {
      console.error('Failed to index transcription:', error)
      toast({
        title: 'Indexing failed',
        description: 'Failed to save transcription for search',
        status: 'error'
      })
    }
  })

  // Bulk index transcriptions
  const bulkIndexMutation = useMutation({
    mutationFn: async ({
      transcriptItems,
      sessionId
    }: {
      transcriptItems: TranscriptItem[]
      sessionId?: string
    }) => {
      if (!indexer || !userId) {
        throw new Error('Indexer not available')
      }
      
      await indexer.indexTranscriptions(userId, transcriptItems, sessionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['transcription-search', userId] 
      })
      toast({
        title: 'Transcriptions indexed',
        description: 'Your transcriptions have been saved for search',
        status: 'success'
      })
    },
    onError: (error) => {
      console.error('Failed to bulk index transcriptions:', error)
      toast({
        title: 'Bulk indexing failed',
        description: 'Some transcriptions may not be searchable',
        status: 'error'
      })
    }
  })

  // Search transcriptions
  const searchTranscriptions = useCallback(
    (query: string, options: {
      limit?: number
      threshold?: number
      sessionId?: string
    } = {}) => {
      return useQuery({
        queryKey: ['transcription-search', userId, query, options],
        queryFn: async () => {
          if (!indexer || !userId || !query.trim()) {
            return []
          }
          
          return await indexer.searchTranscriptions(userId, query, options)
        },
        enabled: !!indexer && !!userId && !!query.trim(),
        staleTime: 1000 * 60, // 1 minute
      })
    },
    [indexer, userId]
  )

  // Get session transcriptions
  const { data: sessionTranscriptions } = useQuery({
    queryKey: ['session-transcriptions', userId, currentSession?.id],
    queryFn: async () => {
      if (!indexer || !userId || !currentSession?.id) {
        return []
      }
      
      return await indexer.getSessionTranscriptions(userId, currentSession.id)
    },
    enabled: !!indexer && !!userId && !!currentSession?.id,
    staleTime: 1000 * 30, // 30 seconds
  })

  // Auto-index new transcriptions
  useEffect(() => {
    if (!autoIndex || !userId || !indexer || transcriptItems.length === 0) {
      return
    }

    // Find unindexed transcriptions (simple check - in production you'd want to track this)
    const recentItems = transcriptItems.filter(item => 
      item.type === 'MESSAGE' && 
      item.content.trim().length >= 10 &&
      Date.now() - item.createdAtMs < 5000 // Only index items from last 5 seconds
    )

    if (recentItems.length > 0) {
      recentItems.forEach(item => {
        indexTranscriptionMutation.mutate({
          transcriptItem: item,
          sessionId: currentSession?.id
        })
      })
    }
  }, [
    transcriptItems, 
    userId, 
    indexer, 
    autoIndex, 
    currentSession?.id,
    indexTranscriptionMutation
  ])

  // Delete transcription from index
  const deleteTranscriptionMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      if (!indexer || !userId) {
        throw new Error('Indexer not available')
      }
      
      await indexer.deleteTranscription(userId, transcriptId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['transcription-search', userId] 
      })
    },
    onError: (error) => {
      console.error('Failed to delete transcription:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to remove transcription from search',
        status: 'error'
      })
    }
  })

  // Clear all transcriptions
  const clearTranscriptionsMutation = useMutation({
    mutationFn: async () => {
      if (!indexer || !userId) {
        throw new Error('Indexer not available')
      }
      
      await indexer.clearUserTranscriptions(userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['transcription-search', userId] 
      })
      toast({
        title: 'Transcriptions cleared',
        description: 'All transcriptions removed from search',
        status: 'success'
      })
    },
    onError: (error) => {
      console.error('Failed to clear transcriptions:', error)
      toast({
        title: 'Clear failed',
        description: 'Failed to clear transcription history',
        status: 'error'
      })
    }
  })

  return {
    // State
    isIndexerReady: !!indexer,
    sessionTranscriptions: sessionTranscriptions || [],
    
    // Actions
    indexTranscription: (transcriptItem: TranscriptItem, sessionId?: string) =>
      indexTranscriptionMutation.mutate({ transcriptItem, sessionId }),
    
    bulkIndexTranscriptions: (transcriptItems: TranscriptItem[], sessionId?: string) =>
      bulkIndexMutation.mutate({ transcriptItems, sessionId }),
    
    searchTranscriptions,
    
    deleteTranscription: (transcriptId: string) =>
      deleteTranscriptionMutation.mutate(transcriptId),
    
    clearTranscriptions: () =>
      clearTranscriptionsMutation.mutate(),
    
    // Status
    isIndexing: indexTranscriptionMutation.isPending || bulkIndexMutation.isPending,
    isDeleting: deleteTranscriptionMutation.isPending,
    isClearing: clearTranscriptionsMutation.isPending,
    
    // Errors
    indexError: indexTranscriptionMutation.error,
    deleteError: deleteTranscriptionMutation.error,
    clearError: clearTranscriptionsMutation.error
  }
}