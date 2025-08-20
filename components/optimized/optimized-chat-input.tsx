"use client"

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useOptimizedChat } from '@/lib/hooks/use-optimized-chat'
import { Send, StopCircle, Paperclip, Search } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedChatInputProps {
  chatId: string | null
  userId: string | null
  onSubmit?: () => void
  className?: string
}

export const OptimizedChatInput = memo(function OptimizedChatInput({
  chatId,
  userId,
  onSubmit,
  className,
}: OptimizedChatInputProps) {
  const {
    input,
    handleInputChange,
    handleSubmit,
    handleStop,
    isSubmitting,
    canSubmit,
    files,
    setFiles,
    enableSearch,
    setEnableSearch,
    status,
  } = useOptimizedChat({
    chatId,
    userId,
  })
  
  const [isDragging, setIsDragging] = useState(false)
  
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
        onSubmit?.()
      }
    },
    [handleSubmit, onSubmit]
  )
  
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      setFiles((prev) => [...prev, ...selectedFiles])
    },
    [setFiles]
  )
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      
      const droppedFiles = Array.from(e.dataTransfer.files)
      setFiles((prev) => [...prev, ...droppedFiles])
    },
    [setFiles]
  )
  
  const removeFile = useCallback(
    (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index))
    },
    [setFiles]
  )
  
  const isStreaming = status === 'in_progress'
  
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 p-4 border rounded-lg',
        isDragging && 'border-primary bg-primary/5',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[200px] truncate">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="ml-1 hover:text-destructive"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 min-h-[60px] max-h-[200px] resize-none"
          disabled={isSubmitting}
        />
        
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setEnableSearch(!enableSearch)}
            className={cn(enableSearch && 'bg-primary/10')}
          >
            <Search className="h-4 w-4" />
          </Button>
          
          <label htmlFor="file-upload">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              as="span"
              className="cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isSubmitting}
            />
          </label>
          
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleStop}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={() => {
                handleSubmit()
                onSubmit?.()
              }}
              disabled={!canSubmit}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})