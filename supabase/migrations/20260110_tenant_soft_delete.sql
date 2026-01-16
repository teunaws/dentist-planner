-- 1. Add deleted_at column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Update RLS Policies for Tenants
-- Drop existing public read policies
-- Note: Policy names may vary, dropping common names just in case
DROP POLICY IF EXISTS "Enable read access for all users" ON tenants;
DROP POLICY IF EXISTS "Public can view tenants" ON tenants;
DROP POLICY IF EXISTS "Public Read Access" ON tenants;
DROP POLICY IF EXISTS "Anyone can accept tenants" ON tenants;

-- Recreate Public Read Policy: Users can view tenants ONLY if they are not deleted
CREATE POLICY "Public can view active tenants" ON tenants
    FOR SELECT
    USING (deleted_at IS NULL);

-- Admin/Service Role Access:
-- Admins typically use the Service Role (which bypasses RLS) or are authenticated users.
-- If utilizing a specific "Admins" table or role, ensure they have policies.
-- Assuming here that Service Role is primarily used for Admin Dashboard operations (via Edge Functions),
-- so no explicit "Admin can view all" policy is strictly required if using Service Role.
-- However, if using client-side auth for admins, we might need:
-- CREATE POLICY "Admins can view all" ON tenants FOR SELECT TO authenticated USING (true);
-- For now, limiting public access is the priority.

-- 3. Scheduled Cron Job (The Reaper)
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the nightly purge job (Runs at 3:00 AM)
-- NOTE: Replace PROJECT_REF and SERVICE_ROLE_KEY before running!
SELECT cron.schedule(
    'purge-expired-tenants',
    '0 3 * * *',
    $$
    select
        net.http_post(
            url:='https://PROJECT_REF.supabase.co/functions/v1/purge-expired-tenants',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);
