'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranscriptionStore, transcriptionSelectors } from '@/lib/stores/transcription-store'
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, UserIcon } from '@phosphor-icons/react'
import { toast } from '@/components/ui/toast'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import type { TranscriptItem } from '@/lib/types/transcription'

interface TranscriberProps {
  className?: string
  showHeader?: boolean
  maxHeight?: string | number
}

export function Transcriber({ 
  className, 
  showHeader = true, 
  maxHeight = '600px' 
}: TranscriberProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  const {
    transcriptItems,
    currentTranscription,
    sessionStatus,
    settings,
    error,
    updateTranscriptItem,
    clearTranscript,
    exportTranscript
  } = useTranscriptionStore()

  const hasContent = useTranscriptionStore(transcriptionSelectors.hasContent)
  const isConnected = useTranscriptionStore(transcriptionSelectors.isConnected)

  // Auto-scroll to bottom when new items are added
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [transcriptItems, currentTranscription, scrollToBottom])

  const handleCopyTranscript = useCallback(async () => {
    try {
      const transcriptText = exportTranscript()
      await navigator.clipboard.writeText(transcriptText)
      toast({
        title: 'Transcript copied to clipboard',
        status: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to copy transcript',
        status: 'error'
      })
    }
  }, [exportTranscript])

  const handleToggleBreadcrumb = useCallback((id: string) => {
    const item = transcriptItems.find(item => item.id === id)
    if (item) {
      updateTranscriptItem(id, { isExpanded: !item.isExpanded })
    }
  }, [transcriptItems, updateTranscriptItem])

  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }, [])

  const renderTranscriptItem = useCallback((item: TranscriptItem) => {
    if (item.type === 'BREADCRUMB') {
      return (
        <div key={item.id} className="flex items-center gap-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleBreadcrumb(item.id)}
            className="h-6 w-6 p-0"
          >
            {item.isExpanded ? (
              <ChevronUpIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )}
          </Button>
          <Badge variant="outline" className="text-xs">
            {item.content}
          </Badge>
          {settings.showTimestamps && (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(item.createdAtMs)}
            </span>
          )}
          {item.isExpanded && item.data && (
            <div className="ml-6 mt-2 p-2 bg-muted rounded text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(item.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={item.id} className="flex gap-3 py-4">
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(
            "text-xs font-medium",
            item.role === 'user' 
              ? "bg-blue-500 text-white" 
              : "bg-green-500 text-white"
          )}>
            {item.role === 'user' ? <UserIcon className="h-4 w-4" /> : 'AI'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {item.role === 'user' ? 'You' : 'Assistant'}
            </span>
            {settings.showTimestamps && (
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(item.createdAtMs)}
              </span>
            )}
          </div>
          
          <div className={cn(
            "rounded-lg px-3 py-2 text-sm prose prose-sm max-w-none",
            item.role === 'user' 
              ? "bg-blue-50 dark:bg-blue-950/50" 
              : "bg-muted"
          )}>
            {item.content.includes('\n') || item.content.includes('*') ? (
              <ReactMarkdown
                remarkPlugins={[remarkBreaks, remarkGfm]}
                className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              >
                {item.content}
              </ReactMarkdown>
            ) : (
              <p className="m-0">{item.content}</p>
            )}
          </div>
        </div>
      </div>
    )
  }, [settings.showTimestamps, formatTimestamp, handleToggleBreadcrumb])

  return (
    <Card className={cn("flex flex-col", className)}>
      {showHeader && (
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Live Transcript</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={
              sessionStatus === 'connected' ? 'default' :
              sessionStatus === 'connecting' ? 'secondary' :
              sessionStatus === 'error' ? 'destructive' : 'outline'
            }>
              {sessionStatus === 'connected' ? 'Recording' :
               sessionStatus === 'connecting' ? 'Connecting' :
               sessionStatus === 'error' ? 'Error' : 'Disconnected'}
            </Badge>
            
            {hasContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyTranscript}
                className="h-8 w-8 p-0"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent className="flex-1 p-0">
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-full"
          style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
        >
          <div className="p-4 space-y-2">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">Error</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            )}

            {!hasContent && !error && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground">
                    {isConnected 
                      ? "Start speaking to see your transcription..." 
                      : "Click the microphone button to start transcribing"
                    }
                  </div>
                  {sessionStatus === 'connecting' && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Connecting...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Render transcript items */}
            {transcriptItems.map(renderTranscriptItem)}

            {/* Show current transcription (partial) */}
            {currentTranscription && (
              <div className="flex gap-3 py-4 opacity-75">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-500 text-white text-xs font-medium">
                    <UserIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">You</span>
                    <Badge variant="secondary" className="text-xs">
                      Speaking...
                    </Badge>
                  </div>
                  
                  <div className="rounded-lg px-3 py-2 text-sm bg-blue-50 dark:bg-blue-950/50">
                    {currentTranscription}
                    <span className="animate-pulse">|</span>
                  </div>
                </div>
              </div>
            )}

            {hasContent && (
              <>
                <Separator className="my-4" />
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearTranscript}
                    className="text-xs"
                  >
                    Clear Transcript
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}