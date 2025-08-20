"use client"

import { AISdkChatbot } from '@/components/ai-sdk/chatbot'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Example implementation of the optimized AI SDK Chatbot
 * 
 * This demonstrates best practices for:
 * - Component configuration
 * - Error handling
 * - Message persistence
 * - Custom system prompts
 * - File upload handling
 */
export function AISdkChatbotExample() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant' as const,
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      createdAt: new Date(),
    },
  ])

  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful AI assistant. Be concise and friendly in your responses.'
  )

  const [apiConfig, setApiConfig] = useState({
    maxTokens: 1000,
    temperature: 0.7,
  })

  const [chatKey, setChatKey] = useState(0)

  const handleMessageFinish = (message: any) => {
    console.log('Message finished:', message)
    // Here you could save to database, analytics, etc.
  }

  const handleError = (error: Error) => {
    console.error('Chatbot error:', error)
    // Here you could implement custom error logging
  }

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: 'Chat cleared! How can I help you?',
      createdAt: new Date(),
    }])
    setChatKey((k) => k + 1)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI SDK Chatbot Example</h1>
        <p className="text-muted-foreground">
          Optimized implementation following AI SDK v4+ best practices
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Customize chatbot behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="system-prompt" className="text-sm font-medium">System Prompt</label>
              <textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full mt-1 p-2 border rounded text-sm"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="max-tokens" className="text-sm font-medium">Max Tokens</label>
              <input
                id="max-tokens"
                type="number"
                value={apiConfig.maxTokens}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10)
                  setApiConfig(prev => ({
                    ...prev,
                    maxTokens: Number.isNaN(next) ? 1000 : next
                  }))
                }}
                className="w-full mt-1 p-2 border rounded text-sm"
                min="100"
                max="4000"
              />
            </div>

            <div>
              <label htmlFor="temperature" className="text-sm font-medium">Temperature</label>
              <input
                id="temperature"
                type="number"
                value={apiConfig.temperature}
                onChange={(e) => {
                  const next = parseFloat(e.target.value)
                  setApiConfig(prev => ({
                    ...prev,
                    temperature: Number.isNaN(next) ? 0.7 : next
                  }))
                }}
                className="w-full mt-1 p-2 border rounded text-sm"
                min="0"
                max="2"
                step="0.1"
              />
            </div>

            <Button onClick={clearChat} variant="outline" className="w-full">
              Clear Chat
            </Button>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Features</h4>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Streaming</Badge>
                <Badge variant="secondary">File Upload</Badge>
                <Badge variant="secondary">Drag & Drop</Badge>
                <Badge variant="secondary">Keyboard Shortcuts</Badge>
                <Badge variant="secondary">Auto Scroll</Badge>
                <Badge variant="secondary">Error Handling</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chatbot */}
        <Card className="lg:col-span-3 h-[600px]">
          <AISdkChatbot
            key={chatKey}
            apiEndpoint="/api/chat"
            initialMessages={messages}
            systemPrompt={systemPrompt}
            maxTokens={apiConfig.maxTokens}
            temperature={apiConfig.temperature}
            onFinish={handleMessageFinish}
            onError={handleError}
            className="h-full"
            maxFiles={3}
            placeholder="Ask me anything... (Enter to send, Shift+Enter for new line)"
          />
        </Card>
      </div>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
              <ul className="text-sm space-y-1">
                <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - Send message</li>
                <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Shift</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - New line</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">File Upload</h4>
              <ul className="text-sm space-y-1">
                <li>• Click paperclip icon to select files</li>
                <li>• Drag and drop files into chat area</li>
                <li>• Support for multiple file types</li>
                <li>• Max 3 files per message</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Message Actions</h4>
              <ul className="text-sm space-y-1">
                <li>• Hover over messages to see actions</li>
                <li>• Regenerate assistant responses</li>
                <li>• Delete individual messages</li>
                <li>• Stop streaming responses</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Error Handling</h4>
              <ul className="text-sm space-y-1">
                <li>• Automatic error notifications</li>
                <li>• Graceful fallback for network issues</li>
                <li>• Message rollback on failure</li>
                <li>• Retry mechanisms built-in</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}