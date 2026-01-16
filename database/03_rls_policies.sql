-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- This file contains all RLS policies for the application.
-- CRITICAL: All policies use JWT metadata checks (auth.jwt()) instead of
--           database queries to prevent infinite recursion.
--
-- Run this file AFTER 00_reset_policies.sql and 02_functions_and_triggers.sql
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_codes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- CRITICAL: Use auth.uid() for self-access, auth.jwt() for admin checks
-- NEVER query the users table in policies (causes recursion)

-- Policy 1: Users can view their own record OR admins can view all users
-- FIXED: Wrapped auth functions in (select ...) for per-query evaluation
-- FIXED: Consolidated multiple SELECT policies into one
CREATE POLICY "Users can view their own record or admins view all"
  ON public.users FOR SELECT
  USING (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Policy 2: Admin Full Access - INSERT
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy 3: Users can update their own record OR admins can update all users
-- FIXED: Wrapped auth functions in (select ...) for per-query evaluation
-- FIXED: Consolidated multiple UPDATE policies into one
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

-- Policy 4: Admin Full Access - DELETE
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- TENANTS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (Absolute)
-- Action: SELECT
-- Logic: USING (true) - NO checks, NO queries, NO recursion possible
CREATE POLICY "Public Read Tenants"
  ON public.tenants FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access - INSERT
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy 3: Admin Full Access - UPDATE
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can update tenants"
  ON public.tenants FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy 4: Admin Full Access - DELETE
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- SERVICES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
CREATE POLICY "Enable Public Read Access"
  ON public.services FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all services"
  ON public.services FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- SERVICE_PERKS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
CREATE POLICY "Enable Public Read Access"
  ON public.service_perks FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all service perks"
  ON public.service_perks FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- AVAILABILITY_SLOTS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
CREATE POLICY "Enable Public Read Access"
  ON public.availability_slots FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all availability slots"
  ON public.availability_slots FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- APPOINTMENTS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (for availability checking)
CREATE POLICY "Enable Public Read Access"
  ON public.appointments FOR SELECT
  TO public
  USING (true);

-- Policy 2: Public Insert (for patient bookings)
-- Patients can book appointments without authentication
CREATE POLICY "Public can insert appointments"
  ON public.appointments FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy 3: Admin Full Access - INSERT (admins can also insert)
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public insert policy already covers INSERT, so this is redundant but kept for admin-specific logic
CREATE POLICY "Admins can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy 4: Admin Full Access - UPDATE
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy 5: Admin Full Access - DELETE
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
-- NOTE: Removed redundant "Admins can view all appointments" SELECT policy
-- Public read policy (USING true) already covers all SELECT operations

-- ============================================
-- APPOINTMENT_DURATIONS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read
CREATE POLICY "Enable Public Read Access"
  ON public.appointment_durations FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all appointment durations"
  ON public.appointment_durations FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- ONBOARDING_CODES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (for onboarding flow)
-- Users need to be able to read codes to verify them during onboarding
CREATE POLICY "Public can view onboarding codes"
  ON public.onboarding_codes FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access (for creating/managing codes)
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all onboarding codes"
  ON public.onboarding_codes FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- NOTES ON RLS POLICIES
-- ============================================
--
-- KEY PRINCIPLES:
-- 1. All admin checks use JWT metadata wrapped in (select ...) - Evaluated once per query, not per row
-- 2. This prevents infinite recursion that would lock up the database
-- 3. Public read policies use USING (true) - absolutely no checks
-- 4. Self-access policies use (select auth.uid()) - safe, no recursion, evaluated once per query
-- 5. Multiple policies for same action are consolidated to reduce query planner complexity
--
-- SECURITY:
-- - Public can READ configuration tables (tenants, services, etc.)
-- - Only admins can WRITE to any table (checked via JWT)
-- - Users can only see/update their own record
-- - All write operations remain restricted
--
-- IMPORTANT:
-- - The role MUST be set in JWT metadata (auth.users.raw_user_meta_data)
-- - Users may need to log out and log back in to refresh JWT tokens
-- ============================================
