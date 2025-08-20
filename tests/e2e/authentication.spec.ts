import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display guest user interface by default', async ({ page }) => {
    // Should show guest-specific UI elements
    await expect(
      page.getByText(/guest/i) ||
      page.getByText(/sign in/i) ||
      page.getByText(/log in/i) ||
      page.getByRole('button', { name: /sign in/i })
    ).toBeVisible()

    // Should show limited functionality or usage indicators for guests
    await expect(
      page.getByText(/daily limit/i) ||
      page.getByText(/remaining/i) ||
      page.getByText(/sign in for more/i)
    ).toBeVisible()
  })

  test('should navigate to authentication page', async ({ page }) => {
    // Look for sign in button or link
    const signInButton = page.getByRole('button', { name: /sign in/i }) ||
                        page.getByRole('link', { name: /sign in/i }) ||
                        page.getByRole('button', { name: /log in/i }) ||
                        page.getByTestId('auth-button')
    
    await signInButton.click()

    // Should navigate to auth page or show auth modal
    await expect(
      page.getByText(/welcome/i) ||
      page.getByText(/sign in/i) ||
      page.getByRole('heading', { name: /authentication/i }) ||
      page.getByTestId('auth-form')
    ).toBeVisible()
  })

  test('should show authentication modal or dialog', async ({ page }) => {
    // Mock the authentication flow
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Trigger authentication
    const signInButton = page.getByRole('button', { name: /sign in/i }) ||
                        page.getByTestId('auth-button')
    
    await signInButton.click()

    // Look for authentication modal or form
    await expect(
      page.getByRole('dialog') ||
      page.getByTestId('auth-modal') ||
      page.getByTestId('auth-dialog') ||
      page.locator('[role="dialog"]')
    ).toBeVisible()
  })

  test('should handle email/password authentication', async ({ page }) => {
    // Mock successful authentication
    await page.route('**/api/auth/**', async (route) => {
      const url = route.request().url()
      if (url.includes('signin') || url.includes('login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            user: { id: 'user-123', email: 'test@example.com' },
            session: { access_token: 'mock-token' }
          })
        })
      } else {
        await route.continue()
      }
    })

    // Navigate to auth
    const signInButton = page.getByRole('button', { name: /sign in/i }) ||
                        page.getByTestId('auth-button')
    await signInButton.click()

    // Fill in email and password (if form is available)
    const emailInput = page.getByRole('textbox', { name: /email/i }) ||
                      page.getByTestId('email-input')
    const passwordInput = page.getByRole('textbox', { name: /password/i }) ||
                         page.getByTestId('password-input')

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('password123')

      const submitButton = page.getByRole('button', { name: /sign in/i }) ||
                          page.getByRole('button', { name: /log in/i }) ||
                          page.getByTestId('auth-submit')
      await submitButton.click()
    }

    // Should show authenticated state
    await expect(
      page.getByText('test@example.com') ||
      page.getByText(/welcome/i) ||
      page.getByRole('button', { name: /sign out/i })
    ).toBeVisible({ timeout: 5000 })
  })

  test('should handle OAuth authentication (Google/GitHub)', async ({ page }) => {
    // Mock OAuth flow
    await page.route('**/auth/callback**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Navigate to auth
    const signInButton = page.getByRole('button', { name: /sign in/i }) ||
                        page.getByTestId('auth-button')
    await signInButton.click()

    // Look for OAuth buttons
    const googleButton = page.getByRole('button', { name: /google/i }) ||
                        page.getByTestId('google-auth')
    const githubButton = page.getByRole('button', { name: /github/i }) ||
                        page.getByTestId('github-auth')

    // Test Google OAuth if available
    if (await googleButton.isVisible()) {
      // Mock OAuth redirect
      await page.route('https://accounts.google.com/**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': '/auth/callback?provider=google&code=mock-code'
          }
        })
      })

      await googleButton.click()
      
      // Should handle OAuth flow
      await expect(page).toHaveURL(/auth\/callback/, { timeout: 10000 })
    }
  })

  test('should display authenticated user information', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      }))
    })

    await page.reload()

    // Should show authenticated user info
    await expect(
      page.getByText('test@example.com') ||
      page.getByText('Test User') ||
      page.getByTestId('user-profile') ||
      page.getByRole('button', { name: /profile/i })
    ).toBeVisible()

    // Should show sign out option
    await expect(
      page.getByRole('button', { name: /sign out/i }) ||
      page.getByRole('button', { name: /log out/i }) ||
      page.getByTestId('sign-out-button')
    ).toBeVisible()
  })

  test('should handle sign out', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        email: 'test@example.com'
      }))
    })

    await page.reload()

    // Mock sign out API
    await page.route('**/api/auth/signout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Click sign out
    const signOutButton = page.getByRole('button', { name: /sign out/i }) ||
                         page.getByRole('button', { name: /log out/i }) ||
                         page.getByTestId('sign-out-button')
    
    await signOutButton.click()

    // Should return to guest state
    await expect(
      page.getByRole('button', { name: /sign in/i }) ||
      page.getByText(/guest/i)
    ).toBeVisible()

    // User info should be hidden
    await expect(
      page.getByText('test@example.com')
    ).not.toBeVisible()
  })

  test('should show different features for authenticated vs guest users', async ({ page }) => {
    // Test guest user features
    await expect(
      page.getByText(/daily limit/i) ||
      page.getByText(/sign in for unlimited/i) ||
      page.getByText(/guest mode/i)
    ).toBeVisible()

    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        email: 'test@example.com'
      }))
    })

    await page.reload()

    // Should show authenticated features
    await expect(
      page.getByText(/unlimited/i) ||
      page.getByText(/premium features/i) ||
      page.getByRole('button', { name: /settings/i })
    ).toBeVisible()
  })

  test('should handle authentication errors', async ({ page }) => {
    // Mock authentication error
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      })
    })

    const signInButton = page.getByRole('button', { name: /sign in/i }) ||
                        page.getByTestId('auth-button')
    await signInButton.click()

    // Try to authenticate with invalid credentials
    const emailInput = page.getByRole('textbox', { name: /email/i }) ||
                      page.getByTestId('email-input')
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@example.com')
      
      const passwordInput = page.getByRole('textbox', { name: /password/i }) ||
                           page.getByTestId('password-input')
      await passwordInput.fill('wrongpassword')

      const submitButton = page.getByRole('button', { name: /sign in/i }) ||
                          page.getByTestId('auth-submit')
      await submitButton.click()

      // Should show error message
      await expect(
        page.getByText(/invalid credentials/i) ||
        page.getByText(/authentication failed/i) ||
        page.getByText(/error/i)
      ).toBeVisible()
    }
  })

  test('should persist authentication across page refreshes', async ({ page }) => {
    // Mock authenticated state in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        email: 'test@example.com'
      }))
      localStorage.setItem('session', JSON.stringify({
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000 // 1 hour from now
      }))
    })

    await page.reload()

    // Should maintain authenticated state
    await expect(
      page.getByText('test@example.com') ||
      page.getByRole('button', { name: /sign out/i })
    ).toBeVisible()

    // Refresh again
    await page.reload()

    // Should still be authenticated
    await expect(
      page.getByText('test@example.com') ||
      page.getByRole('button', { name: /sign out/i })
    ).toBeVisible()
  })

  test('should handle session expiration', async ({ page }) => {
    // Mock expired session
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        email: 'test@example.com'
      }))
      localStorage.setItem('session', JSON.stringify({
        access_token: 'expired-token',
        expires_at: Date.now() - 3600000 // Expired 1 hour ago
      }))
    })

    await page.reload()

    // Should show sign in button due to expired session
    await expect(
      page.getByRole('button', { name: /sign in/i }) ||
      page.getByText(/session expired/i) ||
      page.getByText(/please sign in again/i)
    ).toBeVisible()
  })
})