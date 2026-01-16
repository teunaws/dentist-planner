-- 1. Add deleted_at column
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Update RLS Policies for Appointments (Soft Delete Filter)
-- Drop existing policies that might conflict or be too broad
DROP POLICY IF EXISTS "Users can view their tenant's appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert appointments for their tenant" ON appointments;
DROP POLICY IF EXISTS "Users can update their tenant's appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their tenant's appointments" ON appointments;

-- Re-create policies with deleted_at check
CREATE POLICY "Users can view their tenant's appointments" ON appointments
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );

CREATE POLICY "Users can insert appointments for their tenant" ON appointments
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their tenant's appointments" ON appointments
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- Allow "delete" (which is now update deleted_at)
-- But also keep actual DELETE permission just in case admins need it, 
-- though the app will use UPDATE.
CREATE POLICY "Users can delete their tenant's appointments" ON appointments
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );


-- 3. Update RLS Policies for Patients (Soft Delete Filter)
DROP POLICY IF EXISTS "Users can view their tenant's patients" ON patients;
DROP POLICY IF EXISTS "Users can insert patients for their tenant" ON patients;
DROP POLICY IF EXISTS "Users can update their tenant's patients" ON patients;
-- Note: Patients might need less strict RLS updates if we only read them by ID, 
-- but filtering list views is good practice.

CREATE POLICY "Users can view their tenant's patients" ON patients
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );

CREATE POLICY "Users can insert patients for their tenant" ON patients
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their tenant's patients" ON patients
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );
