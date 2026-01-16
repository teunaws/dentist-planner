# Playwright E2E Test Generation Prompt

## Context and Requirements

You are tasked with generating rigorous Playwright end-to-end tests for a dentist appointment planner web application. The application is built with React, TypeScript, and uses Supabase for the backend. The existing test structure is located in the `tests/` directory using Playwright.

## CRITICAL CONSTRAINTS

**⚠️ DO NOT MODIFY EXISTING TESTS** - The following test files are already working and implemented:
- `tests/admin.spec.ts` - Admin portal workflow (login, tenant creation, code generation, deletion)
- `tests/booking.spec.ts` - Public booking flow for patients
- `tests/login.spec.ts` - Dentist authentication flow

**You MUST create NEW test files** with unique names. Do not edit or modify any of the existing test files.

## Test Structure and Best Practices

1. **Test File Location**: Create new test files in the `tests/` directory with descriptive names (e.g., `employee-management.spec.ts`, `settings.spec.ts`, `block-time.spec.ts`)

2. **Test Structure**: Follow the existing pattern:
   - Use `test.describe()` to group related tests
   - Use descriptive test names that explain what is being tested
   - Set appropriate timeouts (default is 30 seconds, increase for complex flows)
   - Use `test.setTimeout()` for tests requiring longer execution times

3. **Locator Strategy**: You MUST examine the actual codebase to find the exact labels, text content, button names, and element structures. Use:
   - `page.getByRole()` for buttons, headings, inputs
   - `page.getByLabel()` for form inputs
   - `page.getByText()` for specific text content
   - `page.locator()` with CSS selectors only when necessary
   - Always use the most specific and reliable locator strategy

4. **Wait Strategies**: 
   - Always wait for navigation: `await page.waitForURL()` after clicks that cause navigation
   - Wait for network idle: `await page.waitForLoadState('networkidle')` after page loads
   - Use `expect().toBeVisible()` with appropriate timeouts
   - Wait for API responses when necessary using `page.waitForResponse()`

5. **Authentication**: 
   - Use environment variables for test credentials: `process.env.TEST_DENTIST_EMAIL` and `process.env.TEST_DENTIST_PASSWORD`
   - Use tenant slug from environment: `process.env.TEST_TENANT_SLUG || 'lumina'`
   - Follow the authentication pattern from `tests/login.spec.ts`

## Test Scenarios to Implement

### 1. Employee Creation Flow Test (`tests/employee-management.spec.ts`)

**Test Name**: `test.describe('Employee Management', ...)`

**Required Test Cases**:

1. **Create a new employee (provider)**
   - Navigate to Team Management page: `/{tenantSlug}/dentist/team`
   - Click "Add Provider" button (exact label from codebase: `src/pages/dentist/TeamPage.tsx`)
   - Fill in the provider name field (label: "Provider Name")
   - Select a color from the color picker
   - Select at least one service/capability from the checkboxes
   - Configure schedule (enable/disable days, set start/end times)
   - Click "Save" button
   - Verify the provider appears in the team list with correct details
   - Verify success notification appears

2. **Edit existing employee**
   - Find an existing provider in the list
   - Click "Edit" button
   - Modify the provider name
   - Change service capabilities
   - Update schedule for at least one day
   - Save changes
   - Verify changes are reflected in the UI

3. **Delete employee**
   - Find an existing provider
   - Click "Delete" button
   - Confirm deletion in the dialog
   - Verify provider is removed from the list

**Key Elements to Locate in Codebase**:
- Team page route: Check routing configuration
- "Add Provider" button: Line 627 in `src/pages/dentist/TeamPage.tsx`
- Form fields: Lines 665-702 in TeamPage.tsx (Provider Name, Color picker)
- Service checkboxes: Lines 711-727 (Capabilities section)
- Schedule toggles: Lines 742-795 (Weekly Schedule section)
- Save button: Line 826-829

### 2. Booking Flow Test Variations (`tests/booking-variations.spec.ts`)

**Test Name**: `test.describe('Booking Flow Variations', ...)`

**Required Test Cases**:

1. **Add new service and book it**
   - Login as dentist
   - Navigate to Services page: `/{tenantSlug}/dentist/services`
   - Click "Add Service" button
   - Fill in service details:
     - Name field (label: check `src/pages/tenant/ServicesPage.tsx`)
     - Description
     - Duration (in minutes)
     - Price
     - Add at least one perk
   - Save the service
   - Verify service is saved
   - Navigate to booking page: `/{tenantSlug}/book`
   - Verify the new service appears in the service selection
   - Complete a booking with the new service
   - Verify booking is successful

2. **Book multiple services variation**
   - Navigate to booking page
   - Select a service
   - Note: The booking flow appears to support single service booking. Test the current implementation and document any limitations.

