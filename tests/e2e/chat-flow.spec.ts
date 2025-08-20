import { test, expect } from '@playwright/test'

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat application
    await page.goto('/')
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle')
  })

  test('should load chat interface correctly', async ({ page }) => {
    // Check that main chat elements are present
    await expect(page.getByTestId('chat-container')).toBeVisible()
    await expect(page.getByTestId('chat-input') || page.getByRole('textbox')).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('should send a message and receive a response', async ({ page }) => {
    // Mock the AI response
    await page.route('**/api/chat', async (route) => {
      const request = route.request()
      const postData = request.postData()
      
      if (postData && JSON.parse(postData).messages) {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: 'data: {"type":"text","value":"Hello! How can I help you today?"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
        })
      } else {
        await route.continue()
      }
    })

    // Type a message
    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Hello, how are you?')
    
    // Send the message
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Wait for the user message to appear
    await expect(page.getByText('Hello, how are you?')).toBeVisible()

    // Wait for the AI response to appear
    await expect(page.getByText('Hello! How can I help you today?')).toBeVisible({ timeout: 10000 })

    // Verify the input is cleared after sending
    await expect(chatInput).toHaveValue('')
  })

  test('should handle empty messages gracefully', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    
    // Try to send empty message
    await sendButton.click()
    
    // Should not send anything or show error
    // The send button should be disabled or no message should appear
    await expect(page.getByText('Message cannot be empty')).toBeVisible()
      .or(expect(sendButton).toBeDisabled())
  })

  test('should display typing indicator while waiting for response', async ({ page }) => {
    // Mock a delayed response
    await page.route('**/api/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"Delayed response"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Test message')
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Check for loading/typing indicators
    await expect(page.getByTestId('typing-indicator') || 
                page.getByText(/typing/i) ||
                page.locator('[data-loading="true"]')).toBeVisible({ timeout: 1000 })

    // Wait for response
    await expect(page.getByText('Delayed response')).toBeVisible({ timeout: 5000 })
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock a network error
    await page.route('**/api/chat', async (route) => {
      await route.abort('failed')
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Test message')
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Should show error message
    await expect(page.getByText(/error/i) || 
                page.getByText(/something went wrong/i) ||
                page.getByText(/try again/i)).toBeVisible({ timeout: 10000 })
  })

  test('should display conversation history correctly', async ({ page }) => {
    // Mock multiple responses
    let messageCount = 0
    await page.route('**/api/chat', async (route) => {
      messageCount++
      const responses = [
        'Hello! How can I help you?',
        'That\'s a great question!',
        'I\'m here to assist you.'
      ]
      
      const response = responses[messageCount - 1] || 'Thank you for your message.'
      
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: `data: {"type":"text","value":"${response}"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n`,
      })
    })

    // Send first message
    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Hello')
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()
    
    await expect(page.getByText('Hello')).toBeVisible()
    await expect(page.getByText('Hello! How can I help you?')).toBeVisible()

    // Send second message
    await chatInput.fill('What can you do?')
    await sendButton.click()
    
    await expect(page.getByText('What can you do?')).toBeVisible()
    await expect(page.getByText('That\'s a great question!')).toBeVisible()

    // Verify both conversation turns are visible
    await expect(page.getByText('Hello')).toBeVisible()
    await expect(page.getByText('Hello! How can I help you?')).toBeVisible()
    await expect(page.getByText('What can you do?')).toBeVisible()
    await expect(page.getByText('That\'s a great question!')).toBeVisible()
  })

  test('should handle long messages correctly', async ({ page }) => {
    const longMessage = 'This is a very long message that contains a lot of text. '.repeat(20)
    
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"I received your long message!"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill(longMessage)
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Verify the long message is displayed (at least partially)
    await expect(page.getByText(/This is a very long message/)).toBeVisible()
    await expect(page.getByText('I received your long message!')).toBeVisible()
  })

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"Message sent via Enter!"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Testing Enter key')
    
    // Send message using Enter key
    await chatInput.press('Enter')

    await expect(page.getByText('Testing Enter key')).toBeVisible()
    await expect(page.getByText('Message sent via Enter!')).toBeVisible()
  })

  test('should handle API rate limits', async ({ page }) => {
    // Mock rate limit response
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      })
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Test rate limit')
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Should show rate limit error
    await expect(page.getByText(/rate limit/i) || 
                page.getByText(/try again later/i)).toBeVisible({ timeout: 10000 })
  })

  test('should handle server errors gracefully', async ({ page }) => {
    // Mock server error
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Test server error')
    
    const sendButton = page.getByRole('button', { name: /send/i }) || 
                      page.getByTestId('send-button')
    await sendButton.click()

    // Should show server error message
    await expect(page.getByText(/error/i) || 
                page.getByText(/something went wrong/i)).toBeVisible({ timeout: 10000 })
  })
})