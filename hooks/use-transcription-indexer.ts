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

  // Create indexer instance (no longer needs API key)
  const indexer = useMemo(() => {
    return new TranscriptionIndexer()
  }, [])

  // Index a single transcription
  const indexTranscriptionMutation = useMutation({
    mutationFn: async ({
      transcriptItem,
      sessionId
    }: {
      transcriptItem: TranscriptItem
      sessionId?: string
    }) => {
      if (!userId) {
        throw new Error('User ID required')
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
      if (!userId) {
        throw new Error('User ID required')
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
          if (!userId || !query.trim()) {
            return []
          }
          
          return await indexer.searchTranscriptions(userId, query, options)
        },
        enabled: !!userId && !!query.trim(),
        staleTime: 1000 * 60, // 1 minute
      })
    },
[userId]
  )

  // Get session transcriptions
  const { data: sessionTranscriptions } = useQuery({
    queryKey: ['session-transcriptions', userId, currentSession?.id],
    queryFn: async () => {
      if (!userId || !currentSession?.id) {
        return []
      }
      
      return await indexer.getSessionTranscriptions(userId, currentSession.id)
    },
    enabled: !!userId && !!currentSession?.id,
    staleTime: 1000 * 30, // 30 seconds
  })

  // Auto-index new transcriptions
  useEffect(() => {
    if (!autoIndex || !userId || transcriptItems.length === 0) {
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
    autoIndex, 
    currentSession?.id,
    indexTranscriptionMutation
  ])

  // Delete transcription from index
  const deleteTranscriptionMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      if (!userId) {
        throw new Error('User ID required')
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
      if (!userId) {
        throw new Error('User ID required')
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

  // Clean up old transcriptions
  const cleanupTranscriptionsMutation = useMutation({
    mutationFn: async (options: { olderThanDays?: number; maxItems?: number } = {}) => {
      return await indexer.cleanupOldTranscriptions(options)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ 
        queryKey: ['transcription-search', userId] 
      })
      queryClient.invalidateQueries({ 
        queryKey: ['cleanup-status', userId] 
      })
      toast({
        title: 'Cleanup complete',
        description: `Deleted ${result.deleted} old transcriptions`,
        status: 'success'
      })
    },
    onError: (error) => {
      console.error('Failed to cleanup transcriptions:', error)
      toast({
        title: 'Cleanup failed',
        description: 'Failed to clean up old transcriptions',
        status: 'error'
      })
    }
  })

  // Get cleanup status
  const { data: cleanupStatus } = useQuery({
    queryKey: ['cleanup-status', userId],
    queryFn: async () => {
      if (!userId) return null
      return await indexer.getCleanupStatus()
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    // State
    isIndexerReady: true, // Always ready now since no API key dependency
    sessionTranscriptions: sessionTranscriptions || [],
    cleanupStatus: cleanupStatus || null,
    
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

    cleanupOldTranscriptions: (options?: { olderThanDays?: number; maxItems?: number }) =>
      cleanupTranscriptionsMutation.mutate(options),
    
    // Status
    isIndexing: indexTranscriptionMutation.isPending || bulkIndexMutation.isPending,
    isDeleting: deleteTranscriptionMutation.isPending,
    isClearing: clearTranscriptionsMutation.isPending,
    isCleaning: cleanupTranscriptionsMutation.isPending,
    
    // Errors
    indexError: indexTranscriptionMutation.error,
    deleteError: deleteTranscriptionMutation.error,
    clearError: clearTranscriptionsMutation.error,
    cleanupError: cleanupTranscriptionsMutation.error
  }
}