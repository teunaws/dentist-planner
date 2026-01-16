-- Add blind index columns for searchable encryption
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS patient_email_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS patient_phone_hash VARCHAR(64);

-- Create indices for O(1) lookups
CREATE INDEX IF NOT EXISTS idx_appointments_patient_email_hash ON appointments(patient_email_hash);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_phone_hash ON appointments(patient_phone_hash);

COMMENT ON COLUMN appointments.patient_name IS 'Encrypted (AES-GCM)';
COMMENT ON COLUMN appointments.patient_email IS 'Encrypted (AES-GCM)';
COMMENT ON COLUMN appointments.patient_phone IS 'Encrypted (AES-GCM)';
COMMENT ON COLUMN appointments.patient_email_hash IS 'Deterministic Hash (HMAC-SHA256) for search';
COMMENT ON COLUMN appointments.patient_phone_hash IS 'Deterministic Hash (HMAC-SHA256) for search';
