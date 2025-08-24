'use client'

import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useTranscriptionIndexer } from '@/hooks/use-transcription-indexer'
import { useUser } from '@/lib/user-store/provider'
import { 
  MagnifyingGlassIcon, 
  XIcon, 
  ClockIcon,
  UserIcon,
  SpeakerHighIcon,
  CopyIcon
} from '@phosphor-icons/react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { TranscriptItem } from '@/lib/types/transcription'

interface TranscriptionSearchProps {
  className?: string
  onTranscriptionSelect?: (text: string) => void
  placeholder?: string
  showSessionFilter?: boolean
}

export function TranscriptionSearch({
  className,
  onTranscriptionSelect,
  placeholder = "Search your transcriptions...",
  showSessionFilter = false
}: TranscriptionSearchProps) {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOptions, setSearchOptions] = useState({
    limit: 10,
    threshold: 0.7,
    sessionId: undefined as string | undefined
  })

  const {
    searchTranscriptions,
    sessionTranscriptions,
    isIndexerReady
  } = useTranscriptionIndexer({
    userId: user?.id,
    autoIndex: true
  })

  // Execute search
  const { 
    data: searchResults = [], 
    isLoading: isSearching,
    error: searchError 
  } = searchTranscriptions(searchQuery, searchOptions)

  // Combine and deduplicate results
  const displayResults = useMemo(() => {
    const results = [...searchResults]
    
    // Add recent session transcriptions if no search query
    if (!searchQuery.trim() && sessionTranscriptions.length > 0) {
      const recentSession = sessionTranscriptions.slice(-5).reverse()
      results.unshift(...recentSession)
    }

    // Deduplicate by ID
    const seen = new Set()
    return results.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [searchResults, sessionTranscriptions, searchQuery])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  const handleTranscriptionClick = useCallback((item: TranscriptItem) => {
    if (onTranscriptionSelect) {
      onTranscriptionSelect(item.content)
    }
  }, [onTranscriptionSelect])

  const handleCopyTranscription = useCallback(async (item: TranscriptItem, event: React.MouseEvent) => {
    event.stopPropagation()
    
    try {
      await navigator.clipboard.writeText(item.content)
      toast({
        title: 'Transcription copied',
        status: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        status: 'error'
      })
    }
  }, [])

  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffHours = diffMs / (1000 * 60 * 60)
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }, [])

  const getRelevanceColor = useCallback((similarity?: number) => {
    if (!similarity) return 'bg-muted'
    
    if (similarity > 0.9) return 'bg-green-100 dark:bg-green-900/20'
    if (similarity > 0.8) return 'bg-blue-100 dark:bg-blue-900/20'
    if (similarity > 0.7) return 'bg-yellow-100 dark:bg-yellow-900/20'
    return 'bg-muted'
  }, [])

  if (!isIndexerReady) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <div className="text-muted-foreground">Transcription search not available</div>
            <div className="text-sm text-muted-foreground">
              Please check your OpenAI API key in settings
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MagnifyingGlassIcon className="h-5 w-5" />
          Search Transcriptions
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search options */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            variant={searchOptions.threshold === 0.9 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchOptions(prev => ({ ...prev, threshold: 0.9 }))}
            className="h-7"
          >
            Exact matches
          </Button>
          <Button
            variant={searchOptions.threshold === 0.7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchOptions(prev => ({ ...prev, threshold: 0.7 }))}
            className="h-7"
          >
            Similar matches
          </Button>
          <Button
            variant={searchOptions.threshold === 0.5 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchOptions(prev => ({ ...prev, threshold: 0.5 }))}
            className="h-7"
          >
            Broad search
          </Button>
        </div>

        <Separator />

        {/* Search status */}
        {isSearching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            Searching transcriptions...
          </div>
        )}

        {searchError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              Search failed: {searchError instanceof Error ? searchError.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Results */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {displayResults.length === 0 && !isSearching && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No transcriptions found' : 'Start speaking to see your transcriptions here'}
              </div>
            )}

            {displayResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handleTranscriptionClick(item)}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm group",
                  getRelevanceColor(item.data?.similarity)
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                      item.role === 'user' 
                        ? "bg-blue-500 text-white" 
                        : "bg-green-500 text-white"
                    )}>
                      {item.role === 'user' ? (
                        <UserIcon className="h-3 w-3" />
                      ) : (
                        <SpeakerHighIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {item.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="h-3 w-3" />
                      {formatTimestamp(item.createdAtMs)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {item.data?.similarity && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {Math.round(item.data.similarity * 100)}%
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleCopyTranscription(item, e)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CopyIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-foreground line-clamp-3 leading-relaxed">
                  {item.content}
                </p>
                
                {item.data?.wordCount && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.data.wordCount} words
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        {displayResults.length > 0 && (
          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            Showing {displayResults.length} transcription{displayResults.length === 1 ? '' : 's'}
            {searchQuery && ' • Click any result to use in chat'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}