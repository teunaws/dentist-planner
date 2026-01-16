import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: Dentist Authentication
 * 
 * Tests the critical path for dentist login and dashboard access.
 * Verifies that dentists can authenticate and access their dashboard.
 */
test.describe('Dentist Authentication', () => {
  // Load environment variables (dotenv should be loaded by playwright.config.ts)
  // But we'll also try to load them here as a fallback
  let DENTIST_EMAIL: string
  let DENTIST_PASSWORD: string
  let TENANT_SLUG: string

  test.beforeAll(() => {
    // Ensure we have the credentials - load from env or use defaults
    DENTIST_EMAIL = process.env.TEST_DENTIST_EMAIL || 'dentist@example.com'
    DENTIST_PASSWORD = process.env.TEST_DENTIST_PASSWORD || 'demo_password_123'
    TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'lumina'

    // Log what credentials are being used (password masked)
    const usingDefaults = !process.env.TEST_DENTIST_EMAIL || !process.env.TEST_DENTIST_PASSWORD
    console.log('\n📋 Test Configuration:')
    console.log(`   Email: ${DENTIST_EMAIL}`)
    console.log(`   Password: ${DENTIST_PASSWORD ? '***SET***' : 'NOT SET - using default'}`)
    console.log(`   Tenant: ${TENANT_SLUG}`)
    console.log(`   Using env vars: ${!usingDefaults ? 'YES ✓' : 'NO ⚠️  (using defaults)'}`)

    if (usingDefaults) {
      console.log('\n⚠️  WARNING: Using default credentials!')
      console.log('   Create .env.local file with TEST_DENTIST_EMAIL and TEST_DENTIST_PASSWORD')
      console.log('   Run: npm run test:setup\n')
    } else {
      console.log('')
    }
  })

  test.beforeEach(async ({ page }) => {
    // Clear any existing session before each test
    await page.context().clearCookies()

    // Log credentials being used for this test (for debugging)
    if (process.env.DEBUG_TESTS) {
      console.log(`Using credentials: ${DENTIST_EMAIL} / ${DENTIST_PASSWORD ? '***' : 'NOT SET'}`)
    }
  })

  test('should allow dentist to log in and access dashboard', async ({ page }) => {
    const loginUrl = `/en/${TENANT_SLUG}/login`
    const expectedDashboardUrl = `/en/${TENANT_SLUG}/dentist`

    // Navigate to login page
    await page.goto(loginUrl)
    await page.waitForLoadState('networkidle')

    // Verify we're on the login page
    await expect(page.getByText(/sign in/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/dentist access/i)).toBeVisible({ timeout: 5000 })

    // Step 1: Fill in Email
    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await emailInput.fill(DENTIST_EMAIL)

    // Step 2: Fill in Password
    const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'))
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill(DENTIST_PASSWORD)

    // Step 3: Click "Sign In" button
    // The button text is "Enter dentist portal" according to LoginPage.tsx
    // Also check for loading state - button might show "Loading…" when isLoading is true
    const signInButton = page.getByRole('button', { name: /enter dentist portal/i }).or(
      page.getByRole('button', { name: /sign in/i })
    ).or(
      page.getByRole('button', { name: /login/i })
    ).or(
      page.locator('form button[type="submit"]')
    )

    // Wait for button to be visible and not in loading state
    await expect(signInButton).toBeVisible({ timeout: 10000 })
    // Wait a bit for any loading states to clear
    await page.waitForTimeout(500)
    await signInButton.click()

    // Step 4: Assertion - Verify redirection to /dentist (Dashboard)
    // Wait for navigation to complete
    try {
      await page.waitForURL(`**/en/${TENANT_SLUG}/dentist`, { timeout: 15000 })
    } catch (error) {
      // If redirect fails, check if we're still on login page (auth failed)
      const currentUrl = page.url()
      if (currentUrl.includes('/login')) {
        // Check for error message
        const errorText = await page.textContent('body').then(t => t || '').catch(() => '')
        throw new Error(
          `Login failed! Still on login page. ` +
          `Check credentials: ${DENTIST_EMAIL}. ` +
          `Error: ${errorText.substring(0, 200)}`
        )
      }
      throw error
    }

    // Verify we're on the dashboard
    expect(page.url()).toContain(`/en/${TENANT_SLUG}/dentist`)

    // Step 5: Content Check - Verify the dashboard content is visible
    // The dashboard should show "Dashboard" heading (h1 element)
    // Use getByRole('heading') to be specific and avoid matching buttons
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('should show error for invalid credentials', async ({ page }) => {
    const loginUrl = `/en/${TENANT_SLUG}/login`

    await page.goto(loginUrl)
    await page.waitForLoadState('networkidle')

    // Fill in invalid credentials
    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    await emailInput.fill('invalid@example.com')

    const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'))
    await passwordInput.fill('wrongpassword')

    // Click sign in
    const signInButton = page.getByRole('button', { name: /enter dentist portal/i }).or(
      page.getByRole('button', { name: /sign in/i })
    ).or(
      page.locator('button[type="submit"]')
    )
    await expect(signInButton).toBeVisible({ timeout: 5000 })
    await signInButton.click()

    // Should show error message and stay on login page
    await expect(
      page.getByText(/invalid|error|incorrect|failed/i)
    ).toBeVisible({ timeout: 10000 })

    // Should still be on login page
    expect(page.url()).toContain('/login')
  })

  test('should redirect to login when accessing dashboard without authentication', async ({ page }) => {
    const dashboardUrl = `/en/${TENANT_SLUG}/dentist`
    const expectedLoginUrl = `/en/${TENANT_SLUG}/login`

    // Try to access dashboard directly without logging in
    await page.goto(dashboardUrl)
    await page.waitForLoadState('networkidle')

    // Should redirect to login page
    await page.waitForURL(`**/en/${TENANT_SLUG}/login`, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })
})

