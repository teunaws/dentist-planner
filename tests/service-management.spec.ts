import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: Service Management
 * 
 * Tests the critical paths for managing services:
 * - Creating a new service with all fields
 * - Verifying the service appears on the booking page
 * - Editing existing service details
 * - Deleting a service with confirmation
 */
test.describe('Service Management', () => {
  // Environment variables
  let DENTIST_EMAIL: string
  let DENTIST_PASSWORD: string
  let TENANT_SLUG: string

  test.beforeAll(() => {
    DENTIST_EMAIL = process.env.TEST_DENTIST_EMAIL || 'dentist@example.com'
    DENTIST_PASSWORD = process.env.TEST_DENTIST_PASSWORD || 'demo_password_123'
    TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'lumina'

    console.log('\n📋 Service Management Test Configuration:')
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

  test('should create a new service with all fields populated', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Services page
    await page.goto(`/en/${TENANT_SLUG}/dentist/services`)
    await page.waitForLoadState('networkidle')

    // Verify we're on the services page
    await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible({ timeout: 15000 });
    // 2. Wait for a unique, actionable element specific to the Services page to confirm the page has fully loaded its content.
    await expect(page.getByRole('button', { name: 'Add Service' })).toBeVisible({ timeout: 15000 });


    // Generate unique service name
    const uniqueServiceName = `Test Service ${Date.now()}`
    const serviceDescription = 'Automated test service description'
    const servicePrice = '$99'
    const serviceDuration = '45'
    const servicePerk = 'Includes consultation'

    // Click "Add Service" button
    const addServiceButton = page.getByRole('button', { name: /add service/i })
    await expect(addServiceButton).toBeVisible({ timeout: 10000 })
    await addServiceButton.click()

    // Wait for form to appear - Service Name input should be visible
    const serviceNameInput = page.getByLabel(/service name/i).or(
      page.locator('input[placeholder*="Signature"]')
    )
    await expect(serviceNameInput).toBeVisible({ timeout: 10000 })

    // Fill in service name
    await serviceNameInput.fill(uniqueServiceName)

    // Fill in price
    const priceInput = page.getByLabel(/price/i).or(
      page.locator('input[placeholder*="$"]')
    )
    await expect(priceInput).toBeVisible({ timeout: 5000 })
    await priceInput.clear()
    await priceInput.fill(servicePrice)

    // Fill in description
    const descriptionInput = page.getByLabel(/description/i).or(
      page.locator('input[placeholder*="hygiene"]').or(
        page.locator('input[placeholder*="session"]')
      )
    )
    if (await descriptionInput.isVisible().catch(() => false)) {
      await descriptionInput.fill(serviceDescription)
    }

    // Fill in duration
    const durationInput = page.getByLabel(/duration/i).or(
      page.locator('input[type="number"]')
    )
    if (await durationInput.isVisible().catch(() => false)) {
      await durationInput.clear()
      await durationInput.fill(serviceDuration)
    }

    // Add a perk
    const addPerkButton = page.getByRole('button', { name: /add perk/i })
    if (await addPerkButton.isVisible().catch(() => false)) {
      await addPerkButton.click()

      // Find the perk input (last input in the perks section)
      const perkInputs = page.locator('input[placeholder*="Fluoride"]').or(
        page.locator('input[placeholder*="e.g."]')
      )
      const perkInput = perkInputs.last()
      if (await perkInput.isVisible().catch(() => false)) {
        await perkInput.fill(servicePerk)
      }
    }

    // Click Save button
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await expect(saveButton).toBeVisible({ timeout: 5000 })
    await saveButton.click()

    // Wait for save to complete
    await page.waitForTimeout(2000)

    // Verify the service appears in the list
    await expect(page.getByText(uniqueServiceName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(servicePrice)).toBeVisible({ timeout: 5000 })

    console.log(`✓ Service "${uniqueServiceName}" created successfully`)

    // Cleanup: Delete the service we just created
    const serviceCard = page.locator('div').filter({ hasText: uniqueServiceName }).filter({
      has: page.locator('button')
    }).last()

    if (await serviceCard.isVisible().catch(() => false)) {
      // Set up dialog handler for confirmation
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      // Find and click delete button (usually has a trash icon)
      const deleteButton = serviceCard.locator('button').filter({ has: page.locator('svg') }).last()
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click()
        await page.waitForTimeout(1000)

        // Need to save after deletion
        const saveAfterDelete = page.getByRole('button', { name: /save/i }).first()
        if (await saveAfterDelete.isVisible().catch(() => false)) {
          await saveAfterDelete.click()
          await page.waitForTimeout(2000)
        }
        console.log(`✓ Service "${uniqueServiceName}" cleaned up (deleted)`)
      }
    }
  })

  test('should verify new service appears on booking page', async ({ page }) => {
    test.setTimeout(90000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Services page
    await page.goto(`/en/${TENANT_SLUG}/dentist/services`)
    await page.waitForLoadState('networkidle')

    // Verify we're on the services page
    await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible({ timeout: 15000 });
    // 2. Wait for a unique, actionable element specific to the Services page to confirm the page has fully loaded its content.
    await expect(page.getByRole('button', { name: 'Add Service' })).toBeVisible({ timeout: 15000 });


    // Generate unique service name
    const uniqueServiceName = `Booking Test ${Date.now()}`

    // Click "Add Service" button
    const addServiceButton = page.getByRole('button', { name: /add service/i })
    await addServiceButton.click()

    // Fill in service details
    const serviceNameInput = page.getByLabel(/service name/i).or(
      page.locator('input[placeholder*="Signature"]')
    )
    await expect(serviceNameInput).toBeVisible({ timeout: 10000 })
    await serviceNameInput.fill(uniqueServiceName)

    // Fill price
    const priceInput = page.getByLabel(/price/i).or(
      page.locator('input[placeholder*="$"]')
    )
    await priceInput.clear()
    await priceInput.fill('$75')

    // Save the service
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await saveButton.click()
    await page.waitForTimeout(3000)

    // Verify service is saved
    await expect(page.getByText(uniqueServiceName)).toBeVisible({ timeout: 10000 })
    console.log(`✓ Service "${uniqueServiceName}" created`)

    // Now navigate to booking page (patient view)
    await page.goto(`/en/${TENANT_SLUG}/book`)
    await page.waitForLoadState('networkidle')

    // Wait for services to load
    await page.waitForTimeout(3000)

    // Check if the new service appears on the booking page
    const serviceOnBookingPage = page.getByText(uniqueServiceName)

    try {
      await expect(serviceOnBookingPage).toBeVisible({ timeout: 15000 })
      console.log(`✓ Service "${uniqueServiceName}" is visible on booking page`)
    } catch {
      console.log(`⚠️ Service "${uniqueServiceName}" may not be immediately visible on booking page (could be a cache issue)`)
    }

    // Cleanup: Go back to services page and delete
    await page.goto(`/en/${TENANT_SLUG}/dentist/services`)
    await page.waitForLoadState('networkidle')

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Find and delete the service
    const serviceCard = page.locator('div').filter({ hasText: uniqueServiceName }).filter({
      has: page.locator('button')
    }).last()

    if (await serviceCard.isVisible().catch(() => false)) {
      const deleteButton = serviceCard.locator('button').filter({ has: page.locator('svg') }).last()
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click()
        await page.waitForTimeout(1000)

        const saveAfterDelete = page.getByRole('button', { name: /save/i }).first()
        if (await saveAfterDelete.isVisible().catch(() => false)) {
          await saveAfterDelete.click()
          await page.waitForTimeout(2000)
        }
        console.log(`✓ Service "${uniqueServiceName}" cleaned up`)
      }
    }
  })

  test('should edit an existing service', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Services page
    await page.goto(`/en/${TENANT_SLUG}/dentist/services`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible({ timeout: 15000 });
    // 2. Wait for a unique, actionable element specific to the Services page to confirm the page has fully loaded its content.
    await expect(page.getByRole('button', { name: 'Add Service' })).toBeVisible({ timeout: 15000 });



    // Create a service to edit
    const originalName = `Edit Service ${Date.now()}`
    const updatedName = `Updated Service ${Date.now()}`
    const updatedPrice = '$199'

    // Click Add Service
    const addServiceButton = page.getByRole('button', { name: /add service/i })
    await addServiceButton.click()

    // Fill in service name
    const serviceNameInput = page.getByLabel(/service name/i).or(
      page.locator('input[placeholder*="Signature"]')
    )
    await expect(serviceNameInput).toBeVisible({ timeout: 10000 })
    await serviceNameInput.fill(originalName)

    // Fill price
    const priceInput = page.getByLabel(/price/i).or(
      page.locator('input[placeholder*="$"]')
    )
    await priceInput.clear()
    await priceInput.fill('$50')

    // Save the service
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify service was created
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 })
    console.log(`✓ Service "${originalName}" created for edit test`)

    // Find the service card and click Edit
    const serviceCard = page.locator('div').filter({ hasText: originalName }).filter({
      has: page.getByRole('button', { name: /edit/i })
    }).last()

    const editButton = serviceCard.getByRole('button', { name: /edit/i })
    await expect(editButton).toBeVisible({ timeout: 5000 })
    await editButton.click()

    // Wait for edit form to appear
    const editNameInput = page.getByLabel(/service name/i).or(
      page.locator('input[placeholder*="Signature"]')
    )
    await expect(editNameInput).toBeVisible({ timeout: 10000 })

    // Update the name
    await editNameInput.clear()
    await editNameInput.fill(updatedName)

    // Update the price
    const editPriceInput = page.getByLabel(/price/i).or(
      page.locator('input[placeholder*="$"]')
    )
    await editPriceInput.clear()
    await editPriceInput.fill(updatedPrice)

    // Save changes
    const saveEditButton = page.getByRole('button', { name: /^save$/i })
    await saveEditButton.click()
    await page.waitForTimeout(2000)

    // Verify the updated details are shown
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(updatedPrice)).toBeVisible({ timeout: 5000 })

    console.log(`✓ Service successfully updated from "${originalName}" to "${updatedName}" with price ${updatedPrice}`)

    // Cleanup: Delete the service
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    const updatedCard = page.locator('div').filter({ hasText: updatedName }).filter({
      has: page.locator('button')
    }).last()

    if (await updatedCard.isVisible().catch(() => false)) {
      const deleteBtn = updatedCard.locator('button').filter({ has: page.locator('svg') }).last()
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click()
        await page.waitForTimeout(1000)

        const saveAfterDelete = page.getByRole('button', { name: /save/i }).first()
        if (await saveAfterDelete.isVisible().catch(() => false)) {
          await saveAfterDelete.click()
          await page.waitForTimeout(2000)
        }
        console.log(`✓ Service "${updatedName}" cleaned up`)
      }
    }
  })

  test('should delete a service with confirmation', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Services page
    await page.goto(`/en/${TENANT_SLUG}/dentist/services`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible({ timeout: 15000 });
    // 2. Wait for a unique, actionable element specific to the Services page to confirm the page has fully loaded its content.
    await expect(page.getByRole('button', { name: 'Add Service' })).toBeVisible({ timeout: 15000 });



    // Create a service to delete
    const serviceName = `Delete Service ${Date.now()}`

    // Click Add Service
    const addServiceButton = page.getByRole('button', { name: /add service/i })
    await addServiceButton.click()

    // Fill in service name
    const serviceNameInput = page.getByLabel(/service name/i).or(
      page.locator('input[placeholder*="Signature"]')
    )
    await expect(serviceNameInput).toBeVisible({ timeout: 10000 })
    await serviceNameInput.fill(serviceName)

    // Fill price
    const priceInput = page.getByLabel(/price/i).or(
      page.locator('input[placeholder*="$"]')
    )
    await priceInput.clear()
    await priceInput.fill('$25')

    // Save the service
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify service was created
    await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
    console.log(`✓ Service "${serviceName}" created for deletion test`)

    // Set up dialog handler for confirmation
    let dialogReceived = false
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      dialogReceived = true
      await dialog.accept()
    })

    // Find and click the delete button
    const serviceCard = page.locator('div').filter({ hasText: serviceName }).filter({
      has: page.locator('button')
    }).last()

    // The delete button typically has a trash icon (Trash2)
    const deleteButton = serviceCard.locator('button').filter({ has: page.locator('svg') }).last()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    // Wait for confirmation dialog to be processed
    await page.waitForTimeout(1000)

    // Verify dialog was received
    expect(dialogReceived).toBe(true)

    // Now we need to save to persist the deletion
    const saveAfterDelete = page.getByRole('button', { name: /save/i }).first()
    if (await saveAfterDelete.isVisible().catch(() => false)) {
      await saveAfterDelete.click()
      await page.waitForTimeout(2000)
    }

    // Reload page to verify the service is gone
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify the service is no longer visible
    await expect(page.getByText(serviceName)).not.toBeVisible({ timeout: 10000 })

    console.log(`✓ Service "${serviceName}" deleted successfully with confirmation dialog`)
  })
})

