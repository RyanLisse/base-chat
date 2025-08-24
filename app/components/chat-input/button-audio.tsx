'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranscriptionStore, transcriptionSelectors } from '@/lib/stores/transcription-store'
import { useRealtimeTranscription } from '@/hooks/use-realtime-transcription'
import { MicrophoneIcon, MicrophoneSlashIcon, WaveformIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useState } from 'react'

interface ButtonAudioProps {
  className?: string
  disabled?: boolean
  isAuthenticated: boolean
}

export function ButtonAudio({ 
  className, 
  disabled = false,
  isAuthenticated 
}: ButtonAudioProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  
  const {
    isTranscribing,
    sessionStatus,
    error,
    startTranscription,
    stopTranscription,
    openPanel
  } = useTranscriptionStore()

  const isConnected = useTranscriptionStore(transcriptionSelectors.isConnected)
  const canTranscribe = useTranscriptionStore(transcriptionSelectors.canTranscribe)

  const { connect, disconnect, isConnecting } = useRealtimeTranscription({
    onConnectionChange: (connected) => {
      if (connected) {
        setPulseKey(prev => prev + 1) // Trigger animation
      }
    },
    onTranscriptionUpdate: (text, isFinal) => {
      // Handle transcription updates
      console.log('Transcription update:', { text, isFinal })
    },
    onError: (error) => {
      console.error('WebRTC error:', error)
    }
  })

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      // Could show auth dialog here
      return
    }

    if (isTranscribing || isConnected) {
      // Stop transcription
      stopTranscription()
      disconnect()
    } else {
      // Start transcription
      startTranscription()
      openPanel()
      await connect()
    }
  }, [
    isAuthenticated,
    isTranscribing,
    isConnected,
    startTranscription,
    stopTranscription,
    openPanel,
    connect,
    disconnect
  ])

  // Reset pulse animation after it completes
  useEffect(() => {
    if (pulseKey > 0) {
      const timer = setTimeout(() => setPulseKey(0), 2000)
      return () => clearTimeout(timer)
    }
  }, [pulseKey])

  const getIcon = () => {
    if (error) {
      return <MicrophoneSlashIcon className="h-4 w-4" />
    }
    
    if (isTranscribing || isConnected) {
      return <WaveformIcon className="h-4 w-4" />
    }
    
    return <MicrophoneIcon className="h-4 w-4" />
  }

  const getTooltipText = () => {
    if (!isAuthenticated) {
      return 'Sign in to use voice transcription'
    }
    
    if (error) {
      return `Error: ${error}`
    }
    
    if (isConnecting) {
      return 'Connecting to transcription service...'
    }
    
    if (isTranscribing || isConnected) {
      return 'Stop voice transcription'
    }
    
    return 'Start voice transcription'
  }

  const getButtonVariant = () => {
    if (error) {
      return 'destructive'
    }
    
    if (isTranscribing || isConnected) {
      return 'default'
    }
    
    return 'ghost'
  }

  const isLoading = sessionStatus === 'connecting' || isConnecting

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={getButtonVariant()}
            size="sm"
            className={cn(
              "relative size-9 rounded-full transition-all duration-200",
              // Pulse animation when recording
              (isTranscribing || isConnected) && "animate-pulse",
              // Hover effects
              isHovered && !disabled && "scale-105",
              // Error state
              error && "border-destructive",
              // Connected state with subtle glow
              (isTranscribing || isConnected) && !error && [
                "bg-primary text-primary-foreground",
                "shadow-lg shadow-primary/25",
                pulseKey > 0 && "animate-ping"
              ],
              className
            )}
            disabled={disabled || isLoading}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label={getTooltipText()}
          >
            {/* Background pulse effect for recording state */}
            {(isTranscribing || isConnected) && !error && (
              <div 
                key={pulseKey}
                className={cn(
                  "absolute inset-0 rounded-full bg-primary/20",
                  pulseKey > 0 && "animate-ping"
                )}
              />
            )}
            
            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            )}
            
            {/* Icon */}
            <div className={cn(
              "relative z-10 transition-transform duration-200",
              isLoading && "opacity-0",
              (isTranscribing || isConnected) && "scale-110"
            )}>
              {getIcon()}
            </div>

            {/* Recording indicator dots */}
            {(isTranscribing || isConnected) && !error && (
              <div className="absolute -top-1 -right-1 flex space-x-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse delay-75" />
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse delay-150" />
              </div>
            )}
            
            {/* Error indicator */}
            {error && (
              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}