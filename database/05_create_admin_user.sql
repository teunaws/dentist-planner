-- ============================================
-- Create Admin User in Supabase Auth
-- ============================================
-- This script helps you create an admin user for the admin portal.
-- 
-- IMPORTANT: You cannot create users in Supabase Auth via SQL.
-- You must FIRST create the user in Supabase Auth using one of these methods:
--
-- Method 1: Via Supabase Dashboard (Recommended)
-- 1. Go to Authentication → Users → Add User
-- 2. Email: admin@system.com
-- 3. Password: admin123 (or your preferred password)
-- 4. Auto Confirm User: YES (check this box)
-- 5. Click "Create User"
-- 6. Copy the User ID (UUID) that appears
--
-- Method 2: Via Supabase CLI
-- Run: supabase auth users create admin@system.com --password admin123 --email-confirm
--
-- Method 3: Via API (using service role key)
-- POST https://your-project.supabase.co/auth/v1/admin/users
-- Headers: { "apikey": "your-service-role-key", "Authorization": "Bearer your-service-role-key" }
-- Body: { "email": "admin@system.com", "password": "admin123", "email_confirm": true }
--
-- After creating the user in Supabase Auth, run the SQL below to ensure
-- the user exists in the public.users table with admin role.
-- ============================================

-- ============================================
-- STEP 1: Find the UUID (Run this first!)
-- ============================================
-- This will show you the UUID for admin@system.com
-- Copy the UUID from the 'id' column
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'admin@system.com';

-- ============================================
-- STEP 2: Update the user role to admin
-- ============================================
-- Option A: Using subquery (automatically finds UUID)
-- This will work if the user exists in auth.users
-- Note: password_hash is set to empty string since Supabase Auth manages passwords
INSERT INTO users (id, email, password_hash, role, name, tenant_id)
SELECT 
  au.id,  -- Get UUID from auth.users automatically
  'admin@system.com',
  '',  -- Empty string - password managed by Supabase Auth
  'admin',
  'System Admin',
  NULL -- Admins don't belong to a tenant
FROM auth.users au
WHERE au.email = 'admin@system.com'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'admin',
  email = 'admin@system.com',
  name = 'System Admin',
  tenant_id = NULL;

-- ============================================
-- STEP 3: Verify it worked
-- ============================================
SELECT id, email, role, name, tenant_id 
FROM users 
WHERE email = 'admin@system.com' AND role = 'admin';

-- ============================================
-- ALTERNATIVE: Manual method (if subquery fails)
-- ============================================
-- If Option A above doesn't work, use this:
-- 1. Run STEP 1 above to get the UUID
-- 2. Replace 'YOUR_UUID_HERE' below with the actual UUID
-- 3. Run this SQL:

/*
INSERT INTO users (id, email, password_hash, role, name, tenant_id)
VALUES (
  'YOUR_UUID_HERE',  -- ⚠️ REPLACE THIS with UUID from STEP 1
  'admin@system.com',
  '',  -- Empty string - password managed by Supabase Auth
  'admin',
  'System Admin',
  NULL
)
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'admin',
  email = 'admin@system.com',
  name = 'System Admin',
  tenant_id = NULL;
*/

-- Verify the user was created
SELECT id, email, role, name, tenant_id 
FROM users 
WHERE email = 'admin@system.com' AND role = 'admin';

