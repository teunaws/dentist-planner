#!/usr/bin/env node

/**
 * Script to check if environment variables are being loaded correctly
 * Run with: node check-env.js
 */

import fs from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function checkEnv() {
  console.log('\n🔍 Checking Environment Variable Loading...\n')

  // Check if dotenv is installed
  let dotenv
  try {
    const dotenvModule = await import('dotenv')
    dotenv = dotenvModule.default
    console.log('✓ dotenv is installed\n')
  } catch (error) {
    console.log('❌ dotenv is NOT installed')
    console.log('   Install with: npm install --save-dev dotenv\n')
    process.exit(1)
  }

  // Check for .env files
  const envLocal = resolve(process.cwd(), '.env.local')
  const envFile = resolve(process.cwd(), '.env')

  console.log('📁 Checking for .env files:')
  console.log(`   .env.local: ${fs.existsSync(envLocal) ? '✓ EXISTS' : '✗ NOT FOUND'}`)
  console.log(`   .env:       ${fs.existsSync(envFile) ? '✓ EXISTS' : '✗ NOT FOUND'}\n`)

  // Try loading .env.local first (higher priority)
  let loadedFrom = null
  if (fs.existsSync(envLocal)) {
    const result = dotenv.config({ path: envLocal })
    if (!result.error) {
      loadedFrom = '.env.local'
      console.log('✓ Loaded environment variables from .env.local\n')
    } else {
      console.log('⚠️  Error loading .env.local:', result.error.message)
    }
  }

  // Try loading .env if .env.local wasn't loaded
  if (!loadedFrom && fs.existsSync(envFile)) {
    const result = dotenv.config({ path: envFile })
    if (!result.error) {
      loadedFrom = '.env'
      console.log('✓ Loaded environment variables from .env\n')
    } else {
      console.log('⚠️  Error loading .env:', result.error.message)
    }
  }

  if (!loadedFrom) {
    console.log('⚠️  No .env files were loaded\n')
  }

  // Check for test-related environment variables
  console.log('📋 Test Environment Variables:')
  const testVars = {
    'TEST_DENTIST_EMAIL': process.env.TEST_DENTIST_EMAIL,
    'TEST_DENTIST_PASSWORD': process.env.TEST_DENTIST_PASSWORD,
    'TEST_TENANT_SLUG': process.env.TEST_TENANT_SLUG,
    'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY,
  }

  let allSet = true
  for (const [key, value] of Object.entries(testVars)) {
    if (value) {
      if (key.includes('PASSWORD') || key.includes('KEY')) {
        console.log(`   ${key}: ✓ SET (${value.substring(0, 10)}...)`)
      } else {
        console.log(`   ${key}: ✓ SET (${value})`)
      }
    } else {
      console.log(`   ${key}: ✗ NOT SET`)
      if (key.startsWith('TEST_')) {
        allSet = false
      }
    }
  }

  console.log('')

  if (loadedFrom) {
    console.log(`✅ Environment variables loaded from: ${loadedFrom}`)
  } else {
    console.log('⚠️  No .env files loaded - using system environment variables')
  }

  if (allSet && loadedFrom) {
    console.log('✅ All test variables are set and ready!\n')
  } else if (!allSet) {
    console.log('⚠️  Some test variables are missing')
    console.log('   Make sure TEST_DENTIST_EMAIL and TEST_DENTIST_PASSWORD are in your .env file\n')
  } else {
    console.log('⚠️  Environment variables may not be loaded from .env files\n')
  }

  // Show what Playwright will see
  console.log('🎭 What Playwright Tests Will See:')
  console.log(`   TEST_DENTIST_EMAIL: ${process.env.TEST_DENTIST_EMAIL || 'undefined (will use default: dentist@example.com)'}`)
  console.log(`   TEST_DENTIST_PASSWORD: ${process.env.TEST_DENTIST_PASSWORD ? '***SET***' : 'undefined (will use default: demo_password_123)'}`)
  console.log(`   TEST_TENANT_SLUG: ${process.env.TEST_TENANT_SLUG || 'undefined (will use default: lumina)'}\n`)
}

checkEnv().catch(console.error)
