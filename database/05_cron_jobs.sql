-- ============================================
-- Database Cron Jobs Setup
-- ============================================
-- This file sets up pg_cron to schedule automated SMS reminders
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable pg_cron extension
-- Note: This may require enabling the extension in Supabase Dashboard
-- Go to Database → Extensions → Enable "pg_cron"
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on schema cron to postgres (required for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================
-- CRON JOB: Send SMS Reminders
-- ============================================
-- This job runs every hour and calls the send-reminders edge function
-- to send SMS reminders for appointments scheduled for tomorrow
--
-- Schedule: Every hour at minute 0 (0 * * * *)
-- ============================================

-- First, get your project details:
-- 1. Your Supabase project URL (e.g., https://xxxxx.supabase.co)
-- 2. Your service role key (from Settings → API → service_role key)
-- 3. Your edge function URL will be: https://xxxxx.supabase.co/functions/v1/send-reminders

-- Drop existing job if it exists (ignore error if it doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('send-sms-reminders');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, which is fine
    NULL;
END $$;

-- Create the cron job
-- IMPORTANT: Replace the following placeholders:
-- - YOUR_PROJECT_URL: Your Supabase project URL (e.g., https://mhtmhpaxjchzevamqlwu.supabase.co)
-- - YOUR_SERVICE_ROLE_KEY: Your service role key from Supabase Dashboard
SELECT cron.schedule(
  'send-sms-reminders',                    -- Job name
  '0 * * * *',                            -- Schedule: Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_URL.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================
-- VERIFICATION
-- ============================================

-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history (last 10 runs)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- ============================================
-- MANUAL TESTING
-- ============================================
-- To manually trigger the reminder function for testing:
-- Replace YOUR_PROJECT_URL and YOUR_SERVICE_ROLE_KEY below

/*
SELECT
  net.http_post(
    url := 'https://YOUR_PROJECT_URL.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
*/

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If the cron job doesn't work:
-- 1. Verify pg_cron extension is enabled in Supabase Dashboard
-- 2. Check that net.http_post is available (may need to enable http extension)
-- 3. Verify the service role key is correct
-- 4. Check cron job logs: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
-- 5. Test the edge function manually via curl or Supabase Dashboard
-- ============================================

