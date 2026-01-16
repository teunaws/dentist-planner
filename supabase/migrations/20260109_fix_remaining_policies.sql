-- ==============================================================================
-- Fix Remaining Policies Migration
-- Date: 2026-01-09
-- Purpose: Switch remaining RLS policies from user_metadata to app_metadata
--          to satisfy Supabase Security Advisor warnings.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Step 1: Safety Sync (Idempotent)
-- ------------------------------------------------------------------------------
-- Ensure all users have app_metadata populated before switching policies
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT * FROM auth.users LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'role', COALESCE(user_record.raw_user_meta_data->>'role', 'patient'),
        'tenant_id', user_record.raw_user_meta_data->>'tenant_id',
        'provider', 'email'
      )
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- Step 2: Update Specific Policies
-- ------------------------------------------------------------------------------

-- 1. Appointments Table
-- Delete Policy
DROP POLICY IF EXISTS "Dentists can delete appointments in their tenant" ON appointments;
CREATE POLICY "Dentists can delete appointments in their tenant" ON appointments FOR DELETE USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'dentist' 
  AND 
  (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
);

-- View Policy (Select)
DROP POLICY IF EXISTS "Dentists view their tenant appointments" ON appointments;
CREATE POLICY "Dentists view their tenant appointments" ON appointments FOR SELECT USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'dentist' 
  AND 
  (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
);

-- 2. Access Logs Table
DROP POLICY IF EXISTS "Admins view logs" ON access_logs;
CREATE POLICY "Admins view logs" ON access_logs FOR SELECT USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 3. Rate Limits Table
DROP POLICY IF EXISTS "Admins can manage all rate limits" ON rate_limits;
CREATE POLICY "Admins can manage all rate limits" ON rate_limits FOR ALL USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 4. Provider Tables (Providers, Schedules, Services)

-- Providers
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Providers or Admins Manage All" ON providers;
CREATE POLICY "Dentists Manage Own Tenant Providers or Admins Manage All" ON providers FOR ALL USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  ( (select auth.jwt() -> 'app_metadata' ->> 'role') = 'dentist' AND (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id )
);

-- Schedules
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Schedules" ON provider_schedules;
CREATE POLICY "Dentists Manage Own Tenant Schedules" ON provider_schedules FOR ALL USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = provider_schedules.provider_id
    AND p.tenant_id = ((select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  )
);

-- Services (Provider Services)
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Capabilities" ON provider_services;
CREATE POLICY "Dentists Manage Own Tenant Capabilities" ON provider_services FOR ALL USING (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = provider_services.provider_id
    AND p.tenant_id = ((select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  )
);
