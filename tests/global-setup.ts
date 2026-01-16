/**
 * Global setup file for Playwright tests
 * This runs once before all tests and loads environment variables
 */
import { existsSync } from 'fs'
import { resolve } from 'path'

async function globalSetup() {
  try {
    const dotenv = await import('dotenv')
    const dotenvDefault = dotenv.default || dotenv
    
    const envLocal = resolve(process.cwd(), '.env.local')
    const envFile = resolve(process.cwd(), '.env')
    
    if (existsSync(envLocal)) {
      dotenvDefault.config({ path: envLocal })
      console.log('✓ [Global Setup] Loaded environment variables from .env.local')
      console.log(`   TEST_DENTIST_EMAIL: ${process.env.TEST_DENTIST_EMAIL || 'NOT SET'}`)
      console.log(`   TEST_ADMIN_EMAIL: ${process.env.TEST_ADMIN_EMAIL || 'NOT SET'}`)
    } else if (existsSync(envFile)) {
      dotenvDefault.config({ path: envFile })
      console.log('✓ [Global Setup] Loaded environment variables from .env')
      console.log(`   TEST_DENTIST_EMAIL: ${process.env.TEST_DENTIST_EMAIL || 'NOT SET'}`)
      console.log(`   TEST_ADMIN_EMAIL: ${process.env.TEST_ADMIN_EMAIL || 'NOT SET'}`)
    } else {
      console.log('⚠️  [Global Setup] No .env.local or .env file found')
    }
  } catch (error) {
    console.log('⚠️  [Global Setup] Could not load dotenv:', error)
    if (error instanceof Error) {
      console.log(`   Error: ${error.message}`)
    }
  }
}

export default globalSetup

