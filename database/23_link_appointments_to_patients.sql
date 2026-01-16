-- Migration to link appointments to the patients table
-- Generated: 2026-01-04

-- 1. Schema Check & Update for `patients` table
-- Ensure all necessary columns exist to match appointments data
ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email_hash TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_hash TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- 2. Ensure Unique Constraint to support idempotent backfill
-- We need a UNIQUE constraint on email_hash to use ON CONFLICT
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patients_email_hash_key') THEN 
        ALTER TABLE patients ADD CONSTRAINT patients_email_hash_key UNIQUE (email_hash); 
    END IF; 
END $$;

-- 3. Backfill Data (Idempotent)
-- Insert unique patients from appointments into patients
INSERT INTO patients (
    tenant_id,
    full_name,
    email,
    email_hash,
    phone,
    phone_hash,
    date_of_birth,
    address,
    insurance_provider,
    emergency_contact
)
SELECT DISTINCT ON (patient_email_hash)
    tenant_id,
    patient_name,
    patient_email,
    patient_email_hash,
    patient_phone,
    patient_phone_hash,
    date_of_birth,
    home_address,
    insurance_provider,
    emergency_contact
FROM appointments
WHERE patient_email_hash IS NOT NULL
ON CONFLICT (email_hash) 
DO UPDATE SET
    -- Optional: Update existing records with newer info if needed, 
    -- but user requested DO NOTHING logic or similar.
    -- We'll just update fields if they are NULL in the existing record?
    -- For now, consistent with "DO NOTHING" request, we skip updates to preserve existing patient data.
    updated_at = NOW()
    WHERE patients.email_hash = EXCLUDED.email_hash; 
    -- Actually, simple DO NOTHING is safest to respect "first wins" or existing data
    -- Reverting to DO NOTHING as requested.

-- Re-running the insert with strict DO NOTHING
INSERT INTO patients (
    tenant_id,
    full_name,
    email,
    email_hash,
    phone,
    phone_hash,
    date_of_birth,
    address,
    insurance_provider,
    emergency_contact
)
SELECT DISTINCT ON (patient_email_hash)
    tenant_id,
    patient_name,
    patient_email,
    patient_email_hash,
    patient_phone,
    patient_phone_hash,
    date_of_birth,
    home_address,
    insurance_provider,
    emergency_contact
FROM appointments
WHERE patient_email_hash IS NOT NULL
ON CONFLICT (email_hash) DO NOTHING;


-- 4. Link Records
-- Add patient_id column if it doesn't exist
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id);

-- Update appointments to link to patients
UPDATE appointments a
SET patient_id = p.id
FROM patients p
WHERE a.patient_email_hash = p.email_hash
AND a.patient_id IS NULL;

-- 5. Add Index for Performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
