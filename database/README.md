# Database Setup Instructions

## Overview

This directory contains the canonical database setup files. All temporary "fix" files have been consolidated into these 4 files.

## Setup Order

**⚠️ CRITICAL: If your database is currently broken due to RLS recursion, run `00_reset_policies.sql` FIRST to unblock it.**

Run these files in order in your Supabase SQL Editor:

0. **00_reset_policies.sql** - (CRITICAL if database is broken) Dynamically drops ALL existing RLS policies
1. **01_schema.sql** - Creates all tables, indexes, and views
2. **02_functions_and_triggers.sql** - Creates all functions and triggers
3. **03_rls_policies.sql** - Creates all Row Level Security policies (non-recursive, JWT-based)
4. **04_seed_data.sql** - (Optional) Inserts sample data for development

## Files

### 00_reset_policies.sql
- **SCORCHED EARTH FIX**: Dynamically finds and drops ALL RLS policies on critical tables
- Uses PL/PGSQL to loop through `pg_policies` and drop everything
- Fixes "Policy Name Mismatch" issues by not relying on exact policy names
- **Run this FIRST if your database is timing out due to RLS recursion**

### 01_schema.sql
- All CREATE TABLE statements
- All indexes for performance
- Analytics views (patient_visit_history, monthly_patient_stats, treatment_distribution)
- Includes all columns from migrations (operating_hours_per_day, booking_form_config, is_onboarded, etc.)

### 02_functions_and_triggers.sql
- `update_updated_at_column()` - Auto-updates timestamps
- `handle_new_user()` - SECURITY DEFINER function that syncs auth.users to public.users
- `on_auth_user_created` trigger - Automatically creates public.users records
- `complete_onboarding()` - SECURITY DEFINER function for onboarding flow
- `sync_user_role_to_jwt()` - Syncs roles to JWT metadata

### 03_rls_policies.sql
- **CRITICAL**: All policies use JWT metadata checks (auth.jwt()) instead of database queries
- This prevents infinite recursion that would lock up the database
- Public read policies use `USING (true)` - no checks
- Admin policies use JWT role checks - no database queries
- Self-access policies use `auth.uid()` - safe, no recursion

### 04_seed_data.sql
- Sample tenants (lumina, soho-smiles)
- Sample services and perks
- Sample availability slots
- Sample appointments
- Demo users (dentist, admin)

## Important Notes

### RLS Policies
- All admin checks use `auth.jwt() -> 'user_metadata' ->> 'role'` (JWT metadata, NO database queries)
- This prevents infinite recursion by avoiding database queries
- Public read policies use `USING (true)` - absolutely no checks
- Self-access policies use `auth.uid() = id` - safe, no recursion
- After running the setup, users may need to log out and log back in to refresh JWT tokens
- Run `sync_user_role_to_jwt()` to sync existing users' roles to JWT metadata

### SECURITY DEFINER Functions
- `handle_new_user()` and `complete_onboarding()` use SECURITY DEFINER
- This allows them to bypass RLS policies when creating users
- This is safe because they only create users from trusted sources (auth.users)

### Database Restart
- If you experience timeouts after applying RLS policies, restart your Supabase database
- Go to Settings -> Infrastructure -> Restart
- This clears any "zombie" connections from previous recursion issues

## Environment Variables

Make sure your `.env` file contains:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Production Considerations

1. **Password Hashing**: The seed data includes demo password hashes. In production, use Supabase Auth or proper bcrypt hashing.

2. **RLS Policies**: All policies are configured. Test thoroughly before deploying to production.

3. **JWT Metadata**: Ensure roles are set in `auth.users.raw_user_meta_data` during signup/login.

4. **Backup**: Always backup your database before running schema changes in production.
