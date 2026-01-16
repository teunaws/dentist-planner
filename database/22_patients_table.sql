CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  email_hash TEXT,
  phone TEXT,
  phone_hash TEXT,
  date_of_birth DATE,
  address TEXT,
  insurance_provider TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster lookups (critical for the booking function)
CREATE INDEX IF NOT EXISTS idx_patients_email_hash ON patients(email_hash);
CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash);
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);