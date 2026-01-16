-- RLS Security & Performance Hardening

-- 1. Add performance index for tenant_id lookups (Critical for RLS)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);

-- 2. Optimize "Dentists view their tenant appointments" policy
-- OLD: May have used joins or inefficient checks
-- NEW: Uses JWT metadata directly to avoid joins and prevent recursion

DROP POLICY IF EXISTS "Dentists view their tenant appointments" ON appointments;

CREATE POLICY "Dentists view their tenant appointments"
ON appointments FOR SELECT
USING (
  -- Cast JWT metadata to UUID and compare directly
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- Note: Ensure that the 'admin' or 'service_role' users still have access via other policies
-- or are bypassing RLS.
