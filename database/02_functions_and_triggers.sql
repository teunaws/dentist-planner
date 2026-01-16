-- ============================================
-- Database Functions and Triggers
-- ============================================
-- This file contains all database functions and triggers.
-- Run this file after 01_schema.sql
-- ============================================

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
-- Automatically updates the updated_at timestamp on row updates

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
-- Add triggers for updated_at on relevant tables

CREATE TRIGGER update_tenants_updated_at 
  BEFORE UPDATE ON tenants
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at 
  BEFORE UPDATE ON services
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HANDLE_NEW_USER FUNCTION
-- ============================================
-- Automatically creates a user record in public.users when a new user
-- is created in auth.users via Supabase Auth.
--
-- CRITICAL: Uses SECURITY DEFINER to bypass RLS policies, allowing
-- user creation even if policies would normally block it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- ⚠️ CRITICAL: This bypasses RLS entirely
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
  v_name TEXT;
  v_tenant_id UUID;
BEGIN
  -- Extract role from user metadata (default to 'dentist' for onboarding)
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'dentist'  -- Default to dentist since most signups are via onboarding
  );
  
  -- Extract name from user metadata (default to email if not provided)
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  
  -- Extract tenant_id from user metadata (may be NULL during onboarding)
  v_tenant_id := NULL;
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    BEGIN
      v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    EXCEPTION
      WHEN OTHERS THEN
        -- If casting fails, leave as NULL (will be set by complete_onboarding)
        v_tenant_id := NULL;
    END;
  END IF;

  -- Insert user into public.users
  -- SECURITY DEFINER ensures this bypasses RLS policies
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    tenant_id,
    password_hash,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_tenant_id,  -- May be NULL, will be set by complete_onboarding
    '',  -- Empty string - password managed by Supabase Auth
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, users.tenant_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Grant schema and table permissions to service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.users TO service_role;

-- ============================================
-- ON_AUTH_USER_CREATED TRIGGER
-- ============================================
-- This trigger fires AFTER a new user is created in auth.users
-- It automatically creates the corresponding record in public.users

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- COMPLETE_ONBOARDING FUNCTION
-- ============================================
-- Completes the onboarding process:
-- 1. Creates/updates user record in users table
-- 2. Marks onboarding code as used
-- 3. Marks tenant as onboarded
--
-- Uses SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_name TEXT,
  p_user_role TEXT,
  p_user_tenant_id UUID,
  p_onboarding_code_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Insert/update user record (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO users (
    id,
    email,
    name,
    role,
    tenant_id,
    password_hash,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_user_email,
    p_user_name,
    p_user_role,
    p_user_tenant_id,
    '', -- Empty string since password is managed by Supabase Auth
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id,
    updated_at = NOW();

  -- Step 2: Mark onboarding code as used
  UPDATE onboarding_codes
  SET 
    is_used = true,
    used_at = NOW()
  WHERE id = p_onboarding_code_id;

  -- Step 3: Mark tenant as onboarded
  UPDATE tenants
  SET 
    is_onboarded = true,
    onboarded_at = NOW()
  WHERE id = p_user_tenant_id;

  RETURN p_user_id;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION complete_onboarding(UUID, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_onboarding(UUID, TEXT, TEXT, TEXT, UUID, UUID) TO anon;

-- ============================================
-- SYNC_USER_ROLE_TO_JWT FUNCTION
-- ============================================
-- Ensures that the role from public.users is synced to auth.users.raw_user_meta_data
-- so it appears in the JWT token. This is needed for RLS policies that check JWT metadata.

CREATE OR REPLACE FUNCTION sync_user_role_to_jwt()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Update all users to ensure their role is in JWT metadata
  FOR user_record IN 
    SELECT u.id, u.role, u.tenant_id
    FROM public.users u
    WHERE u.role IS NOT NULL
  LOOP
    -- Update auth.users.raw_user_meta_data to include role and tenant_id
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'role', user_record.role,
          'tenant_id', COALESCE(user_record.tenant_id::text, '')
        )
    WHERE id = user_record.id
      AND (
        COALESCE(raw_user_meta_data->>'role', '') IS DISTINCT FROM COALESCE(user_record.role, '') OR
        COALESCE(raw_user_meta_data->>'tenant_id', '') IS DISTINCT FROM COALESCE(user_record.tenant_id::text, '')
      );
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_user_role_to_jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_role_to_jwt() TO service_role;

