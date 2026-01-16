import { defineConfig, devices } from '@playwright/test'

/**
 * Load environment variables from .env.local or .env file
 * 
 * To enable automatic .env file loading:
 * 1. Install dotenv: npm install --save-dev dotenv
 * 2. The code below will automatically load .env files if dotenv is installed
 * 
 * Alternatively, set environment variables in your system (see SETUP_ENV.md)
 * Tests will use system environment variables if .env files are not available
 */
// Note: Environment variables are loaded via global-setup.ts
// This runs before all tests and ensures env vars are available in all workers
// The dotenv loading here is kept as a fallback but global-setup.ts is the primary method

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Global setup file - loads environment variables before tests */
  globalSetup: './tests/global-setup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* CRITICAL: Limit parallel workers to prevent DB connection exhaustion
   * Use 1 for maximum stability, or 2 for a balance. Default is often 4+.
   * This prevents flooding the Supabase instance with too many simultaneous connections.
   */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000, // 2 minutes for cold start
  },

  /* Test timeout - generous for Edge Functions cold start */
  timeout: 30000, // 30 seconds per test
  /* Global timeout for the whole test suite */
  globalTimeout: 1800000, // 30 minutes
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000, // 10 seconds for assertions
  },
})

