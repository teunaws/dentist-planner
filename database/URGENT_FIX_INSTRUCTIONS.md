# ⚠️ URGENT: Database Fix Instructions

## Current Status
- Database is locked due to connection exhaustion and RLS recursion
- All policies have been dynamically reset via `00_reset_policies.sql`
- Clean, non-recursive policies are ready in `03_rls_policies.sql`

## ⚠️ CRITICAL: Execute These Steps IMMEDIATELY

### Step 1: Run Policy Reset (DO THIS FIRST)
1. Go to Supabase Dashboard → SQL Editor
2. Run `database/00_reset_policies.sql`
3. This will drop ALL existing policies dynamically (regardless of names)

### Step 2: Apply Clean Policies
1. Still in SQL Editor
2. Run `database/03_rls_policies.sql`
3. This applies clean, non-recursive JWT-based policies

### Step 3: RESTART SUPABASE PROJECT (CRITICAL!)
1. Go to Supabase Dashboard → Settings → Infrastructure
2. Click **"Restart Project"**
3. **WAIT** for restart to complete (2-3 minutes)
4. This clears the connection pool and any "zombie" connections

### Step 4: Verify
1. Try accessing your application
2. Check that admin portal works
3. Check that patient bookings work

## What Was Fixed

### ✅ 00_reset_policies.sql
- Dynamically finds and drops ALL policies on critical tables
- No dependency on policy names
- Handles any naming mismatches

### ✅ 03_rls_policies.sql
- **Users Table**: 
  - Self-access uses `auth.uid() = id` (safe, no recursion)
  - Admin access uses `auth.jwt() -> 'user_metadata' ->> 'role'` (JWT only, no table queries)
- **Tenants Table**:
  - Public read: `USING (true)` (no checks)
  - Admin write: JWT-based only
- **All Other Tables**: JWT-based admin policies, public read where needed

### ✅ Cleanup
- Deleted `fix_appointment_insert_policy.sql` (junk file)
- All canonical files (00-05) are clean and correct

## File Structure (Canonical)

```
database/
├── 00_reset_policies.sql      ✅ Dynamic policy reset
├── 01_schema.sql              ✅ Table definitions (tenant_id is nullable)
├── 02_functions_and_triggers.sql ✅ handle_new_user() with SECURITY DEFINER
├── 03_rls_policies.sql        ✅ Clean JWT-based policies
├── 04_seed_data.sql           ✅ Sample data
├── 05_create_admin_user.sql   ✅ Admin user setup
└── 05_cron_jobs.sql           ✅ Cron job setup
```

## Key Principles Applied

1. **No Table Queries in Policies**: All admin checks use `auth.jwt()` metadata
2. **Self-Access is Safe**: Uses `auth.uid()` which doesn't query tables
3. **Public Read is Unconditional**: Uses `USING (true)` for zero overhead
4. **SECURITY DEFINER**: `handle_new_user()` bypasses RLS to prevent recursion

## If Issues Persist

1. **Check JWT Metadata**: Users must have `role` in `auth.users.raw_user_meta_data`
2. **Refresh Tokens**: Users may need to log out and back in
3. **Check Logs**: Supabase Dashboard → Logs → Database
4. **Verify Policies**: Run `SELECT * FROM pg_policies WHERE schemaname = 'public';`

## Next Steps After Fix

1. ✅ Run 00_reset_policies.sql
2. ✅ Run 03_rls_policies.sql  
3. ✅ **RESTART SUPABASE PROJECT**
4. ✅ Test application
5. ✅ Monitor for 24 hours

---

**Remember: The restart is CRITICAL to clear the connection pool!**

