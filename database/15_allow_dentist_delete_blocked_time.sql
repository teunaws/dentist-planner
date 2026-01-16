-- ============================================
-- Migration: Allow Dentists to Delete Blocked Time
-- ============================================
-- Issue: Dentists cannot delete blocked times from their calendar
-- because the RLS policy only allows admins to delete appointments.
--
-- Solution: Add a policy that allows dentists to delete appointments
-- (specifically blocked times) in their own tenant.
-- ============================================

-- Drop the existing admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;

-- Recreate with both admin and dentist access
-- Admins can delete any appointment
CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Dentists can delete appointments (including blocked times) in their tenant
CREATE POLICY "Dentists can delete appointments in their tenant"
  ON public.appointments FOR DELETE
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'dentist'
    AND tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  );

-- Note: This allows dentists to delete both regular appointments and blocked times
-- If you want to restrict dentists to only delete blocked times, you can add:
-- AND status = 'Blocked'
-- However, dentists should be able to cancel regular appointments too, so we don't restrict it.

