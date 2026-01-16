-- ============================================
-- SCORCHED EARTH: Dynamic Policy Reset
-- ============================================
-- This script dynamically finds and drops ALL RLS policies on critical tables,
-- regardless of their names. This fixes the "Policy Name Mismatch" issue
-- that occurs when policy names don't match exactly.
--
-- CRITICAL: Run this FIRST to unblock the database before applying new policies.
-- ============================================

DO $$
DECLARE
    r RECORD;
    dropped_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting policy reset for critical tables...';
    
    -- Loop through ALL policies on critical tables and drop them dynamically
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
            'users', 
            'tenants', 
            'services', 
            'service_perks',
            'availability_slots', 
            'appointments',
            'appointment_durations',
            'onboarding_codes'
        )
        ORDER BY tablename, policyname
    ) LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
            RAISE NOTICE 'Dropped policy: % on %', r.policyname, r.tablename;
            dropped_count := dropped_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to drop policy % on %: %', r.policyname, r.tablename, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Policy reset complete. Dropped % policies.', dropped_count;
    
    -- Verify no policies remain
    RAISE NOTICE 'Verifying cleanup...';
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
            'users', 
            'tenants', 
            'services', 
            'service_perks',
            'availability_slots', 
            'appointments',
            'appointment_durations',
            'onboarding_codes'
        )
    ) LOOP
        RAISE WARNING 'Policy still exists: % on %', r.policyname, r.tablename;
    END LOOP;
    
    RAISE NOTICE 'Policy reset verification complete.';
END $$;
-- ============================================
-- IMPORTANT: Next Steps
-- ============================================
-- After running this script:
-- 1. Run 01_schema.sql (if tables need to be recreated)
-- 2. Run 02_functions_and_triggers.sql (to ensure functions are correct)
-- 3. Run 03_rls_policies.sql (to apply new non-recursive policies)
-- 4. Restart your Supabase database (Settings -> Infrastructure -> Restart)
--    This clears any "zombie" connections from previous recursion issues
-- ============================================


