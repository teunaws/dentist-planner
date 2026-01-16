-- ============================================
-- Multi-Provider Scheduling System
-- ============================================
-- This migration introduces:
-- 1. Providers table (employees/staff)
-- 2. Provider-Services junction table (capabilities)
-- 3. Provider-Schedules table (individual schedules)
-- 4. Updates appointments table to support provider assignment
-- ============================================

-- ============================================
-- PROVIDERS TABLE
-- ============================================
-- Stores employee/provider information for each tenant
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color for calendar UI
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional: if employee has login
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROVIDER_SERVICES TABLE (Junction Table)
-- ============================================
-- Defines which services each provider can perform (capabilities)
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (provider_id, service_id)
);

-- ============================================
-- PROVIDER_SCHEDULES TABLE
-- ============================================
-- Individual provider schedules (overrides tenant hours)
CREATE TABLE IF NOT EXISTS provider_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_working BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider_id, day_of_week)
);

-- ============================================
-- UPDATE APPOINTMENTS TABLE
-- ============================================
-- Add provider_id column (nullable for backward compatibility)
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_providers_tenant_id ON providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_service_id ON provider_services(service_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_provider_id ON provider_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_day ON provider_schedules(provider_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_date ON appointments(provider_id, date, time);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROVIDERS TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (required for availability calculation)
CREATE POLICY "Enable Public Read Access"
  ON public.providers FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all providers"
  ON public.providers FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- PROVIDER_SERVICES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (required for availability calculation)
CREATE POLICY "Enable Public Read Access"
  ON public.provider_services FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all provider services"
  ON public.provider_services FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- PROVIDER_SCHEDULES TABLE POLICIES
-- ============================================

-- Policy 1: Public Read (required for availability calculation)
CREATE POLICY "Enable Public Read Access"
  ON public.provider_schedules FOR SELECT
  TO public
  USING (true);

-- Policy 2: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public read policy already covers SELECT, so this only affects INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all provider schedules"
  ON public.provider_schedules FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- NOTES
-- ============================================
-- 1. provider_id in appointments is nullable for backward compatibility
-- 2. All new tables have public read access for availability calculations
-- 3. Only admins can write to provider-related tables
-- 4. Providers can optionally be linked to users via user_id
-- 5. Provider schedules override tenant-level operating hours
-- ============================================

