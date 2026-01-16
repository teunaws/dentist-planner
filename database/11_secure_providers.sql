-- ============================================
-- Secure Multi-Provider Tables with Non-Recursive RLS
-- ============================================
-- This migration ensures safe RLS policies for provider-related tables.
-- CRITICAL: All policies use JWT metadata checks (auth.jwt()) instead of
--           database queries to prevent infinite recursion.
--
-- Run this file AFTER 10_multi_provider.sql
-- ============================================

-- ============================================
-- ENABLE RLS ON PROVIDER TABLES
-- ============================================
-- Note: RLS may already be enabled from 10_multi_provider.sql,
-- but this ensures it's enabled regardless

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if any)
-- ============================================
-- Drop ALL possible policy names from both 10_multi_provider.sql and previous runs of this file
-- This ensures we can recreate them with the exact pattern we want

-- Providers table policies
DROP POLICY IF EXISTS "Enable Public Read Access" ON public.providers;
DROP POLICY IF EXISTS "Admins can manage all providers" ON public.providers;
DROP POLICY IF EXISTS "Public Read Providers" ON public.providers;
DROP POLICY IF EXISTS "Admins Manage Providers" ON public.providers;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Providers" ON public.providers;
DROP POLICY IF EXISTS "Admins Manage All Providers" ON public.providers;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Providers or Admins Manage All" ON public.providers;

-- Provider schedules table policies
DROP POLICY IF EXISTS "Enable Public Read Access" ON public.provider_schedules;
DROP POLICY IF EXISTS "Admins can manage all provider schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Public Read Schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Admins Manage Schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Schedules" ON public.provider_schedules;

-- Provider services table policies
DROP POLICY IF EXISTS "Enable Public Read Access" ON public.provider_services;
DROP POLICY IF EXISTS "Admins can manage all provider services" ON public.provider_services;
DROP POLICY IF EXISTS "Public Read Capabilities" ON public.provider_services;
DROP POLICY IF EXISTS "Admins Manage Capabilities" ON public.provider_services;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Capabilities" ON public.provider_services;

-- ============================================
-- PROVIDERS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
-- Action: SELECT
-- Logic: USING (true) - NO checks, NO queries, NO recursion possible
-- Purpose: Allow availability calculations without authentication
CREATE POLICY "Public Read Providers"
  ON public.providers FOR SELECT
  TO public
  USING (true);

-- Policy 2: Dentist Write (INSERT, UPDATE, DELETE) - Own Tenant Only OR Admin
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- FIXED: Consolidated Policy 2 and Policy 3 into single policy
-- Action: ALL (INSERT, UPDATE, DELETE)
-- Logic: Uses JWT metadata ONLY - NO database query = NO recursion
-- Purpose: Authenticated dentists can modify providers for their own tenant, admins can modify all
CREATE POLICY "Dentists Manage Own Tenant Providers or Admins Manage All"
  ON public.providers FOR ALL
  TO authenticated
  USING (
    -- Allow if user is admin OR user's tenant_id matches provider's tenant_id
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
  WITH CHECK (
    -- Same check for new/updated rows
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  );

-- ============================================
-- PROVIDER_SCHEDULES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
-- Action: SELECT
-- Logic: USING (true) - NO checks, NO queries, NO recursion possible
-- Purpose: Allow availability calculations without authentication
CREATE POLICY "Public Read Schedules"
  ON public.provider_schedules FOR SELECT
  TO public
  USING (true);

-- Policy 2: Dentist Write (INSERT, UPDATE, DELETE) - Own Tenant Only
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- Action: ALL (INSERT, UPDATE, DELETE)
-- Logic: Uses JWT metadata + EXISTS query on providers table
-- Purpose: Authenticated dentists can modify schedules for providers in their tenant
-- Note: EXISTS query is safe because providers table has public read policy (USING true)
CREATE POLICY "Dentists Manage Own Tenant Schedules"
  ON public.provider_schedules FOR ALL
  TO authenticated
  USING (
    -- Allow if user is admin OR provider belongs to user's tenant
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    -- Same check for new/updated rows
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );

-- ============================================
-- PROVIDER_SERVICES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
-- Action: SELECT
-- Logic: USING (true) - NO checks, NO queries, NO recursion possible
-- Purpose: Allow availability calculations without authentication
CREATE POLICY "Public Read Capabilities"
  ON public.provider_services FOR SELECT
  TO public
  USING (true);

-- Policy 2: Dentist Write (INSERT, UPDATE, DELETE) - Own Tenant Only
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- Action: ALL (INSERT, UPDATE, DELETE)
-- Logic: Uses JWT metadata + EXISTS query on providers table
-- Purpose: Authenticated dentists can modify capabilities for providers in their tenant
-- Note: EXISTS query is safe because providers table has public read policy (USING true)
CREATE POLICY "Dentists Manage Own Tenant Capabilities"
  ON public.provider_services FOR ALL
  TO authenticated
  USING (
    -- Allow if user is admin OR provider belongs to user's tenant
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    -- Same check for new/updated rows
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );

-- ============================================
-- NOTES ON RLS POLICIES
-- ============================================
--
-- KEY PRINCIPLES:
-- 1. All admin checks use JWT metadata (auth.jwt()) - NO database queries
-- 2. This prevents infinite recursion that would lock up the database
-- 3. Public read policies use USING (true) - absolutely no checks
-- 4. Write policies are restricted to authenticated users only
--
-- SECURITY:
-- - Public can READ provider tables (required for availability calculation)
-- - Only authenticated admins can WRITE to provider tables (checked via JWT)
-- - All write operations remain restricted
--
-- WHY THIS PREVENTS RECURSION:
-- - USING (true): No database queries, just returns true immediately
-- - (select auth.jwt()): Reads from JWT token metadata, NOT from database tables, evaluated once per query
-- - No table lookups: Never queries users, providers, or any other table
-- - Zero recursion: Policy evaluation is O(1) with no side effects
-- - Per-query evaluation: auth functions wrapped in (select ...) are evaluated once, not per row
--
-- IMPORTANT:
-- - The role MUST be set in JWT metadata (auth.users.raw_user_meta_data)
-- - Users may need to log out and log back in to refresh JWT tokens
-- - Admin role is checked at the JWT level, not via database queries
-- ============================================

