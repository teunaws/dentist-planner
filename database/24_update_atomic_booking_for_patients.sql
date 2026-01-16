-- Migration to update atomic booking for linked patients
-- Generated: 2026-01-04

-- 1. Make legacy PII columns nullable in appointments
-- This ensures we can insert records without these fields
ALTER TABLE appointments ALTER COLUMN patient_name DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN patient_email DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN patient_phone DROP NOT NULL;

-- 2. Drop the old RPC (Signature change)
-- We perform a precise DROP to avoid potential ambiguity issues
DROP FUNCTION IF EXISTS book_appointment_atomic(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT, TEXT
);

-- 3. Create NEW book_appointment_atomic
-- Accepts p_patient_id and omits p_patient_name, etc.
-- Keeps p_reason_for_visit as it is appointment-specific data
CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id UUID,
  p_date TEXT,
  p_time TEXT,
  p_patient_id UUID,          -- NEW: Link to patient
  p_service_type TEXT,
  p_status TEXT,
  p_notes TEXT,
  p_provider_id UUID DEFAULT NULL,
  p_reason_for_visit TEXT DEFAULT NULL -- Kept as appointment metadata
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  -- 1. Check Availability
  IF p_provider_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE tenant_id = p_tenant_id
      AND date = p_date
      AND time = p_time
      AND provider_id = p_provider_id
      AND status != 'Cancelled';
      
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Time slot is no longer available' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 2. Insert Appointment
  -- Linked to patient, with legacy PII columns explicitly OMITTED (NULL)
  INSERT INTO appointments (
    tenant_id,
    date,
    time,
    patient_id,      -- Linked
    service_type,
    status,
    notes,
    provider_id,
    reason_for_visit
    -- patient_name/email/phone/hashes etc implicitly NULL
  ) VALUES (
    p_tenant_id,
    p_date,
    p_time,
    p_patient_id,    -- Linked
    p_service_type,
    p_status,
    p_notes,
    p_provider_id,
    p_reason_for_visit
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object('id', v_appointment_id);
END;
$$;
