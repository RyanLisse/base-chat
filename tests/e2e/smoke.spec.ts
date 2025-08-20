import { test, expect } from '@playwright/test'

// This is a smoke test scaffold. Run the Next.js app locally before running e2e.
// Start: `npm run dev` (or your deploy preview), then: `npm run e2e`.

test.describe('App smoke', () => {
  test.skip(process.env.CI ? true : false, 'Enable when app server is running')

  test('home page renders', async ({ page }) => {
    await page.goto('/')
    // Basic sanity check: page has a main element
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})

