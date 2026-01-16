-- ============================================
-- EU/FHIR Migration Phase 1: Infrastructure
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Audit Logging (EHDS Compliance)
-- WORM (Write Once, Read Many) architecture
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID REFERENCES auth.users(id), -- Who performed the action
  action_type VARCHAR(20) NOT NULL, -- 'READ', 'WRITE', 'DELETE', 'EXPORT'
  resource_type VARCHAR(50) NOT NULL, -- 'Patient', 'Appointment'
  resource_id UUID NOT NULL, -- The specific record ID
  outcome VARCHAR(20) NOT NULL, -- 'SUCCESS', 'DENIED', 'FAILURE'
  ip_address INET, -- Network trace
  details JSONB -- Non-PII details
);

-- Protect Audit Logs: Prevent Updates/Deletes
CREATE POLICY "No updates on audit events" ON audit_events FOR UPDATE USING (false);
CREATE POLICY "No deletes on audit events" ON audit_events FOR DELETE USING (false);
-- Only service role or authorized procedures can insert
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- 3. Encryption Infrastructure
-- We use a dedicated schema for strict isolation of keys/functions if possible, 
-- but for simplicity in this migration we'll keep it in public but restricted.

-- Function to encrypt PII
-- Requires 'app.encryption_key' to be set in the transaction
CREATE OR REPLACE FUNCTION encrypt_pii(cleartext TEXT) 
RETURNS BYTEA AS $$
DECLARE
  key_val TEXT;
BEGIN
  key_val := current_setting('app.encryption_key', true);
  IF key_val IS NULL THEN
    RAISE EXCEPTION 'Encryption key not provided in current transaction';
  END IF;
  
  RETURN pgp_sym_encrypt(cleartext, key_val, 'aes-256-cbc');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt PII
CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA) 
RETURNS TEXT AS $$
DECLARE
  key_val TEXT;
BEGIN
  key_val := current_setting('app.encryption_key', true);
  IF key_val IS NULL THEN
    RAISE EXCEPTION 'Encryption key not provided in current transaction';
  END IF;
  
  -- pgp_sym_decrypt throws error if key is wrong, which is good security
  RETURN pgp_sym_decrypt(ciphertext, key_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FHIR Resources

-- 4.1 Patient Resource
CREATE TABLE IF NOT EXISTS fhir_patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Organization Link (Multitenancy)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Operational Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Encrypted PII Fields
  -- We store them as BYTEA (binary) because they are encrypted
  name_encrypted BYTEA NOT NULL, -- JSON structure: {family, given[]}
  telecom_encrypted BYTEA NOT NULL, -- JSON structure: [{system, value, use}]
  birth_date_encrypted BYTEA,
  address_encrypted BYTEA, -- JSON structure: {line[], city, state, postalCode}
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft Delete / Erasure support
  erased_at TIMESTAMPTZ DEFAULT NULL
);

-- 4.2 Practitioner Resource (Syncs with Providers)
-- We will migrate existing providers here or link them. 
-- For strict FHIR compliance, we create a structure.
CREATE TABLE IF NOT EXISTS fhir_practitioners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  identifier UUID, -- specific external identifier
  
  is_active BOOLEAN DEFAULT TRUE,
  
  name_encrypted BYTEA NOT NULL,
  
  -- Link to internal user system
  user_id UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.3 Appointment Resource
CREATE TABLE IF NOT EXISTS fhir_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- FHIR Status: proposed | pending | booked | arrived | fulfilled | cancelled | noshow
  status VARCHAR(20) NOT NULL,
  
  -- Participants
  patient_id UUID NOT NULL REFERENCES fhir_patients(id) ON DELETE RESTRICT,
  practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL,
  
  -- Time
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Service (HealthcareService)
  -- For now we link to the existing services table as it describes the "Type" well enough
  service_id UUID REFERENCES services(id),
  
  -- Notes (Encrypted if they contain PII)
  description_encrypted BYTEA,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_fhir_patients_tenant ON fhir_patients(tenant_id);
CREATE INDEX idx_fhir_appointments_tenant ON fhir_appointments(tenant_id);
CREATE INDEX idx_fhir_appointments_range ON fhir_appointments(start_time, end_time);
CREATE INDEX idx_fhir_appointments_patient ON fhir_appointments(patient_id);
