import { test, expect } from '@playwright/test'

// E2E tests for file search functionality
// These tests simulate real user interactions with the file search feature

test.describe('File Search E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to the application
    await page.goto('/')
    
    // Mock API responses for file search
    await page.route('/api/chat', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      // Check if this is a file search request
      if (postData?.tools?.some((tool: any) => tool.type === 'file_search')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: JSON.stringify({
            success: true,
            results: [
              {
                rank: 1,
                file_id: 'test-doc-1',
                file_name: 'user-guide.pdf',
                content: 'This is a comprehensive user guide that covers all the essential features...',
                score: 0.95,
                metadata: { type: 'pdf', pages: 42 }
              },
              {
                rank: 2,
                file_id: 'test-doc-2', 
                file_name: 'api-documentation.md',
                content: 'API documentation with detailed examples and best practices...',
                score: 0.87,
                metadata: { type: 'markdown', sections: 8 }
              }
            ],
            total_results: 2,
            summary: 'Found 2 relevant documents. Top result has 95% relevance.'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Mock file upload endpoint
    await page.route('/api/files/upload', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          file_id: 'uploaded-file-123',
          file_name: 'test-document.pdf',
          vector_store_id: 'store-456'
        })
      })
    })
  })

  test('should upload and search files successfully', async ({ page }) => {
    // Test file upload
    await test.step('Upload a file', async () => {
      // Look for file upload button or dropzone
      const fileInput = page.locator('input[type="file"]').first()
      await expect(fileInput).toBeAttached()
      
      // Create a test file and upload it
      const testFile = {
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content for testing')
      }
      
      await fileInput.setInputFiles(testFile)
      
      // Wait for upload confirmation
      await expect(page.locator('text=File uploaded successfully')).toBeVisible({
        timeout: 10000
      })
    })

    // Test file search
    await test.step('Search uploaded files', async () => {
      // Type a search query in the chat input
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await expect(chatInput).toBeVisible()
      
      await chatInput.fill('Search for information about user guides')
      
      // Submit the search
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Verify search results appear
      await expect(page.locator('text=user-guide.pdf')).toBeVisible({
        timeout: 15000
      })
      await expect(page.locator('text=95% relevance')).toBeVisible()
    })
  })

  test('should handle file search with filters', async ({ page }) => {
    // Mock API with filtered results
    await page.route('/api/chat', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.file_types?.includes('pdf')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            results: [
              {
                rank: 1,
                file_id: 'pdf-doc-1',
                file_name: 'technical-manual.pdf',
                content: 'Technical manual with detailed instructions...',
                score: 0.92,
                metadata: { type: 'pdf', pages: 156 }
              }
            ],
            total_results: 1,
            summary: 'Found 1 PDF document with 92% relevance.'
          })
        })
      } else {
        await route.continue()
      }
    })

    await test.step('Apply file type filter', async () => {
      // Look for filter options (this might be in settings or search interface)
      const settingsButton = page.locator('[aria-label="Settings"], button:has-text("Settings")').first()
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        
        // Look for file type filters
        const pdfFilter = page.locator('input[type="checkbox"][value="pdf"], label:has-text("PDF")').first()
        if (await pdfFilter.isVisible()) {
          await pdfFilter.check()
        }
      }
    })

    await test.step('Search with filter applied', async () => {
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Find technical documentation')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Verify filtered results
      await expect(page.locator('text=technical-manual.pdf')).toBeVisible({
        timeout: 15000
      })
      await expect(page.locator('text=1 PDF document')).toBeVisible()
    })
  })

  test('should handle multi-store search', async ({ page }) => {
    // Mock multi-store search response
    await page.route('/api/chat', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.vector_stores?.length > 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            results: [
              {
                rank: 1,
                file_id: 'multi-doc-1',
                file_name: 'project-overview.pdf',
                content: 'Comprehensive project overview from documents store...',
                score: 0.94,
                metadata: { type: 'pdf', source_store: 'documents' }
              },
              {
                rank: 2,
                file_id: 'multi-doc-2',
                file_name: 'research-findings.md',
                content: 'Latest research findings from research store...',
                score: 0.89,
                metadata: { type: 'markdown', source_store: 'research' }
              }
            ],
            total_results: 2,
            summary: 'Found 2 documents across multiple stores. Top result has 94% relevance.',
            stores_searched: ['documents', 'research']
          })
        })
      } else {
        await route.continue()
      }
    })

    await test.step('Configure multi-store search', async () => {
      // Access search settings
      const searchSettings = page.locator('[aria-label="Search Settings"], button:has-text("Advanced")').first()
      if (await searchSettings.isVisible()) {
        await searchSettings.click()
        
        // Enable multiple vector stores
        const multiStoreToggle = page.locator('input[type="checkbox"]:near(text("Search multiple stores"))').first()
        if (await multiStoreToggle.isVisible()) {
          await multiStoreToggle.check()
        }
      }
    })

    await test.step('Perform multi-store search', async () => {
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Search all stores for project information')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Verify multi-store results
      await expect(page.locator('text=project-overview.pdf')).toBeVisible({
        timeout: 15000
      })
      await expect(page.locator('text=research-findings.md')).toBeVisible()
      await expect(page.locator('text=across multiple stores')).toBeVisible()
    })
  })

  test('should handle search errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('/api/chat', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.tools?.some((tool: any) => tool.type === 'file_search')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Vector store not found',
            results: [],
            total_results: 0
          })
        })
      } else {
        await route.continue()
      }
    })

    await test.step('Trigger search error', async () => {
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Search for non-existent files')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Verify error message is displayed
      await expect(page.locator('text=Vector store not found')).toBeVisible({
        timeout: 10000
      })
    })
  })

  test('should display search results with proper formatting', async ({ page }) => {
    await test.step('Perform search and check result formatting', async () => {
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Show me documentation files')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Wait for results to appear
      await page.waitForTimeout(2000)
      
      // Check for proper result formatting
      const results = page.locator('[data-testid="search-result"], .search-result, .file-result')
      if (await results.first().isVisible()) {
        // Verify result structure
        await expect(results.first().locator('text=user-guide.pdf')).toBeVisible()
        await expect(results.first().locator('text=95%')).toBeVisible()
        
        // Check if content preview is truncated properly
        const contentPreview = results.first().locator('.content-preview, [data-testid="content-preview"]')
        if (await contentPreview.isVisible()) {
          const contentText = await contentPreview.textContent()
          expect(contentText?.length).toBeLessThan(600) // Should be truncated
        }
      }
    })
  })

  test('should support search result interaction', async ({ page }) => {
    await test.step('Click on search result', async () => {
      // Perform initial search
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Find user guides')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Wait for results
      await expect(page.locator('text=user-guide.pdf')).toBeVisible()
      
      // Click on a result (this might open a preview or provide more details)
      const resultLink = page.locator('a:has-text("user-guide.pdf"), button:has-text("user-guide.pdf")').first()
      if (await resultLink.isVisible()) {
        await resultLink.click()
        
        // Verify that clicking the result does something meaningful
        // This could be opening a modal, showing more content, etc.
        await page.waitForTimeout(1000)
        
        // Check for any modal or expanded content
        const modal = page.locator('.modal, [role="dialog"], .preview-panel')
        if (await modal.isVisible()) {
          await expect(modal.locator('text=user-guide.pdf')).toBeVisible()
        }
      }
    })
  })

  test('should handle empty search results', async ({ page }) => {
    // Mock empty results
    await page.route('/api/chat', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.tools?.some((tool: any) => tool.type === 'file_search')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            results: [],
            total_results: 0,
            summary: 'No relevant documents found. Try rephrasing your query or uploading more documents.'
          })
        })
      } else {
        await route.continue()
      }
    })

    await test.step('Search for non-existent content', async () => {
      const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first()
      await chatInput.fill('Search for unicorns and dragons')
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      await sendButton.click()
      
      // Verify empty state message
      await expect(page.locator('text=No relevant documents found')).toBeVisible({
        timeout: 10000
      })
      await expect(page.locator('text=Try rephrasing your query')).toBeVisible()
    })
  })
})