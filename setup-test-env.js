#!/usr/bin/env node

/**
 * Helper script to create .env.local file for E2E tests
 * Run with: node setup-test-env.js
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function setup() {
  console.log('\n🔧 E2E Test Environment Setup\n')
  console.log('This will create a .env.local file with your test credentials.\n')

  const supabaseUrl = await question('Enter your Supabase URL (VITE_SUPABASE_URL): ')
  const supabaseKey = await question('Enter your Supabase Anon Key (VITE_SUPABASE_ANON_KEY): ')
  const dentistEmail = await question('Enter test dentist email (TEST_DENTIST_EMAIL) [dentist@example.com]: ') || 'dentist@example.com'
  const dentistPassword = await question('Enter test dentist password (TEST_DENTIST_PASSWORD): ')
  const tenantSlug = await question('Enter tenant slug (TEST_TENANT_SLUG) [lumina]: ') || 'lumina'
  
  console.log('\n--- Admin Credentials (for admin E2E tests) ---')
  const adminEmail = await question('Enter admin email (TEST_ADMIN_EMAIL) [admin@system.com]: ') || 'admin@system.com'
  const adminPassword = await question('Enter admin password (TEST_ADMIN_PASSWORD): ')

  const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseKey}

# Test Credentials for E2E Tests
TEST_DENTIST_EMAIL=${dentistEmail}
TEST_DENTIST_PASSWORD=${dentistPassword}

# Optional: Tenant slug to use for testing
TEST_TENANT_SLUG=${tenantSlug}

# Admin Credentials for Admin Portal E2E Tests
TEST_ADMIN_EMAIL=${adminEmail}
TEST_ADMIN_PASSWORD=${adminPassword}
`

  const envPath = path.join(process.cwd(), '.env.local')
  
  try {
    fs.writeFileSync(envPath, envContent)
    console.log(`\n✅ Created .env.local file at ${envPath}`)
    console.log('\n📋 Next steps:')
    console.log('   1. Verify the credentials are correct')
    console.log('   2. Make sure the test dentist user exists in Supabase Auth')
    console.log('   3. Run tests with: npm run test:e2e\n')
  } catch (error) {
    console.error('\n❌ Error creating .env.local file:', error.message)
    process.exit(1)
  }

  rl.close()
}

setup().catch(console.error)

