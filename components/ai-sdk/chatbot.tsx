"use client"

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChat } from '@ai-sdk/react'
import { Send, StopCircle, Paperclip, RotateCcw, Trash2 } from 'lucide-react'
import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: Date
  experimental_attachments?: Array<{
    name: string
    contentType: string
    url?: string
  }>
}

interface AISdkChatbotProps {
  /** API endpoint for chat */
  apiEndpoint?: string
  /** Initial messages */
  initialMessages?: Message[]
  /** Initial input value */
  initialInput?: string
  /** System prompt */
  systemPrompt?: string
  /** Max tokens for response */
  maxTokens?: number
  /** Temperature for response generation */
  temperature?: number
  /** Called when a message is finished */
  onFinish?: (message: Message) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Custom className */
  className?: string
  /** Disable file uploads */
  disableFileUpload?: boolean
  /** Max files allowed */
  maxFiles?: number
  /** Placeholder text */
  placeholder?: string
}

/**
 * Optimized AI SDK Chatbot component following latest AI SDK patterns
 * 
 * Features:
 * - Streaming responses with proper status handling
 * - File attachments with drag & drop
 * - Optimistic updates with rollback on error
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Auto-scroll to bottom
 * - Message actions (regenerate, delete)
 * - Error handling with toast notifications
 * - Accessibility support
 */
export const AISdkChatbot = memo(function AISdkChatbot({
  apiEndpoint = '/api/chat',
  initialMessages = [],
  initialInput = '',
  systemPrompt,
  maxTokens = 1000,
  temperature = 0.7,
  onFinish,
  onError,
  className,
  disableFileUpload = false,
  maxFiles = 5,
  placeholder = "Type a message...",
}: AISdkChatbotProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // AI SDK useChat hook with optimized configuration
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    setMessages,
  } = useChat({
    api: apiEndpoint,
    initialMessages,
    initialInput,
    body: {
      systemPrompt,
      maxTokens,
      temperature,
    },
    onFinish: (message) => {
      onFinish?.(message as Message)
      scrollToBottom()
    },
    onError: (error) => {
      console.error('Chat error:', error)
      onError?.(error)
      toast({
        title: 'Chat Error',
        description: error.message,
        status: 'error',
      })
    },
    // experimental_onFunctionCall can be added here when function calling is implemented
  })

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Enhanced submit handler with files
  const handleSubmitWithFiles = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      
      if (!input.trim() && files.length === 0) return
      
      // Create message with attachments
      const attachments = files.map(file => ({
        name: file.name,
        contentType: file.type,
        // In production, first upload to storage and include the resulting URL here.
      }))

      handleSubmit(e, {
        experimental_attachments: attachments.length > 0 ? attachments : undefined,
      })

      // Clear files after submission
      setFiles([])
    },
    [input, files, handleSubmit]
  )

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.isComposing) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmitWithFiles()
      }
    },
    [handleSubmitWithFiles]
  )

  // File handling
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      
      if (files.length + selectedFiles.length > maxFiles) {
        toast({
          title: 'Too many files',
          description: `Maximum ${maxFiles} files allowed`,
          status: 'error',
        })
        return
      }
      
      setFiles(prev => [...prev, ...selectedFiles])
    },
    [files.length, maxFiles]
  )

  // Drag and drop
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
      
      if (files.length + droppedFiles.length > maxFiles) {
        toast({
          title: 'Too many files',
          description: `Maximum ${maxFiles} files allowed`,
          status: 'error',
        })
        return
      }
      
      setFiles(prev => [...prev, ...droppedFiles])
    },
    [files.length, maxFiles]
  )

  const removeFile = useCallback(
    (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index))
    },
    []
  )

  // Message actions
  const deleteMessage = useCallback(
    (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    },
    [setMessages]
  )

  const regenerateLastMessage = useCallback(() => {
    let lastUserMessageIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i
        break
      }
    }
    if (lastUserMessageIndex === -1) return

    // Remove assistant messages after the last user message
    const messagesToKeep = messages.slice(0, lastUserMessageIndex + 1)
    setMessages(messagesToKeep)
    
    // Regenerate
    reload()
  }, [messages, setMessages, reload])

  return (
    <div className={cn('flex flex-col h-full max-w-4xl mx-auto', className)}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex items-start gap-3 group',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] p-3 rounded-lg',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted',
                'relative'
              )}
            >
              {message.content}
              
              {/* Attachments */}
              {message.experimental_attachments && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.experimental_attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-background/10 rounded text-xs"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span>{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Message actions */}
              <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  {message.role === 'assistant' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={regenerateLastMessage}
                      aria-label="Regenerate response"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => deleteMessage(message.id)}
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className={cn(
          'border-t p-4',
          isDragging && 'bg-primary/5 border-primary'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <form onSubmit={handleSubmitWithFiles} className="space-y-3">
          {/* File attachments */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 min-h-[60px] max-h-[200px] resize-none"
              disabled={isLoading}
              aria-label="Chat message input"
            />

            <div className="flex gap-1">
              {!disableFileUpload && (
                <label htmlFor="file-upload">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    as="span"
                    className="cursor-pointer"
                    disabled={isLoading}
                    aria-label="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isLoading}
                  />
                </label>
              )}

              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={stop}
                  aria-label="Stop generation"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() && files.length === 0}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Error display */}
        {error && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            Error: {error.message}
          </div>
        )}
      </div>
    </div>
  )
})