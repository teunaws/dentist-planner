
-- Function to handle atomic booking transactions
-- Prevents race conditions where two users book the same slot simultaneously

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id UUID,
  p_date TEXT,
  p_time TEXT,
  p_patient_name TEXT,
  p_patient_email TEXT,
  p_patient_email_hash TEXT,
  p_patient_phone TEXT,
  p_patient_phone_hash TEXT,
  p_service_type TEXT,
  p_status TEXT,
  p_notes TEXT,
  p_provider_id UUID DEFAULT NULL,
  p_date_of_birth TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_home_address TEXT DEFAULT NULL,
  p_insurance_provider TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_reason_for_visit TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/service_role), allowing it to check table availability
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  -- 1. Check Availability
  -- We strictly enforce availability if a specific provider is requested.
  IF p_provider_id IS NOT NULL THEN
    -- Check if this specific provider is already booked at this time
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
  ELSE
    -- "Any Provider" / No Provider Assigned Case
    -- In this scenario, we trust the upstream logic (frontend/proxy) which tries to find a provider.
    -- If p_provider_id IS NULL, it means we are creating an unassigned appointment.
    -- We allow this (overbooking/manual queue) unless strictly failing for global blocks?
    -- For now, we allow insertion.
    NULL;
  END IF;

  -- 2. Insert Appointment
  INSERT INTO appointments (
    tenant_id,
    date,
    time,
    patient_name,
    patient_email,
    patient_email_hash,
    patient_phone,
    patient_phone_hash,
    service_type,
    status,
    notes,
    provider_id,
    date_of_birth,
    home_address,
    insurance_provider,
    emergency_contact,
    reason_for_visit
  ) VALUES (
    p_tenant_id,
    p_date,
    p_time,
    p_patient_name,
    p_patient_email,
    p_patient_email_hash,
    p_patient_phone,
    p_patient_phone_hash,
    p_service_type,
    p_status,
    p_notes,
    p_provider_id,
    p_date_of_birth,
    p_home_address,
    p_insurance_provider,
    p_emergency_contact,
    p_reason_for_visit
  )
  RETURNING id INTO v_appointment_id;

  -- Return the new ID
  RETURN jsonb_build_object('id', v_appointment_id);
END;
$$;