**Key Elements to Locate**:
- Services page: `src/pages/tenant/ServicesPage.tsx` or `src/pages/tenant/TenantCustomizationPage.tsx`
- Add Service button: Check line 122 in ServicesPage.tsx
- Service form fields: Check the component structure

### 3. Practice Details and Settings Tests (`tests/practice-settings.spec.ts`)

**Test Name**: `test.describe('Practice Settings Management', ...)`

**Required Test Cases**:

1. **Change practice details**
   - Navigate to Settings page: `/{tenantSlug}/dentist/settings`
   - Locate "Practice Profile" section
   - Edit practice name
   - Edit address
   - Edit phone number
   - Edit email
   - Change timezone from dropdown
   - Save changes
   - Verify changes are saved (may need to reload or check via API)

2. **Toggle operating hours and verify booking system adjusts**
   - Navigate to Settings page
   - Go to "Operating Hours" section
   - Disable a day (e.g., Saturday) by unchecking the checkbox
   - Save settings
   - Navigate to booking page: `/{tenantSlug}/book`
   - Verify that the disabled day does not appear as available in the calendar
   - Re-enable the day in settings
   - Save settings
   - Return to booking page
   - Verify the day now appears as available

3. **Modify operating hours time slots**
   - In Settings, modify start/end times for a specific day
   - Save changes
   - Go to booking page
   - Verify that only time slots within the new operating hours are available

**Key Elements to Locate**:
- Settings page: `src/pages/dentist/SettingsPage.tsx`
- Practice Profile section: Lines 598-650 (approximate)
- Operating Hours section: Lines 762-829
- Day checkboxes: Line 768-782 (check the exact structure)
- Time inputs: Lines 788-795

### 4. Block Time Tests (`tests/block-time.spec.ts`)

**Test Name**: `test.describe('Block Time Management', ...)`

**Required Test Cases**:

1. **Block a time slot**
   - Login as dentist
   - Navigate to dashboard or calendar view where blocking is available
   - Find and click the button/action to block time (look for "Block Time" button or similar)
   - Fill in Block Time modal:
     - Select a date (date picker)
     - Set start time (hour and minute dropdowns)
     - Set end time
     - Optionally add a reason
   - Save the block
   - Verify the blocked time appears in the calendar/view
   - Navigate to booking page: `/{tenantSlug}/book`
   - Select the same date that was blocked
   - Verify that the blocked time slot is NOT available for booking

2. **Block overlapping time (same time twice)**
   - Block a time slot (e.g., 10:00 AM - 11:00 AM)
   - Attempt to block the same time slot again (or overlapping)
   - Verify appropriate error handling (either prevents blocking or shows error message)
   - Document the behavior

3. **Block partial overlap**
   - Block 10:00 AM - 12:00 PM
   - Attempt to block 11:00 AM - 1:00 PM (overlapping)
   - Verify behavior (should prevent or handle appropriately)

**Key Elements to Locate**:
- Block Time modal: `src/components/dentist/BlockTimeModal.tsx`
- Date input: Line 120-125
- Time selectors: Lines 128-160 (check exact structure)
- Block Time button: Need to find where this modal is triggered (likely in DentistDashboard)

### 5. Email and SMS Template Tests (`tests/communication-settings.spec.ts`)

**Test Name**: `test.describe('Communication Settings (Email/SMS)', ...)`

**Required Test Cases**:

1. **Change email template**
   - Navigate to Settings page
   - Click "Email Settings" tab
   - Locate "Email Template" section
   - Modify the subject line (find the input with label "Subject Line")
   - Modify the email body textarea
   - Use at least one variable like `{{patient_name}}` or `{{date}}`
   - Click "Save Communication Settings" button
   - Verify save is successful (success notification)

2. **Change SMS template**
   - In Email Settings tab, scroll to "SMS Configuration" section
   - If SMS confirmation is enabled, modify the "Confirmation Message Template" textarea
   - If SMS reminder is enabled, modify the "Reminder Message Template" textarea
   - Save changes
   - Verify save is successful

3. **Toggle all SMS and email sliders**
   - **SMS Confirmation Toggle**: 
     - Find the toggle for "Send SMS Confirmation"
     - Toggle it ON if OFF, or OFF if ON
     - Verify the toggle state changes
     - Verify the template textarea appears/disappears accordingly
   - **SMS Reminder Toggle**:
     - Find the toggle for "Send SMS Reminder (24h before)"
     - Toggle it ON if OFF, or OFF if ON
     - Verify the toggle state changes
     - Verify the template textarea appears/disappears accordingly
   - Save settings
   - Reload the page
   - Verify the toggle states persist

4. **Verify email template variables work**
   - Modify email template with variables
   - Complete a test booking
   - Check if variables are replaced correctly (may need to check email or confirmation page)

