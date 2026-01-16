-- ============================================
-- Emergency: Disable RLS on New Multi-Provider Tables
-- ============================================
-- This script disables RLS on the new provider-related tables
-- to stop potential recursion loops that are causing database lockups.
--
-- WARNING: This removes security restrictions. Only use as a temporary
-- emergency measure to unblock the database. Re-enable RLS with proper
-- policies once the issue is resolved.
--
-- Run this script to immediately unblock the database.
-- After confirming the issue is resolved, re-run 11_secure_providers.sql
-- to restore proper security.
-- ============================================

-- Disable RLS on the new tables to stop the recursion loop
ALTER TABLE public.providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services DISABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, verify RLS is disabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('providers', 'provider_schedules', 'provider_services');
--
-- rowsecurity should be 'f' (false) for all three tables.
-- ============================================

