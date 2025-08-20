import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('File Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display file upload button', async ({ page }) => {
    // Look for file upload button or input
    await expect(
      page.getByRole('button', { name: /upload/i }) ||
      page.getByRole('button', { name: /attach/i }) ||
      page.getByTestId('file-upload-button') ||
      page.locator('input[type="file"]')
    ).toBeVisible()
  })

  test('should handle text file upload', async ({ page }) => {
    // Create a test file
    const testContent = 'This is a test file for upload testing.'
    
    // Mock the file upload API
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"I can see you uploaded a text file!"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    // Handle file chooser
    const fileChooserPromise = page.waitForEvent('filechooser')
    
    // Click upload button
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByRole('button', { name: /attach/i }) ||
                        page.getByTestId('file-upload-button')
    
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    
    // Create a temporary test file
    const testFile = path.join(__dirname, '../fixtures/test-file.txt')
    await fileChooser.setFiles([{
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent)
    }])

    // Verify file is displayed
    await expect(page.getByText('test-file.txt')).toBeVisible()

    // Send message with file
    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Please analyze this file')
    
    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    // Wait for response
    await expect(page.getByText('I can see you uploaded a text file!')).toBeVisible()
  })

  test('should handle PDF file upload', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"I\'ve analyzed your PDF document."}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles([{
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%test pdf content')
    }])

    await expect(page.getByText('test-document.pdf')).toBeVisible()

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Analyze this document')
    
    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    await expect(page.getByText('I\'ve analyzed your PDF document.')).toBeVisible()
  })

  test('should handle multiple file uploads', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"I can see multiple files uploaded!"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles([
      {
        name: 'file1.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('File 1 content')
      },
      {
        name: 'file2.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('File 2 content')
      }
    ])

    // Verify both files are displayed
    await expect(page.getByText('file1.txt')).toBeVisible()
    await expect(page.getByText('file2.txt')).toBeVisible()

    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Process these files')
    
    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    await expect(page.getByText('I can see multiple files uploaded!')).toBeVisible()
  })

  test('should remove files when delete button is clicked', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles([{
      name: 'removable-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test content')
    }])

    // Verify file is displayed
    await expect(page.getByText('removable-file.txt')).toBeVisible()

    // Click remove/delete button
    const removeButton = page.getByRole('button', { name: /remove/i }) ||
                         page.getByRole('button', { name: /delete/i }) ||
                         page.getByTestId('remove-file-button') ||
                         page.locator('[data-remove-file]')
    
    await removeButton.click()

    // Verify file is removed
    await expect(page.getByText('removable-file.txt')).not.toBeVisible()
  })

  test('should show error for unsupported file types', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    
    // Try to upload an unsupported file type
    await fileChooser.setFiles([{
      name: 'test-executable.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake executable content')
    }])

    // Should show error message
    await expect(
      page.getByText(/unsupported file type/i) ||
      page.getByText(/file type not allowed/i) ||
      page.getByText(/invalid file/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('should handle file size limits', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    
    // Try to upload a large file (mock)
    const largeFileContent = 'x'.repeat(50 * 1024 * 1024) // 50MB
    await fileChooser.setFiles([{
      name: 'large-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(largeFileContent)
    }])

    // Should show file size error
    await expect(
      page.getByText(/file too large/i) ||
      page.getByText(/size limit/i) ||
      page.getByText(/maximum file size/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('should display file upload progress', async ({ page }) => {
    // Mock slow upload
    await page.route('**/api/upload**', async (route) => {
      // Simulate slow upload
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, url: 'mock-url' })
      })
    })

    const fileChooserPromise = page.waitForEvent('filechooser')
    
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles([{
      name: 'upload-progress.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('File content for progress testing')
    }])

    // Should show upload progress indicator
    await expect(
      page.getByTestId('upload-progress') ||
      page.locator('[role="progressbar"]') ||
      page.getByText(/uploading/i)
    ).toBeVisible({ timeout: 1000 })
  })

  test('should handle drag and drop file upload', async ({ page }) => {
    // Create a test file for drag and drop
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      const file = new File(['drag and drop test content'], 'dragged-file.txt', {
        type: 'text/plain'
      })
      dt.items.add(file)
      return dt
    })

    // Find the drop zone (could be the chat input area or a specific drop zone)
    const dropZone = page.getByTestId('file-drop-zone') ||
                    page.getByTestId('chat-container') ||
                    page.locator('body')

    // Simulate drag and drop
    await dropZone.dispatchEvent('dragenter', { dataTransfer })
    await dropZone.dispatchEvent('dragover', { dataTransfer })
    await dropZone.dispatchEvent('drop', { dataTransfer })

    // Verify file is added
    await expect(page.getByText('dragged-file.txt')).toBeVisible({ timeout: 5000 })
  })

  test('should clear files after successful message send', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: 'data: {"type":"text","value":"Message sent successfully!"}\n\ndata: {"type":"finish_reason","value":"stop"}\n\n',
      })
    })

    // Upload a file
    const fileChooserPromise = page.waitForEvent('filechooser')
    const uploadButton = page.getByRole('button', { name: /upload/i }) ||
                        page.getByTestId('file-upload-button')
    await uploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles([{
      name: 'clear-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content')
    }])

    await expect(page.getByText('clear-test.txt')).toBeVisible()

    // Send message
    const chatInput = page.getByTestId('chat-input') || page.getByRole('textbox')
    await chatInput.fill('Send this with file')
    
    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    // Wait for response
    await expect(page.getByText('Message sent successfully!')).toBeVisible()

    // Verify file is cleared from the interface
    await expect(page.getByText('clear-test.txt')).not.toBeVisible()
  })
})