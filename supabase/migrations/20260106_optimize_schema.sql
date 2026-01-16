-- 1. Consolidate Durations: Ensure services have a valid duration
UPDATE services SET duration = 30 WHERE duration IS NULL;

-- 2. Deprecate appointment_durations
DROP TABLE IF EXISTS appointment_durations;

-- 3. Helper function for service duration (Moved to PUBLIC schema)
CREATE OR REPLACE FUNCTION public.get_service_duration(service_name TEXT) 
RETURNS INTEGER AS $$
  SELECT duration FROM services WHERE name = service_name LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 4. Create Availability RPC
CREATE OR REPLACE FUNCTION get_available_slots(
  p_tenant_id UUID,
  p_date DATE,
  p_service_duration INTEGER
)
RETURNS TABLE (
  slot_time TIME,
  provider_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r_provider RECORD;
  t_slot TIME;
  t_end TIME;
  v_conflict_count INTEGER;
  v_existing_duration INTEGER;
BEGIN
  -- 1. Loop through all active providers for this tenant
  FOR r_provider IN 
    SELECT p.id, ps.start_time, ps.end_time
    FROM providers p
    JOIN provider_schedules ps ON p.id = ps.provider_id
    WHERE p.tenant_id = p_tenant_id
      AND p.is_active = true
      AND ps.day_of_week = EXTRACT(DOW FROM p_date)::INTEGER
      AND ps.is_working = true
  LOOP
    -- 2. Generate 30-minute slots within their shift
    t_slot := r_provider.start_time;
    
    WHILE t_slot + (p_service_duration * interval '1 minute') <= r_provider.end_time LOOP
      t_end := t_slot + (p_service_duration * interval '1 minute');

      -- 3. Check for overlapping appointments
      -- We now calculate overlap using the new public helper function
      SELECT COUNT(*) INTO v_conflict_count
      FROM appointments a
      WHERE a.provider_id = r_provider.id
        AND a.date = p_date
        AND a.status != 'Cancelled'
        AND (
          (a.time::TIME, a.time::TIME + (public.get_service_duration(a.service_type) * interval '1 minute')) 
          OVERLAPS (t_slot, t_end)
        );

      -- 4. If no conflict, output this slot
      IF v_conflict_count = 0 THEN
        slot_time := t_slot;
        provider_id := r_provider.id;
        RETURN NEXT;
      END IF;

      -- Increment by 10 mins (standard slot size)
      t_slot := t_slot + interval '10 minutes';
    END LOOP;
  END LOOP;
  RETURN;
END;
$$;