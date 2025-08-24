'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranscriptionStore, transcriptionSelectors } from '@/lib/stores/transcription-store'
import { useRealtimeTranscription } from '@/hooks/use-realtime-transcription'
import { Transcriber } from './transcriber'
import { TranscriptionSearch } from './transcription-search'
import { 
  XIcon, 
  MicrophoneIcon, 
  MicrophoneSlashIcon, 
  CopyIcon,
  DownloadIcon,
  SettingsIcon,
  MagnifyingGlassIcon,
  ClockIcon
} from '@phosphor-icons/react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface TranscriptionPanelProps {
  className?: string
  onTranscriptionSelect?: (text: string) => void
}

export function TranscriptionPanel({ 
  className,
  onTranscriptionSelect 
}: TranscriptionPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  const {
    isPanelOpen,
    isTranscribing,
    sessionStatus,
    finalTranscription,
    currentTranscription,
    transcriptItems,
    error,
    closePanel,
    stopTranscription,
    exportTranscript,
    clearTranscript
  } = useTranscriptionStore()

  const isConnected = useTranscriptionStore(transcriptionSelectors.isConnected)
  const hasContent = useTranscriptionStore(transcriptionSelectors.hasContent)

  const { disconnect } = useRealtimeTranscription()

  const handleClose = useCallback(() => {
    if (isTranscribing || isConnected) {
      stopTranscription()
      disconnect()
    }
    closePanel()
  }, [isTranscribing, isConnected, stopTranscription, disconnect, closePanel])

  const handleCopyAll = useCallback(async () => {
    try {
      const transcriptText = exportTranscript()
      await navigator.clipboard.writeText(transcriptText)
      toast({
        title: 'All transcriptions copied',
        status: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to copy transcriptions',
        status: 'error'
      })
    }
  }, [exportTranscript])

  const handleDownload = useCallback(() => {
    const transcriptText = exportTranscript()
    const blob = new Blob([transcriptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: 'Transcript downloaded',
      status: 'success'
    })
  }, [exportTranscript])

  const handleSendToChat = useCallback(() => {
    const textToSend = finalTranscription || currentTranscription
    if (textToSend && onTranscriptionSelect) {
      onTranscriptionSelect(textToSend)
      toast({
        title: 'Text sent to chat',
        status: 'success'
      })
    }
  }, [finalTranscription, currentTranscription, onTranscriptionSelect])

  const handleSelectTranscriptItem = useCallback((text: string) => {
    if (onTranscriptionSelect) {
      onTranscriptionSelect(text)
      toast({
        title: 'Text sent to chat',
        status: 'success'
      })
    }
  }, [onTranscriptionSelect])

  // Auto-minimize when no content and not recording
  useEffect(() => {
    if (!hasContent && !isTranscribing && !isConnected) {
      setIsMinimized(true)
    } else {
      setIsMinimized(false)
    }
  }, [hasContent, isTranscribing, isConnected])

  return (
    <Sheet open={isPanelOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent 
        side="right" 
        className={cn(
          "w-full sm:w-[500px] flex flex-col",
          className
        )}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <SheetTitle className="flex items-center gap-2">
            {isTranscribing || isConnected ? (
              <MicrophoneIcon className="h-5 w-5 text-primary animate-pulse" />
            ) : (
              <MicrophoneSlashIcon className="h-5 w-5 text-muted-foreground" />
            )}
            Voice Transcription
          </SheetTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant={
              sessionStatus === 'connected' ? 'default' :
              sessionStatus === 'connecting' ? 'secondary' :
              sessionStatus === 'error' ? 'destructive' : 'outline'
            }>
              {sessionStatus === 'connected' ? 'Recording' :
               sessionStatus === 'connecting' ? 'Connecting' :
               sessionStatus === 'error' ? 'Error' : 'Stopped'}
            </Badge>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pb-4">
          {(finalTranscription || currentTranscription) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendToChat}
              className="flex-1 min-w-0"
            >
              Send to Chat
            </Button>
          )}
          
          {hasContent && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAll}
                className="h-9 w-9 p-0"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-9 w-9 p-0"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <Separator />

        {/* Current transcription preview */}
        {(currentTranscription || finalTranscription) && (
          <div className="py-4 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Current Transcription
            </div>
            <div 
              className="p-3 bg-muted rounded-lg text-sm cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSelectTranscriptItem(finalTranscription || currentTranscription)}
            >
              {finalTranscription || currentTranscription}
              {currentTranscription && !finalTranscription && (
                <span className="animate-pulse ml-1">|</span>
              )}
            </div>
            <Separator />
          </div>
        )}

        {/* Main content with tabs */}
        <div className="flex-1 min-h-0">
          <Tabs defaultValue="live" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="live" className="flex items-center gap-2">
                <MicrophoneIcon className="h-4 w-4" />
                Live
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <MagnifyingGlassIcon className="h-4 w-4" />
                Search
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="live" className="flex-1 min-h-0 mt-4">
              <Transcriber 
                className="h-full border-0 shadow-none"
                showHeader={false}
                maxHeight="100%"
              />
            </TabsContent>
            
            <TabsContent value="search" className="flex-1 min-h-0 mt-4">
              <TranscriptionSearch
                onTranscriptionSelect={onTranscriptionSelect}
                className="h-full border-0 shadow-none"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom actions */}
        {hasContent && (
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {transcriptItems.length} messages
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearTranscript}
              >
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mt-4">
            <p className="text-sm text-destructive font-medium">Error</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        )}

        {/* Empty state with instructions */}
        {!hasContent && !error && !isConnected && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-sm">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <MicrophoneIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Start Voice Transcription</h3>
                <p className="text-sm text-muted-foreground">
                  Click the microphone button in the chat to start recording. Your speech will be transcribed in real-time.
                </p>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-current rounded-full" />
                  Clear, high-quality audio works best
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-current rounded-full" />
                  Click any transcribed text to send to chat
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-current rounded-full" />
                  Your transcriptions are saved for this session
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}