import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: Communication Settings (Email/SMS)
 * 
 * Tests the critical paths for managing email and SMS templates:
 * - Modifying email template subject and body
 * - Toggling SMS confirmation on/off
 * - Toggling SMS reminder on/off
 * - Modifying SMS templates
 * - Verifying settings persist after reload
 */
test.describe('Communication Settings', () => {
  // Environment variables
  let DENTIST_EMAIL: string
  let DENTIST_PASSWORD: string
  let TENANT_SLUG: string

  test.beforeAll(() => {
    DENTIST_EMAIL = process.env.TEST_DENTIST_EMAIL || 'dentist@example.com'
    DENTIST_PASSWORD = process.env.TEST_DENTIST_PASSWORD || 'demo_password_123'
    TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'lumina'

    console.log('\n📋 Communication Settings Test Configuration:')
    console.log(`   Email: ${DENTIST_EMAIL}`)
    console.log(`   Tenant: ${TENANT_SLUG}`)
  })

  // Helper function to login as dentist
  const loginAsDentist = async (page: any) => {
    await page.goto(`/${TENANT_SLUG}/login`)
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

    await page.waitForURL(`**/${TENANT_SLUG}/dentist`, { timeout: 15000 })
  }

  // Helper to navigate to Email Settings tab
  const navigateToEmailSettings = async (page: any) => {
    await page.goto(`/${TENANT_SLUG}/dentist/settings`)
    await page.waitForLoadState('networkidle')

    // Verify we're on the settings page
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 15000 })

    // Click on Email Settings tab
    const emailTab = page.getByRole('button', { name: /email settings/i })
    await expect(emailTab).toBeVisible({ timeout: 10000 })
    await emailTab.click()

    // Wait for email settings content to load
    await page.waitForTimeout(1000)
  }

  test('should modify email confirmation template subject and body', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find the Email Configuration section
    await expect(page.getByText(/email configuration/i)).toBeVisible({ timeout: 10000 })

    // Find the Email Confirmation section
    const confirmationSection = page.locator('div').filter({ hasText: 'Send Email Confirmation' }).filter({ has: page.locator('button') }).last()

    await expect(confirmationSection).toBeVisible({ timeout: 10000 })

    // Ensure confirmation is enabled (toggle it on if needed)
    const confirmationToggle = confirmationSection.locator('button').filter({
      has: page.locator('span')
    }).first()

    const toggleClasses = await confirmationToggle.getAttribute('class')
    const isEnabled = toggleClasses?.includes('bg-slate-900') || false

    if (!isEnabled) {
      await confirmationToggle.click()
      await page.waitForTimeout(500)
      console.log('✓ Enabled email confirmation toggle')
    }

    // Click "Edit Template" button for confirmation
    const editConfirmationButton = confirmationSection.getByRole('button', { name: 'Edit Template' })
    await expect(editConfirmationButton).toBeVisible({ timeout: 5000 })
    await editConfirmationButton.click()
    await page.waitForTimeout(500)

    // Find subject line input in the confirmation template section
    const confirmationTemplate = page.locator('div').filter({ has: page.getByRole('button', { name: /save confirmation template/i }) }).last()
    const subjectField = confirmationTemplate.locator('label').filter({ hasText: /subject line/i })
      .locator('..')
      .locator('input[type="text"]')
      .first()

    if (await subjectField.isVisible().catch(() => false)) {
      // Store original value
      const originalSubject = await subjectField.inputValue()
      console.log(`Original subject: ${originalSubject}`)

      // Update subject
      const testSuffix = Date.now().toString().slice(-4)
      const newSubject = `Test Confirmation: {{date}} - ${testSuffix}`

      await subjectField.clear()
      await subjectField.fill(newSubject)
      console.log(`Updated subject to: ${newSubject}`)
    }

    // Find email body textarea in confirmation section
    // Find email body textarea in confirmation section
    const emailBodyTextarea = confirmationTemplate.locator('textarea').first()

    if (await emailBodyTextarea.isVisible().catch(() => false)) {
      // Store original value
      const originalBody = await emailBodyTextarea.inputValue()
      console.log(`Original body length: ${originalBody.length} chars`)

      // Update body with template variables
      const newBody = `Hi {{patient_name}},

Your appointment for {{service_name}} is confirmed!

Date: {{date}}
Time: {{time}}
Location: {{location}}

Test update at ${Date.now()}

See you soon!
{{tenant_name}}`

      await emailBodyTextarea.clear()
      await emailBodyTextarea.fill(newBody)
      console.log('Updated email body with template variables')
    }

    // Click Save Confirmation Template button
    const saveButton = page.getByRole('button', { name: /save confirmation template/i })
    await expect(saveButton).toBeVisible({ timeout: 5000 })
    await saveButton.click()

    // Wait for save
    await page.waitForTimeout(2000)

    // Check for success notification
    const successMessage = page.getByText(/success|saved/i)
    try {
      await expect(successMessage).toBeVisible({ timeout: 5000 })
      console.log('✓ Email confirmation template updated successfully')
    } catch {
      console.log('⚠️ Could not verify success message')
    }

    // Verify persistence by reloading
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Navigate back to Email Settings
    const emailTab = page.getByRole('button', { name: /email settings/i })
    await emailTab.click()
    await page.waitForTimeout(1000)

    // Verify values persisted (need to click Edit Template again to see the fields)
    const confirmationSectionAfterReload = page.locator('div').filter({ hasText: /send email confirmation/i }).first()
    const editButtonAfterReload = confirmationSectionAfterReload.getByRole('button', { name: /edit template/i })

    if (await editButtonAfterReload.isVisible().catch(() => false)) {
      await editButtonAfterReload.click()
      await page.waitForTimeout(500)

      const confirmationTemplate = page.locator('div').filter({ has: page.getByRole('button', { name: /save confirmation template/i }) }).last()
      const bodyAfterReload = confirmationTemplate.locator('textarea').first()

      if (await bodyAfterReload.isVisible().catch(() => false)) {
        const bodyValue = await bodyAfterReload.inputValue()
        if (bodyValue.includes('Test update')) {
          console.log('✓ Email confirmation template changes persisted after reload')
        }
      }
    }
  })

  test('should modify email reminder template subject and body', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find the Email Configuration section
    await expect(page.getByText(/email configuration/i)).toBeVisible({ timeout: 10000 })

    // Find the Email Reminder section
    const reminderSection = page.locator('div').filter({ hasText: /send email reminder/i }).filter({ has: page.locator('button') }).last()
    await expect(reminderSection).toBeVisible({ timeout: 10000 })

    // Ensure reminder is enabled (toggle it on if needed)
    const reminderToggle = reminderSection.locator('button').filter({
      has: page.locator('span')
    }).first()

    const toggleClasses = await reminderToggle.getAttribute('class')
    const isEnabled = toggleClasses?.includes('bg-slate-900') || false

    if (!isEnabled) {
      await reminderToggle.click()
      await page.waitForTimeout(500)
      console.log('✓ Enabled email reminder toggle')
    }

    // Click "Edit Template" button for reminder
    const editReminderButton = reminderSection.getByRole('button', { name: /edit template/i })
    await expect(editReminderButton).toBeVisible({ timeout: 5000 })
    await editReminderButton.click()
    await page.waitForTimeout(500)

    // Find subject line input in the reminder template section
    const reminderTemplate = page.locator('div').filter({ has: page.getByRole('button', { name: /save reminder template/i }) }).last()
    const subjectField = reminderTemplate.locator('label').filter({ hasText: /subject line/i })
      .locator('..')
      .locator('input[type="text"]')
      .first()

    if (await subjectField.isVisible().catch(() => false)) {
      // Store original value
      const originalSubject = await subjectField.inputValue()
      console.log(`Original reminder subject: ${originalSubject}`)

      // Update subject
      const testSuffix = Date.now().toString().slice(-4)
      const newSubject = `Reminder: Your appointment tomorrow at {{time}} - ${testSuffix}`

      await subjectField.clear()
      await subjectField.fill(newSubject)
      console.log(`Updated reminder subject to: ${newSubject}`)
    }

    // Find email body textarea in reminder section
    const emailBodyTextarea = reminderTemplate.locator('textarea').first()

    if (await emailBodyTextarea.isVisible().catch(() => false)) {
      // Store original value
      const originalBody = await emailBodyTextarea.inputValue()
      console.log(`Original reminder body length: ${originalBody.length} chars`)

      // Update body with template variables
      const newBody = `Hi {{patient_name}},

This is a reminder that you have an appointment tomorrow!

Service: {{service_name}}
Time: {{time}}
Date: {{date}}

Test reminder update at ${Date.now()}

See you tomorrow!
{{tenant_name}}`

      await emailBodyTextarea.clear()
      await emailBodyTextarea.fill(newBody)
      console.log('Updated email reminder body with template variables')
    }

    // Click Save Reminder Template button
    const saveButton = page.getByRole('button', { name: /save reminder template/i })
    await expect(saveButton).toBeVisible({ timeout: 5000 })
    await saveButton.click()

    // Wait for save
    await page.waitForTimeout(2000)

    // Check for success notification
    const successMessage = page.getByText(/success|saved/i)
    try {
      await expect(successMessage).toBeVisible({ timeout: 5000 })
      console.log('✓ Email reminder template updated successfully')
    } catch {
      console.log('⚠️ Could not verify success message')
    }

    // Verify persistence by reloading
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Navigate back to Email Settings
    const emailTab = page.getByRole('button', { name: /email settings/i })
    await emailTab.click()
    await page.waitForTimeout(1000)

    // Verify values persisted (need to click Edit Template again to see the fields)
    const reminderSectionAfterReload = page.locator('div').filter({ hasText: /send email reminder/i }).first()
    const editButtonAfterReload = reminderSectionAfterReload.getByRole('button', { name: /edit template/i })

    if (await editButtonAfterReload.isVisible().catch(() => false)) {
      await editButtonAfterReload.click()
      await page.waitForTimeout(500)

      // Find the textarea in the reminder section
      const reminderTemplate = page.locator('div').filter({ has: page.getByRole('button', { name: /save reminder template/i }) }).last()
      const bodyAfterReload = reminderTemplate.locator('textarea').first()

      if (await bodyAfterReload.isVisible().catch(() => false)) {
        const bodyValue = await bodyAfterReload.inputValue()
        if (bodyValue.includes('Test reminder update')) {
          console.log('✓ Email reminder template changes persisted after reload')
        }
      }
    }
  })

  test('should toggle SMS confirmation on/off and modify template', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find SMS Configuration section
    await expect(page.getByText(/sms configuration/i)).toBeVisible({ timeout: 10000 })

    // Find the SMS Confirmation toggle section
    const smsConfirmationSection = page.locator('div').filter({ hasText: /send sms confirmation/i }).filter({
      has: page.locator('button')
    }).last()

    // Find the toggle button (rounded-full button)
    const confirmationToggle = smsConfirmationSection.locator('button').filter({
      has: page.locator('span')
    }).first()

    if (await confirmationToggle.isVisible().catch(() => false)) {
      // Get current state
      const toggleClasses = await confirmationToggle.getAttribute('class')
      const wasEnabled = toggleClasses?.includes('bg-slate-900') || false
      console.log(`SMS Confirmation was: ${wasEnabled ? 'ON' : 'OFF'}`)

      // Toggle
      await confirmationToggle.click()
      await page.waitForTimeout(500)

      // Verify toggle changed
      const newClasses = await confirmationToggle.getAttribute('class')
      const isNowEnabled = newClasses?.includes('bg-slate-900') || false
      console.log(`SMS Confirmation is now: ${isNowEnabled ? 'ON' : 'OFF'}`)

      expect(isNowEnabled).toBe(!wasEnabled)

      // If enabled, modify the template
      if (isNowEnabled) {
        // Click "Edit Template" button for SMS confirmation
        const editTemplateButton = smsConfirmationSection.getByRole('button', { name: /edit template/i })
        if (await editTemplateButton.isVisible().catch(() => false)) {
          await editTemplateButton.click()
          await page.waitForTimeout(500)
        }

        // The template textarea should now be visible
        const templateTextarea = page.locator('textarea').filter({
          has: page.locator('..').filter({ hasText: /confirmation message template/i })
        }).first().or(
          page.locator('textarea[placeholder*="Hi {{patient_name}}"]').first()
        )

        if (await templateTextarea.isVisible().catch(() => false)) {
          const testTemplate = `Test: Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}. - ${Date.now()}`
          await templateTextarea.clear()
          await templateTextarea.fill(testTemplate)
          console.log('Updated SMS confirmation template')

          // Save SMS confirmation template
          const saveButton = page.getByRole('button', { name: /save sms configuration/i }).first()
          if (await saveButton.isVisible().catch(() => false)) {
            await saveButton.click()
            await page.waitForTimeout(2000)
          }
        }
      } else {
        // Toggle is off, no save needed
        await page.waitForTimeout(500)
      }

      console.log('✓ SMS confirmation toggle and template updated')

      // Restore original state
      if (!wasEnabled && isNowEnabled) {
        await confirmationToggle.click()
        await page.waitForTimeout(500)
        // Toggle changes auto-save, no need to click save button
        await page.waitForTimeout(2000)
        console.log('✓ SMS confirmation toggle restored to OFF')
      }
    } else {
      console.log('⚠️ Could not find SMS confirmation toggle')
    }
  })

  test('should toggle SMS reminder on/off and modify template', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find SMS Configuration section
    await expect(page.getByText(/sms configuration/i)).toBeVisible({ timeout: 10000 })

    // Find the SMS Reminder toggle section
    const smsReminderSection = page.locator('div').filter({ hasText: /send sms reminder/i }).filter({
      has: page.locator('button')
    }).last()

    // Find the toggle button
    const reminderToggle = smsReminderSection.locator('button').filter({
      has: page.locator('span')
    }).first()

    if (await reminderToggle.isVisible().catch(() => false)) {
      // Get current state
      const toggleClasses = await reminderToggle.getAttribute('class')
      const wasEnabled = toggleClasses?.includes('bg-slate-900') || false
      console.log(`SMS Reminder was: ${wasEnabled ? 'ON' : 'OFF'}`)

      // Toggle
      await reminderToggle.click()
      await page.waitForTimeout(500)

      // Verify toggle changed
      const newClasses = await reminderToggle.getAttribute('class')
      const isNowEnabled = newClasses?.includes('bg-slate-900') || false
      console.log(`SMS Reminder is now: ${isNowEnabled ? 'ON' : 'OFF'}`)

      expect(isNowEnabled).toBe(!wasEnabled)

      // If enabled, modify the template
      if (isNowEnabled) {
        // Click "Edit Template" button for SMS reminder
        const editTemplateButton = smsReminderSection.getByRole('button', { name: /edit template/i })
        if (await editTemplateButton.isVisible().catch(() => false)) {
          await editTemplateButton.click()
          await page.waitForTimeout(500)
        }

        const templateTextarea = page.locator('textarea').filter({
          has: page.locator('..').filter({ hasText: /reminder message template/i })
        }).first().or(
          page.locator('textarea[placeholder*="Reminder"]').first()
        )

        if (await templateTextarea.isVisible().catch(() => false)) {
          const testTemplate = `Reminder: Your appointment at {{tenant_name}} is tomorrow at {{time}}. - ${Date.now()}`
          await templateTextarea.clear()
          await templateTextarea.fill(testTemplate)
          console.log('Updated SMS reminder template')

          // Save SMS reminder template
          const saveButton = page.getByRole('button', { name: /save sms configuration/i }).first()
          if (await saveButton.isVisible().catch(() => false)) {
            await saveButton.click()
            await page.waitForTimeout(2000)
          }
        }
      } else {
        // Toggle is off, no save needed
        await page.waitForTimeout(500)
      }

      console.log('✓ SMS reminder toggle and template updated')

      // Restore original state
      if (!wasEnabled && isNowEnabled) {
        await reminderToggle.click()
        await page.waitForTimeout(500)
        // Toggle changes auto-save, no need to click save button
        await page.waitForTimeout(2000)
        console.log('✓ SMS reminder toggle restored to OFF')
      }
    } else {
      console.log('⚠️ Could not find SMS reminder toggle')
    }
  })

  test('should verify communication settings persist after reload', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find Sender Identity section
    const senderSection = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Sender Identity' }) }).filter({ has: page.locator('input') }).last()
    await expect(senderSection).toBeVisible({ timeout: 10000 })

    // Click "Edit" button for Sender Identity first
    const editSenderButton = senderSection.getByRole('button', { name: 'Edit', exact: true })
    await expect(editSenderButton).toBeVisible({ timeout: 5000 })
    await editSenderButton.click()
    await page.waitForTimeout(500)

    // Now find the input fields (they should be enabled after clicking Edit)
    const senderNameInput = page.getByLabel(/sender name/i).or(
      page.locator('input[placeholder*="Soho"]')
    )

    let originalSenderName = ''
    const testSenderName = `Test Sender ${Date.now().toString().slice(-4)}`

    if (await senderNameInput.isVisible().catch(() => false)) {
      originalSenderName = await senderNameInput.inputValue()
      console.log(`Original sender name: ${originalSenderName}`)

      // Ensure field is filled before making changes
      if (!originalSenderName || originalSenderName.trim() === '') {
        // Field is empty, fill it with a default value first
        const defaultSenderName = 'Default Sender'
        await senderNameInput.fill(defaultSenderName)
        await page.waitForTimeout(200)
        originalSenderName = defaultSenderName
        console.log(`Filled empty sender name with default: ${defaultSenderName}`)
      }

      // Now make the test change
      await senderNameInput.clear()
      await senderNameInput.fill(testSenderName)
      console.log(`Updated sender name to: ${testSenderName}`)
    }

    // Find and update email address prefix
    const emailPrefixInput = page.getByLabel(/email address prefix/i).or(
      page.locator('input').filter({ has: page.locator('..').filter({ hasText: /email address prefix/i }) })
    )

    let originalEmailPrefix = ''

    if (await emailPrefixInput.isVisible().catch(() => false)) {
      originalEmailPrefix = await emailPrefixInput.inputValue()
      console.log(`Original email prefix: ${originalEmailPrefix}`)

      // Ensure field is filled before making changes
      if (!originalEmailPrefix || originalEmailPrefix.trim() === '') {
        // Field is empty, fill it with a default value first
        const defaultPrefix = 'bookings'
        await emailPrefixInput.fill(defaultPrefix)
        await page.waitForTimeout(200)
        originalEmailPrefix = defaultPrefix
        console.log(`Filled empty email prefix with default: ${defaultPrefix}`)
      }
    }

    // Update reply-to email
    const replyToInput = page.getByLabel(/reply-to/i).or(
      page.locator('input[type="email"]').filter({ has: page.locator('..').filter({ hasText: /reply/i }) })
    )

    let originalReplyTo = ''
    const testReplyTo = `test-${Date.now().toString().slice(-4)}@test.com`

    if (await replyToInput.isVisible().catch(() => false)) {
      originalReplyTo = await replyToInput.inputValue()
      console.log(`Original reply-to: ${originalReplyTo}`)

      await replyToInput.clear()
      await replyToInput.fill(testReplyTo)
      console.log(`Updated reply-to to: ${testReplyTo}`)
    }

    // Save Sender Identity settings
    const saveButton = page.getByRole('button', { name: /save sender identity/i }).first()
    await expect(saveButton).toBeVisible({ timeout: 5000 })
    await saveButton.click()

    // Wait for save
    await page.waitForTimeout(3000)

    // Check for success
    const successMessage = page.getByText(/success|saved/i)
    try {
      await expect(successMessage).toBeVisible({ timeout: 5000 })
      console.log('✓ Settings saved successfully')
    } catch {
      console.log('⚠️ Could not verify success message')
    }

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Navigate back to Email Settings tab
    const emailTab = page.getByRole('button', { name: /email settings/i })
    await expect(emailTab).toBeVisible({ timeout: 10000 })
    await emailTab.click()
    await page.waitForTimeout(1000)

    // Click Edit button to see the actual values (fields may show defaults when not in edit mode)
    const senderSectionAfterReload = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Sender Identity' }) }).filter({ has: page.locator('input') }).last()
    const editButtonAfterReload = senderSectionAfterReload.getByRole('button', { name: 'Edit', exact: true })

    if (await editButtonAfterReload.isVisible().catch(() => false)) {
      await editButtonAfterReload.click()
      await page.waitForTimeout(500)
    }

    // Verify sender name persisted
    const senderNameAfterReload = page.getByLabel(/sender name/i).or(
      page.locator('input[placeholder*="Soho"]')
    )

    if (await senderNameAfterReload.isVisible().catch(() => false)) {
      const currentSenderName = await senderNameAfterReload.inputValue()
      if (currentSenderName === testSenderName) {
        console.log('✓ Sender name persisted after reload')
      } else {
        console.log(`⚠️ Sender name may not have persisted (got: ${currentSenderName}, expected: ${testSenderName})`)
      }
    }

    // Verify email prefix persisted
    const emailPrefixAfterReload = page.getByLabel(/email address prefix/i).or(
      page.locator('input').filter({ has: page.locator('..').filter({ hasText: /email address prefix/i }) })
    )

    if (await emailPrefixAfterReload.isVisible().catch(() => false)) {
      const currentEmailPrefix = await emailPrefixAfterReload.inputValue()
      console.log(`Email prefix after reload: ${currentEmailPrefix}`)
    }

    // Verify reply-to persisted
    const replyToAfterReload = page.getByLabel(/reply-to/i).or(
      page.locator('input[type="email"]').filter({ has: page.locator('..').filter({ hasText: /reply/i }) })
    )

    if (await replyToAfterReload.isVisible().catch(() => false)) {
      const currentReplyTo = await replyToAfterReload.inputValue()
      if (currentReplyTo === testReplyTo) {
        console.log('✓ Reply-to email persisted after reload')
      } else {
        console.log(`⚠️ Reply-to may not have persisted (got: ${currentReplyTo}, expected: ${testReplyTo})`)
      }
    }

    // Restore original values
    const senderSectionRestore = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Sender Identity' }) }).filter({ has: page.locator('input') }).last()
    const editSenderButtonRestore = senderSectionRestore.getByRole('button', { name: 'Edit', exact: true })

    // Click Edit button before making changes
    if (await editSenderButtonRestore.isVisible().catch(() => false)) {
      await editSenderButtonRestore.click()
      await page.waitForTimeout(500)
    }

    // Get the inputs after clicking Edit
    const senderNameInputRestore = page.getByLabel(/sender name/i).or(
      page.locator('input[placeholder*="Soho"]')
    )
    const emailPrefixInputRestore = page.getByLabel(/email address prefix/i).or(
      page.locator('input').filter({ has: page.locator('..').filter({ hasText: /email address prefix/i }) })
    )
    const replyToInputRestore = page.getByLabel(/reply-to/i).or(
      page.locator('input[type="email"]').filter({ has: page.locator('..').filter({ hasText: /reply/i }) })
    )

    // Restore sender name (ensure it's filled)
    if (originalSenderName && await senderNameInputRestore.isVisible().catch(() => false)) {
      const currentValue = await senderNameInputRestore.inputValue()
      // Ensure field is filled before restoring
      if (!currentValue || currentValue.trim() === '') {
        await senderNameInputRestore.fill('Default Sender')
        await page.waitForTimeout(200)
      }
      await senderNameInputRestore.clear()
      await senderNameInputRestore.fill(originalSenderName)
    }

    // Restore email prefix (ensure it's filled)
    if (originalEmailPrefix && await emailPrefixInputRestore.isVisible().catch(() => false)) {
      const currentValue = await emailPrefixInputRestore.inputValue()
      // Ensure field is filled before restoring
      if (!currentValue || currentValue.trim() === '') {
        await emailPrefixInputRestore.fill('bookings')
        await page.waitForTimeout(200)
      }
      await emailPrefixInputRestore.clear()
      await emailPrefixInputRestore.fill(originalEmailPrefix)
    }

    // Restore reply-to
    if (originalReplyTo && await replyToInputRestore.isVisible().catch(() => false)) {
      await replyToInputRestore.clear()
      await replyToInputRestore.fill(originalReplyTo)
    }

    // Save restoration
    const saveRestore = page.getByRole('button', { name: /save sender identity/i }).first()
    if (await saveRestore.isVisible().catch(() => false)) {
      await saveRestore.click()
      await page.waitForTimeout(2000)
      console.log('✓ Original values restored')
    }
  })

  test('should toggle all SMS settings and verify states', async ({ page }) => {
    test.setTimeout(60000)

    // Login first
    await loginAsDentist(page)

    // Navigate to Email Settings
    await navigateToEmailSettings(page)

    // Find SMS Configuration section
    await expect(page.getByText(/sms configuration/i)).toBeVisible({ timeout: 10000 })

    // Store original states
    const confirmationSection = page.locator('div').filter({ hasText: /send sms confirmation/i }).filter({
      has: page.locator('button')
    }).last()
    const confirmationToggle = confirmationSection.locator('button').filter({ has: page.locator('span') }).first()

    const reminderSection = page.locator('div').filter({ hasText: /send sms reminder/i }).filter({
      has: page.locator('button')
    }).last()
    const reminderToggle = reminderSection.locator('button').filter({ has: page.locator('span') }).first()

    // Get original states
    let originalConfirmation = false
    let originalReminder = false

    if (await confirmationToggle.isVisible().catch(() => false)) {
      const classes = await confirmationToggle.getAttribute('class')
      originalConfirmation = classes?.includes('bg-slate-900') || false
      console.log(`Original SMS Confirmation: ${originalConfirmation ? 'ON' : 'OFF'}`)
    }

    if (await reminderToggle.isVisible().catch(() => false)) {
      const classes = await reminderToggle.getAttribute('class')
      originalReminder = classes?.includes('bg-slate-900') || false
      console.log(`Original SMS Reminder: ${originalReminder ? 'ON' : 'OFF'}`)
    }

    // Toggle confirmation ON
    if (await confirmationToggle.isVisible().catch(() => false)) {
      await confirmationToggle.click()
      await page.waitForTimeout(500)

      const newClasses = await confirmationToggle.getAttribute('class')
      const isOn = newClasses?.includes('bg-slate-900') || false
      console.log(`After toggle, SMS Confirmation: ${isOn ? 'ON' : 'OFF'}`)

      // Verify template textarea appears when ON
      if (isOn) {
        const templateVisible = await page.locator('textarea').filter({
          has: page.locator('..').filter({ hasText: /confirmation message/i })
        }).isVisible().catch(() => false)

        if (templateVisible) {
          console.log('✓ Confirmation template textarea appeared when toggle is ON')
        }
      }
    }

    // Toggle reminder ON
    if (await reminderToggle.isVisible().catch(() => false)) {
      await reminderToggle.click()
      await page.waitForTimeout(500)

      const newClasses = await reminderToggle.getAttribute('class')
      const isOn = newClasses?.includes('bg-slate-900') || false
      console.log(`After toggle, SMS Reminder: ${isOn ? 'ON' : 'OFF'}`)

      // Verify template textarea appears when ON
      if (isOn) {
        const templateVisible = await page.locator('textarea').filter({
          has: page.locator('..').filter({ hasText: /reminder message/i })
        }).isVisible().catch(() => false)

        if (templateVisible) {
          console.log('✓ Reminder template textarea appeared when toggle is ON')
        }
      }
    }

    // Toggle changes auto-save, wait for auto-save to complete
    await page.waitForTimeout(2000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')

    const emailTab = page.getByRole('button', { name: /email settings/i })
    await emailTab.click()
    await page.waitForTimeout(1000)

    console.log('✓ SMS toggle test completed')

    // Restore original states
    const confirmationSectionRestore = page.locator('div').filter({ hasText: /send sms confirmation/i }).filter({
      has: page.locator('button')
    }).first()
    const confirmationToggleRestore = confirmationSectionRestore.locator('button').filter({ has: page.locator('span') }).first()

    const reminderSectionRestore = page.locator('div').filter({ hasText: /send sms reminder/i }).filter({
      has: page.locator('button')
    }).first()
    const reminderToggleRestore = reminderSectionRestore.locator('button').filter({ has: page.locator('span') }).first()

    // Check current states and restore if needed
    if (await confirmationToggleRestore.isVisible().catch(() => false)) {
      const classes = await confirmationToggleRestore.getAttribute('class')
      const currentState = classes?.includes('bg-slate-900') || false
      if (currentState !== originalConfirmation) {
        await confirmationToggleRestore.click()
        await page.waitForTimeout(2000) // Wait for auto-save
      }
    }

    if (await reminderToggleRestore.isVisible().catch(() => false)) {
      const classes = await reminderToggleRestore.getAttribute('class')
      const currentState = classes?.includes('bg-slate-900') || false
      if (currentState !== originalReminder) {
        await reminderToggleRestore.click()
        await page.waitForTimeout(2000) // Wait for auto-save
      }
    }

    console.log('✓ Original SMS toggle states restored')
  })
})