**Key Elements to Locate**:
- Email Settings component: `src/components/settings/EmailSettings.tsx`
- Email Settings tab: Line 584 in SettingsPage.tsx
- Subject input: Line 153-159 in EmailSettings.tsx
- Email body textarea: Line 166-172
- SMS toggles: Lines 256-272 (confirmation), Lines 319-335 (reminder)
- SMS template textareas: Lines 282-289 (confirmation), Lines 345-352 (reminder)
- Save button: Line 228 or 374

## Implementation Guidelines

### Step-by-Step Process

1. **Codebase Exploration**
   - Read the relevant component files to understand the exact UI structure
   - Identify all button labels, input labels, and text content
   - Note the exact routes and navigation paths
   - Check for any dynamic content or loading states

2. **Test File Creation**
   - Create a new file in `tests/` directory
   - Import necessary Playwright utilities: `import { test, expect } from '@playwright/test'`
   - Set up test describe blocks

3. **Authentication Setup**
   - Use `test.beforeEach()` if tests require authentication
   - Follow the pattern from `tests/login.spec.ts` for login flow
   - Store authentication state if needed

4. **Locator Identification**
   - Use browser DevTools or Playwright's `page.pause()` to inspect elements
   - Prefer semantic locators (role, label, text) over CSS selectors
   - Use `.or()` chaining for fallback locators when needed (see existing tests)

5. **Test Execution Flow**
   - Navigate to the page
   - Wait for page load
   - Interact with elements
   - Wait for responses/updates
   - Verify expected outcomes

6. **Error Handling**
   - Use try-catch for operations that might fail
   - Log helpful error messages
   - Take screenshots on failure (already configured in playwright.config.ts)

### Specific Locator Patterns

Based on the codebase structure, use these patterns:

```typescript
// For buttons
page.getByRole('button', { name: /exact button text/i })

// For form inputs with labels
page.getByLabel(/label text/i).or(page.locator('input[type="text"]').first())

// For checkboxes
page.getByRole('checkbox', { name: /label text/i })

// For dropdowns/selects
page.getByLabel(/field label/i).selectOption('value')

// For toggles/switches (they appear as buttons with specific styling)
page.locator('button[type="button"]').filter({ has: page.locator('.toggle-class') })
```

### Waiting and Synchronization

```typescript
// Wait for navigation
await page.waitForURL('**/expected-path', { timeout: 15000 })

// Wait for element visibility
await expect(element).toBeVisible({ timeout: 10000 })

// Wait for network requests
await page.waitForResponse(response => 
  response.url().includes('api-endpoint') && response.status() === 200
)

// Wait for network idle
await page.waitForLoadState('networkidle')
```

## Test Data Management

- Use unique identifiers for test data (timestamps, random strings)
- Clean up test data if necessary (optional, as tests should be idempotent)
- Use environment variables for test tenant and credentials

## Verification Points

For each test, verify:
1. **UI State**: Elements appear/disappear correctly
2. **Data Persistence**: Changes are saved and persist after page reload
3. **Functional Impact**: Changes affect related features (e.g., blocked time affects booking)
4. **Error Handling**: Appropriate errors are shown for invalid inputs
5. **User Feedback**: Success/error notifications appear correctly

## Files to Reference

Key files to examine before writing tests:

1. **Components**:
   - `src/pages/dentist/TeamPage.tsx` - Employee management
   - `src/pages/dentist/SettingsPage.tsx` - Settings and practice details
   - `src/components/dentist/BlockTimeModal.tsx` - Block time functionality
   - `src/components/settings/EmailSettings.tsx` - Email/SMS templates
   - `src/pages/tenant/ServicesPage.tsx` - Service management

2. **Existing Tests** (for reference only, DO NOT EDIT):
   - `tests/admin.spec.ts`
   - `tests/booking.spec.ts`
   - `tests/login.spec.ts`

3. **Routing**: Check `src/routes/AppRouter.tsx` for exact route paths

## Output Requirements

Create separate test files for each major feature area:
- `tests/employee-management.spec.ts` - Employee creation, editing, deletion
- `tests/booking-variations.spec.ts` - Service creation and booking variations
- `tests/practice-settings.spec.ts` - Practice details and operating hours
- `tests/block-time.spec.ts` - Block time functionality with variations
- `tests/communication-settings.spec.ts` - Email and SMS template management

Each test file should:
- Be self-contained and runnable independently
- Include proper error handling
- Use descriptive test names
- Follow the existing test patterns
- Include comments explaining complex test logic

## Success Criteria

Tests should:
- ✅ Run successfully without modifying existing tests
- ✅ Use exact element locators from the codebase
- ✅ Handle async operations and loading states properly
- ✅ Verify both UI changes and functional impact
- ✅ Be maintainable and readable
- ✅ Follow Playwright best practices

---

**START GENERATING TESTS NOW** - Begin by examining the codebase files mentioned above to identify exact element locators, then create the test files following this specification.

