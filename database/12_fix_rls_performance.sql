-- ============================================
-- RLS Performance Optimization Migration
-- ============================================
-- This migration fixes two critical RLS performance issues:
-- 1. auth_rls_initplan: Wraps auth.uid() and auth.jwt() in (select ...) for per-query evaluation
-- 2. multiple_permissive_policies: Consolidates multiple policies for same action
--
-- Run this file to apply performance fixes to existing RLS policies
-- ============================================

-- ============================================
-- USERS TABLE - Consolidate and Fix Policies
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view their own record or admins view all"
  ON public.users FOR SELECT
  USING (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Create consolidated UPDATE policy
CREATE POLICY "Users can update their own record or admins update all"
  ON public.users FOR UPDATE
  USING (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Fix remaining policies
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- TENANTS TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can insert tenants" ON public.tenants;
CREATE POLICY "Admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update tenants" ON public.tenants;
CREATE POLICY "Admins can update tenants"
  ON public.tenants FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete tenants" ON public.tenants;
CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- SERVICES TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all services" ON public.services;
CREATE POLICY "Admins can manage all services"
  ON public.services FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- SERVICE_PERKS TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all service perks" ON public.service_perks;
CREATE POLICY "Admins can manage all service perks"
  ON public.service_perks FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- AVAILABILITY_SLOTS TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all availability slots" ON public.availability_slots;
CREATE POLICY "Admins can manage all availability slots"
  ON public.availability_slots FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- APPOINTMENTS TABLE - Remove Redundant Policy
-- ============================================

-- Remove redundant admin SELECT policy (public read already covers all)
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;

-- Fix remaining policies
DROP POLICY IF EXISTS "Admins can insert appointments" ON public.appointments;
CREATE POLICY "Admins can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update appointments" ON public.appointments;
CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;
CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- APPOINTMENT_DURATIONS TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all appointment durations" ON public.appointment_durations;
CREATE POLICY "Admins can manage all appointment durations"
  ON public.appointment_durations FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- ONBOARDING_CODES TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all onboarding codes" ON public.onboarding_codes;
CREATE POLICY "Admins can manage all onboarding codes"
  ON public.onboarding_codes FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- RATE_LIMITS TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all rate limits" ON public.rate_limits;
CREATE POLICY "Admins can manage all rate limits"
  ON public.rate_limits FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- PROVIDERS TABLE - Consolidate and Fix Policies
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins can manage all providers" ON public.providers;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Providers" ON public.providers;
DROP POLICY IF EXISTS "Admins Manage All Providers" ON public.providers;
DROP POLICY IF EXISTS "Dentists Manage Own Tenant Providers or Admins Manage All" ON public.providers;

-- Create consolidated policy
CREATE POLICY "Dentists Manage Own Tenant Providers or Admins Manage All"
  ON public.providers FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  );

-- ============================================
-- PROVIDER_SCHEDULES TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Dentists Manage Own Tenant Schedules" ON public.provider_schedules;
CREATE POLICY "Dentists Manage Own Tenant Schedules"
  ON public.provider_schedules FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );

-- ============================================
-- PROVIDER_SERVICES TABLE - Fix Policies
-- ============================================

DROP POLICY IF EXISTS "Dentists Manage Own Tenant Capabilities" ON public.provider_services;
CREATE POLICY "Dentists Manage Own Tenant Capabilities"
  ON public.provider_services FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );

-- ============================================
-- NOTES
-- ============================================
--
-- PERFORMANCE IMPROVEMENTS:
-- 1. All auth.uid() and auth.jwt() calls are wrapped in (select ...)
--    This forces Postgres to evaluate them once per query instead of once per row
--    Impact: 50,000 rows = 1 function call instead of 50,000 calls
--
-- 2. Multiple policies for the same action are consolidated
--    This reduces query planner complexity and improves index usage
--    Impact: Faster query planning and better index utilization
--
-- EXPECTED RESULTS:
-- - Queries that took 5+ seconds should now complete in <100ms
-- - No more timeout errors on large tables
-- - Reduced CPU usage on database server
-- - Better scalability as data grows
--
-- ============================================

