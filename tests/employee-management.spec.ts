import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: Employee (Provider) Management
 * 
 * Tests the critical paths for managing providers/team members:
 * - Creating a new provider with name, color, capabilities, and schedule
 * - Editing existing provider details
 * - Deleting a provider with confirmation
 */
test.describe('Employee Management', () => {
  // Environment variables
  let DENTIST_EMAIL: string
  let DENTIST_PASSWORD: string
  let TENANT_SLUG: string

  test.beforeAll(() => {
    DENTIST_EMAIL = process.env.TEST_DENTIST_EMAIL || 'dentist@example.com'
    DENTIST_PASSWORD = process.env.TEST_DENTIST_PASSWORD || 'demo_password_123'
    TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'lumina'

    console.log('\n📋 Employee Management Test Configuration:')
    console.log(`   Email: ${DENTIST_EMAIL}`)
    console.log(`   Tenant: ${TENANT_SLUG}`)
  })

  // Helper function to login as dentist
  const loginAsDentist = async (page: any) => {
    await page.goto(`/en/${TENANT_SLUG}/login`)
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(DENTIST_EMAIL)

    const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'))
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill(DENTIST_PASSWORD)

    const signInButton = page.getByRole('button', { name: /enter dentist portal/i }).or(
      page.getByRole('button', { name: /sign in/i })
    ).or(
      page.locator('form button[type="submit"]')
    )
    await expect(signInButton).toBeVisible({ timeout: 5000 })
    await signInButton.click()

    await page.waitForURL(`**/en/${TENANT_SLUG}/dentist`, { timeout: 15000 })
  }

  test('should create a new provider with name, color, and capabilities', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Team Management page
    await page.goto(`/en/${TENANT_SLUG}/dentist/team`)
    await page.waitForLoadState('networkidle')

    // Verify we're on the team page
    await expect(page.getByRole('heading', { name: /team management/i })).toBeVisible({ timeout: 15000 })

    // Generate unique provider name
    const uniqueProviderName = `Test Provider ${Date.now()}`

    // Click "Add Provider" button
    const addProviderButton = page.getByRole('button', { name: /add provider/i })
    await expect(addProviderButton).toBeVisible({ timeout: 10000 })
    await addProviderButton.click()

    // Wait for the form to appear - Provider Name input should be visible
    const providerNameInput = page.getByLabel(/provider name/i).or(
      page.locator('input[placeholder*="Dr."]')
    )
    await expect(providerNameInput).toBeVisible({ timeout: 10000 })

    // Fill in provider name
    await providerNameInput.fill(uniqueProviderName)

    // Select a color (click the second color button to ensure a visible change)
    const colorButtons = page.locator('button').filter({ has: page.locator('[style*="background"]') })
    const colorButtonCount = await colorButtons.count()
    if (colorButtonCount > 1) {
      await colorButtons.nth(1).click()
    }

    // Select at least one capability/service checkbox
    // Look for checkboxes in the capabilities section
    const capabilityCheckboxes = page.locator('input[type="checkbox"]').filter({
      has: page.locator('..').filter({ hasText: /clean|polish|whitening|checkup|consultation/i })
    })

    // Try to click the first available checkbox
    const firstCheckbox = page.locator('label').filter({ hasText: /clean|polish|whitening|checkup|consultation/i }).first()
    if (await firstCheckbox.isVisible().catch(() => false)) {
      await firstCheckbox.click()
    } else {
      // Fallback: click first checkbox in capabilities section
      const capabilitiesSection = page.locator('text=Capabilities').locator('..')
      const checkboxes = capabilitiesSection.locator('input[type="checkbox"]')
      if (await checkboxes.count() > 0) {
        await checkboxes.first().click()
      }
    }

    // Configure schedule - ensure Monday is enabled
    const mondayCheckbox = page.locator('label').filter({ hasText: /monday/i }).locator('input[type="checkbox"]')
    const isMondayChecked = await mondayCheckbox.isChecked().catch(() => true)
    if (!isMondayChecked) {
      await mondayCheckbox.click()
    }

    // Click Save button
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await expect(saveButton).toBeVisible({ timeout: 5000 })
    await saveButton.click()

    // Wait for save to complete - the form should close
    await page.waitForTimeout(2000)

    // Verify the provider appears in the list
    await expect(page.getByText(uniqueProviderName)).toBeVisible({ timeout: 10000 })

    console.log(`✓ Provider "${uniqueProviderName}" created successfully`)

    // Cleanup: Delete the provider we just created
    const providerCard = page.locator('div').filter({ hasText: uniqueProviderName }).filter({
      has: page.getByRole('button', { name: /delete/i })
    }).last()

    if (await providerCard.isVisible().catch(() => false)) {
      // Set up dialog handler for confirmation
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      const deleteButton = providerCard.getByRole('button', { name: /delete/i })
      await deleteButton.click()

      // Wait for deletion
      await page.waitForTimeout(2000)
      console.log(`✓ Provider "${uniqueProviderName}" cleaned up (deleted)`)
    }
  })

  test('should edit an existing provider', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Team Management page
    await page.goto(`/en/${TENANT_SLUG}/dentist/team`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /team management/i })).toBeVisible({ timeout: 15000 })

    // First, create a provider to edit
    const originalName = `Edit Test ${Date.now()}`
    const updatedName = `Updated Provider ${Date.now()}`

    // Click Add Provider
    const addProviderButton = page.getByRole('button', { name: /add provider/i })
    await expect(addProviderButton).toBeVisible({ timeout: 10000 })
    await addProviderButton.click()

    // Fill in provider name
    const providerNameInput = page.getByLabel(/provider name/i).or(
      page.locator('input[placeholder*="Dr."]')
    )
    await expect(providerNameInput).toBeVisible({ timeout: 10000 })
    await providerNameInput.fill(originalName)

    // Save the provider
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify provider was created
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 })

    // Now edit the provider - find its card and click Edit
    const providerCard = page.locator('div').filter({ hasText: originalName }).filter({
      has: page.getByRole('button', { name: /edit/i })
    }).last()

    const editButton = providerCard.getByRole('button', { name: /edit/i })
    await expect(editButton).toBeVisible({ timeout: 5000 })
    await editButton.click()

    // Wait for edit form to appear
    const editNameInput = page.getByLabel(/provider name/i).or(
      page.locator('input[placeholder*="Dr."]')
    )
    await expect(editNameInput).toBeVisible({ timeout: 10000 })

    // Clear and update the name
    await editNameInput.clear()
    await editNameInput.fill(updatedName)

    // Save changes
    const saveEditButton = page.getByRole('button', { name: /^save$/i })
    await saveEditButton.click()
    await page.waitForTimeout(2000)

    // Verify the updated name is shown
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })

    console.log(`✓ Provider successfully renamed from "${originalName}" to "${updatedName}"`)

    // Cleanup: Delete the provider
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    const updatedCard = page.locator('div').filter({ hasText: updatedName }).filter({
      has: page.getByRole('button', { name: /delete/i })
    }).last()

    if (await updatedCard.isVisible().catch(() => false)) {
      const deleteBtn = updatedCard.getByRole('button', { name: /delete/i })
      await deleteBtn.click()
      await page.waitForTimeout(2000)
      console.log(`✓ Provider "${updatedName}" cleaned up (deleted)`)
    }
  })

  test('should delete a provider with confirmation', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Team Management page
    await page.goto(`/en/${TENANT_SLUG}/dentist/team`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /team management/i })).toBeVisible({ timeout: 15000 })

    // Create a provider to delete
    const providerName = `Delete Test ${Date.now()}`

    // Click Add Provider
    const addProviderButton = page.getByRole('button', { name: /add provider/i })
    await expect(addProviderButton).toBeVisible({ timeout: 10000 })
    await addProviderButton.click()

    // Fill in provider name
    const providerNameInput = page.getByLabel(/provider name/i).or(
      page.locator('input[placeholder*="Dr."]')
    )
    await expect(providerNameInput).toBeVisible({ timeout: 10000 })
    await providerNameInput.fill(providerName)

    // Save the provider
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify provider was created
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 10000 })
    console.log(`✓ Provider "${providerName}" created for deletion test`)

    // Find the provider card
    const providerCard = page.locator('div').filter({ hasText: providerName }).filter({
      has: page.getByRole('button', { name: /delete/i })
    }).last()

    // Set up dialog handler to accept the confirmation
    let dialogReceived = false
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain('delete')
      dialogReceived = true
      await dialog.accept()
    })

    // Click Delete button
    const deleteButton = providerCard.getByRole('button', { name: /delete/i })
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    // Wait for deletion to complete
    await page.waitForTimeout(2000)

    // Verify the provider is no longer visible
    await expect(page.getByText(providerName)).not.toBeVisible({ timeout: 10000 })

    // Verify dialog was received
    expect(dialogReceived).toBe(true)

    console.log(`✓ Provider "${providerName}" deleted successfully with confirmation dialog`)
  })
})

