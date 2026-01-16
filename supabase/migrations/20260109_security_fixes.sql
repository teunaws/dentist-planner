-- ==============================================================================
-- Security Fixes Migration
-- Date: 2026-01-09
-- Purpose: Resolve Supabase Security Advisor warnings
-- 1. Enable RLS on patients
-- 2. Fix analytics views (security_invoker)
-- 3. Migrate from user_metadata (insecure) to app_metadata (secure)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Step 1: Enable RLS on patients
-- ------------------------------------------------------------------------------
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Step 2: Fix Analytics Views (Prevent Data Leaks)
-- ------------------------------------------------------------------------------
-- Instead of dropping/recreating, we alter them to explicit Security Invoker mode
-- This ensures they respect the RLS policies of the user running the query
ALTER VIEW IF EXISTS monthly_patient_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS patient_visit_history SET (security_invoker = true);
ALTER VIEW IF EXISTS treatment_distribution SET (security_invoker = true);

-- ------------------------------------------------------------------------------
-- Step 3: Secure Metadata Migration
-- ------------------------------------------------------------------------------

-- 3.1 Update handle_new_user Trigger
-- Sync role and tenant_id to app_metadata on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
  v_name TEXT;
  v_tenant_id UUID;
BEGIN
  -- Extract role (default 'dentist')
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'dentist');
  
  -- Extract name
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  
  -- Extract tenant_id
  v_tenant_id := NULL;
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    BEGIN
      v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
  END IF;

  -- Insert into public.users
  INSERT INTO public.users (id, email, name, role, tenant_id, password_hash, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_tenant_id, '', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, users.tenant_id),
    updated_at = NOW();

  -- NEW: Sync to app_metadata (Secure)
  -- We update the AUTH user record to ensure app_metadata is populated
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', v_role,
      'tenant_id', v_tenant_id
    )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 3.2 Update sync_user_role_to_jwt Function
-- Ensure updates to public.users (e.g. admin panel) sync to app_metadata
CREATE OR REPLACE FUNCTION sync_user_role_to_jwt()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.role, u.tenant_id
    FROM public.users u
    WHERE u.role IS NOT NULL
  LOOP
    -- Update auth.users.raw_app_meta_data (Secure) instead of user_metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'role', user_record.role,
          'tenant_id', COALESCE(user_record.tenant_id::text, '')
        ),
      -- Keep user_metadata synced for backward compatibility if needed, 
      -- but our policies will now check app_metadata
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'role', user_record.role,
          'tenant_id', COALESCE(user_record.tenant_id::text, '')
        )
    WHERE id = user_record.id
      AND (
        COALESCE(raw_app_meta_data->>'role', '') IS DISTINCT FROM COALESCE(user_record.role, '') OR
        COALESCE(raw_app_meta_data->>'tenant_id', '') IS DISTINCT FROM COALESCE(user_record.tenant_id::text, '')
      );
  END LOOP;
END;
$$;

-- 3.3 Backfill Existing Users
-- Copy role/tenant_id from user_metadata to app_metadata
DO $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', COALESCE(raw_user_meta_data->>'role', 'dentist'),
      'tenant_id', raw_user_meta_data->>'tenant_id'
    )
  WHERE raw_app_meta_data IS NULL 
     OR NOT (raw_app_meta_data ? 'role');
END;
$$;


-- ------------------------------------------------------------------------------
-- Step 4: Update RLS Policies (Switch to app_metadata)
-- ------------------------------------------------------------------------------

-- USERS Table
DROP POLICY IF EXISTS "Users can view their own record or admins view all" ON public.users;
CREATE POLICY "Users can view their own record or admins view all"
  ON public.users FOR SELECT
  USING (
    (select auth.uid()) = id OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can update their own record or admins update all" ON public.users;
CREATE POLICY "Users can update their own record or admins update all"
  ON public.users FOR UPDATE
  USING (
    (select auth.uid()) = id OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select auth.uid()) = id OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- TENANTS Table
DROP POLICY IF EXISTS "Admins can insert tenants" ON public.tenants;
CREATE POLICY "Admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update tenants" ON public.tenants;
CREATE POLICY "Admins can update tenants"
  ON public.tenants FOR UPDATE
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete tenants" ON public.tenants;
CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- SERVICES Table
DROP POLICY IF EXISTS "Admins can manage all services" ON public.services;
CREATE POLICY "Admins can manage all services"
  ON public.services FOR ALL
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- SERVICE_PERKS Table
DROP POLICY IF EXISTS "Admins can manage all service perks" ON public.service_perks;
CREATE POLICY "Admins can manage all service perks"
  ON public.service_perks FOR ALL
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- AVAILABILITY_SLOTS Table
DROP POLICY IF EXISTS "Admins can manage all availability slots" ON public.availability_slots;
CREATE POLICY "Admins can manage all availability slots"
  ON public.availability_slots FOR ALL
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- APPOINTMENTS Table
-- Note: Select/Public Insert policies remain unchanged (they use true or tenant_id)
DROP POLICY IF EXISTS "Admins can insert appointments" ON public.appointments;
CREATE POLICY "Admins can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update appointments" ON public.appointments;
CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;
CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');



-- ONBOARDING_CODES Table
DROP POLICY IF EXISTS "Admins can manage all onboarding codes" ON public.onboarding_codes;
CREATE POLICY "Admins can manage all onboarding codes"
  ON public.onboarding_codes FOR ALL
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- RATE_LIMITS (from Security Hardening)
DROP POLICY IF EXISTS "Admins can view rate limits" ON rate_limits;
CREATE POLICY "Admins can view rate limits"
  ON rate_limits FOR SELECT
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ACCESS_LOGS (from Security Hardening)
DROP POLICY IF EXISTS "Admins can view access logs" ON access_logs;
CREATE POLICY "Admins can view access logs"
  ON access_logs FOR SELECT
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
