-- ============================================
-- Force Admin Metadata Update
-- ============================================
-- This script updates the auth.users table to inject the 'admin' role
-- into the JWT metadata (raw_user_meta_data and raw_app_meta_data).
-- 
-- IMPORTANT: The application reads the role from JWT metadata, NOT from
-- the public.users table, to avoid database timeouts during initialization.
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Run this script in the Supabase Dashboard SQL Editor
-- 2. After running, LOGOUT and LOGIN again to refresh your JWT token
-- 3. The new token will include the admin role in metadata
-- ============================================

-- 1. Force the Metadata to include role: 'admin'
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin", "tenant_id": null}'::jsonb
WHERE email = 'admin@system.com';

-- 2. Force the App Metadata (Super Admin flag)
UPDATE auth.users
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin", "provider": "email"}'::jsonb
WHERE email = 'admin@system.com';

-- 3. Verification Query (Run this to confirm the JSON changed)
-- Uncomment the line below to verify the update:
-- SELECT email, raw_user_meta_data, raw_app_meta_data 
-- FROM auth.users 
-- WHERE email = 'admin@system.com';

-- ============================================
-- CRITICAL NEXT STEPS:
-- ============================================
-- 1. After running this script, you MUST logout and login again
-- 2. The JWT token is cached in localStorage and won't update until you re-authenticate
-- 3. After logging back in, the new token will include role: 'admin' in metadata
-- 4. The admin portal should then recognize you as an admin
-- ============================================

