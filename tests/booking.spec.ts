import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: Public Booking Flow
 * * Tests the critical path for a patient booking an appointment without logging in.
 * This simulates the complete booking journey from service selection to confirmation.
 */
test.describe('Public Booking Flow', () => {
  test('should complete booking flow for patient', async ({ page }) => {
    // Use 'lumina' tenant as specified in requirements
    const tenantSlug = 'lumina'
    const bookingUrl = `/en/${tenantSlug}/book`

    // Set a longer timeout for this test since it involves multiple steps and API calls
    test.setTimeout(60000) // 60 seconds

    // Navigate to booking page
    await page.goto(bookingUrl)

    // Wait for the page to load (check for service selection stage)
    await page.waitForLoadState('networkidle')

    // Wait for services to be loaded (look for service cards or loading to disappear)
    await page.waitForSelector('text=/Signature Clean|Express Polish|Whitening Studio/i', { timeout: 15000 })

    // Step 1: Service Selection - Click on the first Service Card
    // Service cards are buttons with service names
    const firstServiceButton = page.locator('button').filter({ hasText: /Signature Clean|Express Polish|Whitening Studio/i }).first()
    await expect(firstServiceButton).toBeVisible({ timeout: 10000 })
    await firstServiceButton.click()

    // Click "Continue to Time Selection" button
    const continueToTimeButton = page.getByRole('button', { name: /continue to time selection/i })
    await expect(continueToTimeButton).toBeVisible({ timeout: 5000 })
    await continueToTimeButton.click()

    // Step 2: Time Selection - Smart Date Walker Implementation
    // ---------------------------------------------------

    // 1. Verify Step Change (Use Heading Role - Unique)
    await expect(page.getByRole('heading', { name: /Select Date & Time/i })).toBeVisible({ timeout: 10000 });

    // 2. The "Smart Date Walker" Function
    // This iterates through dates until it finds one with available time slots
    const pickDateWithSlots = async () => {
      // Find all enabled date buttons - the calendar uses buttons with type="button" that contain day numbers
      // Date buttons contain spans with weekday, day number, and month, so we filter by buttons with numbers
      const dateButtons = page.locator('button[type="button"]:not([disabled])').filter({ hasText: /\d{1,2}/ });

      // Wait for at least one date to be visible
      await expect(dateButtons.first()).toBeVisible({ timeout: 10000 });
      const count = await dateButtons.count();

      if (count === 0) {
        throw new Error('No date buttons found in calendar');
      }

      // Try up to 5 different dates (or all available if less than 5)
      for (let i = 0; i < Math.min(count, 5); i++) {
        const dateBtn = dateButtons.nth(i);

        try {
          await dateBtn.click();
          // Small wait for state update
          await page.waitForTimeout(500);

          // Check for EITHER available slots OR "no available times" message
          const successIndicator = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s?(AM|PM)$/i }).first();
          const failureIndicator = page.getByText(/no available times/i).first();

          // Race between finding slots or "no slots" message (short timeout)
          try {
            await Promise.race([
              expect(successIndicator).toBeVisible({ timeout: 3000 }),
              expect(failureIndicator).toBeVisible({ timeout: 3000 })
            ]);

            // If we found a slot, we are done!
            if (await successIndicator.isVisible()) {
              console.log(`✓ Found slots on date index ${i}`);
              return successIndicator; // Return the slot locator
            }

            // If we see "no available times", try next date
            if (await failureIndicator.isVisible()) {
              console.log(`✗ Date index ${i} has no slots, trying next...`);
              continue;
            }
          } catch (raceError) {
            // If neither appeared quickly, check if slots exist (might be loading)
            // Wait a bit longer for slots to load
            try {
              await expect(successIndicator).toBeVisible({ timeout: 2000 });
              if (await successIndicator.isVisible()) {
                console.log(`✓ Found slots on date index ${i} (after wait)`);
                return successIndicator;
              }
            } catch {
              console.log(`✗ Date index ${i} timeout, trying next...`);
              continue;
            }
          }
        } catch (clickError) {
          console.log(`✗ Error clicking date index ${i}, trying next...`);
          continue;
        }
      }

      throw new Error('Checked 5 dates and found no available time slots');
    };

    // 3. Execute Smart Walker
    const availableSlot = await pickDateWithSlots();

    // 4. Click the found slot
    await availableSlot.click();

    // 5. Continue to Details
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await expect(continueButton).toBeEnabled({ timeout: 5000 });
    await continueButton.click();

    // ---------------------------------------------------

    // Wait for details form to appear
    await expect(page.getByText(/patient information/i)).toBeVisible({ timeout: 10000 })

    // Step 3: Form Fill - Fill out Name, Email, and Phone
    // Look for form inputs by label or placeholder
    const nameInput = page.getByLabel(/name/i).or(page.locator('input[type="text"]').first())
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill('John Doe')

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await emailInput.fill('john.doe@example.com')

    const phoneInput = page.getByLabel(/phone/i).or(page.locator('input[type="tel"]'))
    await expect(phoneInput).toBeVisible({ timeout: 5000 })
    await phoneInput.fill('555-123-4567')

    // Step 4: Submission - Click "Confirm Appointment" button
    const bookButton = page.getByRole('button', { name: /confirm appointment/i }).or(
      page.getByRole('button', { name: /book appointment/i })
    ).or(
      page.locator('button').filter({ hasText: /confirm|book/i }).first()
    )

    await expect(bookButton).toBeVisible({ timeout: 10000 })
    // Wait a moment for any form validation
    await page.waitForTimeout(300)
    await expect(bookButton).toBeEnabled({ timeout: 2000 })
    await bookButton.click()

    // Step 5: Assertion - Wait for the "Success" confirmation step
    await expect(
      page.getByRole('heading', { name: /appointment confirmed/i })
    ).toBeVisible({ timeout: 20000 })
  })

  test('should handle booking flow with soho-smiles tenant', async ({ page }) => {
    const tenantSlug = 'soho-smiles'
    const bookingUrl = `/en/${tenantSlug}/book`

    // Set a longer timeout for this test
    test.setTimeout(60000) // 60 seconds

    await page.goto(bookingUrl)
    await page.waitForLoadState('networkidle')

    // Wait for services to load
    await page.waitForSelector('text=/Studio Clean|After-hours Touch-up/i', { timeout: 15000 })

    // Select first service
    const firstService = page.locator('button').filter({ hasText: /Studio Clean|After-hours Touch-up/i }).first()
    await expect(firstService).toBeVisible({ timeout: 10000 })
    await firstService.click()

    // Click "Continue to Time Selection"
    const continueToTimeButton2 = page.getByRole('button', { name: /continue to time selection/i })
    await continueToTimeButton2.click()

    // Step 2: Time Selection - Smart Date Walker Implementation
    // ---------------------------------------------------

    // 1. Verify Step Change
    await expect(page.getByRole('heading', { name: /Select Date & Time/i })).toBeVisible({ timeout: 10000 });

    // 2. The "Smart Date Walker" Function (reused logic)
    const pickDateWithSlots2 = async () => {
      const dateButtons = page.locator('button[type="button"]:not([disabled])').filter({ hasText: /\d{1,2}/ });

      await expect(dateButtons.first()).toBeVisible({ timeout: 10000 });
      const count = await dateButtons.count();

      if (count === 0) {
        throw new Error('No date buttons found in calendar');
      }

      for (let i = 0; i < Math.min(count, 5); i++) {
        const dateBtn = dateButtons.nth(i);

        try {
          await dateBtn.click();
          await page.waitForTimeout(500);

          const successIndicator = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s?(AM|PM)$/i }).first();
          const failureIndicator = page.getByText(/no available times/i).first();

          try {
            await Promise.race([
              expect(successIndicator).toBeVisible({ timeout: 3000 }),
              expect(failureIndicator).toBeVisible({ timeout: 3000 })
            ]);

            if (await successIndicator.isVisible()) {
              console.log(`✓ Found slots on date index ${i}`);
              return successIndicator;
            }

            if (await failureIndicator.isVisible()) {
              console.log(`✗ Date index ${i} has no slots, trying next...`);
              continue;
            }
          } catch (raceError) {
            try {
              await expect(successIndicator).toBeVisible({ timeout: 2000 });
              if (await successIndicator.isVisible()) {
                console.log(`✓ Found slots on date index ${i} (after wait)`);
                return successIndicator;
              }
            } catch {
              console.log(`✗ Date index ${i} timeout, trying next...`);
              continue;
            }
          }
        } catch (clickError) {
          console.log(`✗ Error clicking date index ${i}, trying next...`);
          continue;
        }
      }

      throw new Error('Checked 5 dates and found no available time slots');
    };

    // 3. Execute Smart Walker
    const availableSlot2 = await pickDateWithSlots2();

    // 4. Click the found slot
    await availableSlot2.click();

    // 5. Continue
    const continueButton2 = page.getByRole('button', { name: /continue/i });
    await expect(continueButton2).toBeVisible({ timeout: 10000 });
    await expect(continueButton2).toBeEnabled({ timeout: 5000 });
    await continueButton2.click();

    // ---------------------------------------------------

    await expect(page.getByText(/patient information/i)).toBeVisible({ timeout: 5000 })

    // Fill form
    const nameInput = page.getByLabel(/name/i).or(page.locator('input[type="text"]').first())
    await nameInput.fill('Jane Smith')

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    await emailInput.fill('jane.smith@example.com')

    const phoneInput = page.getByLabel(/phone/i).or(page.locator('input[type="tel"]'))
    await phoneInput.fill('555-987-6543')

    // Submit booking
    const bookButton = page.getByRole('button', { name: /confirm appointment/i }).or(
      page.getByRole('button', { name: /book/i })
    )
    await expect(bookButton).toBeVisible({ timeout: 10000 })
    await expect(bookButton).toBeEnabled({ timeout: 2000 })
    await bookButton.click()

    // Verify confirmation
    await expect(
      page.getByRole('heading', { name: /appointment confirmed/i })
    ).toBeVisible({ timeout: 20000 })
  })
})