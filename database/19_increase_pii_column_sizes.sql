-- Migration to increase column sizes for PII fields
-- Includes DROP/CREATE of dependent views to handle type changes.

DO $$ 
BEGIN
    -- 1. Drop dependent views
    DROP VIEW IF EXISTS monthly_patient_stats;
    DROP VIEW IF EXISTS patient_visit_history;

    -- 2. Alter appointments table columns to TEXT
    ALTER TABLE appointments ALTER COLUMN patient_name TYPE TEXT;
    ALTER TABLE appointments ALTER COLUMN patient_email TYPE TEXT;
    ALTER TABLE appointments ALTER COLUMN patient_phone TYPE TEXT;

    -- Update comments
    COMMENT ON COLUMN appointments.patient_name IS 'Encrypted PII (patient name)';
    COMMENT ON COLUMN appointments.patient_email IS 'Encrypted PII (patient email). See patient_email_hash for search.';
    COMMENT ON COLUMN appointments.patient_phone IS 'Encrypted PII (patient phone). See patient_phone_hash for search.';
END $$;

-- 3. Re-create views
-- Patient visit history view
CREATE OR REPLACE VIEW patient_visit_history AS
SELECT 
  tenant_id,
  patient_name,
  patient_email,
  patient_phone,
  MIN(date) as first_visit_date,
  MAX(date) as last_visit_date,
  COUNT(*) as total_visits,
  MAX(CASE WHEN service_type ILIKE '%hygiene%' OR service_type ILIKE '%checkup%' OR service_type ILIKE '%clean%' THEN date END) as last_hygiene_visit
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, patient_name, patient_email, patient_phone;

-- Monthly patient statistics view
CREATE OR REPLACE VIEW monthly_patient_stats AS
SELECT 
  tenant_id,
  DATE_TRUNC('month', date) as month,
  COUNT(DISTINCT patient_name) FILTER (WHERE is_first_visit) as new_patients,
  COUNT(DISTINCT patient_name) FILTER (WHERE NOT is_first_visit) as returning_patients
FROM (
  SELECT 
    a.tenant_id,
    a.date,
    a.patient_name,
    ROW_NUMBER() OVER (PARTITION BY a.tenant_id, a.patient_name ORDER BY a.date) = 1 as is_first_visit
  FROM appointments a
  WHERE a.status IN ('Completed', 'Confirmed')
) subq
GROUP BY tenant_id, DATE_TRUNC('month', date);
