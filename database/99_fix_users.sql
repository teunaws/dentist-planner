-- 99_fix_users.sql
-- Backfill missing user profiles from auth.users into public.users
-- This fixes the 406 "Not Acceptable" error when users try to log in

-- Insert missing users from Auth into Public
-- Only inserts users that don't already exist in public.users
-- FIXED: Validates tenant_id exists in tenants table before using it
INSERT INTO public.users (
    id, 
    email, 
    role, 
    tenant_id, 
    password_hash,
    name,
    created_at,
    updated_at
)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'role', 'patient')::text, 
    CASE 
        -- Only use tenant_id if it exists in the tenants table
        WHEN au.raw_user_meta_data->>'tenant_id' IS NOT NULL 
             AND EXISTS (
                 SELECT 1 FROM public.tenants t 
                 WHERE t.id = (au.raw_user_meta_data->>'tenant_id')::uuid
             )
        THEN (au.raw_user_meta_data->>'tenant_id')::uuid
        ELSE NULL  -- Set to NULL if tenant doesn't exist (schema allows NULL)
    END,
    '', -- password_hash is managed by Supabase Auth, so we use empty string
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', au.email)::text,
    au.created_at,
    NOW()
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Log how many users were inserted
DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled % missing user profiles', inserted_count;
END $$;

