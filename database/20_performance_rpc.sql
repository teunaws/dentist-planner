-- ==========================================
-- Performance RPC: Lightweight Schedule Fetch
-- ==========================================
-- Fetches appointment schedule data WITHOUT encrypted PII.
-- Reduces payload size for dashboard/calendar views.

CREATE OR REPLACE FUNCTION get_tenant_schedule(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  date DATE,
  time VARCHAR,
  service_type VARCHAR,
  status VARCHAR,
  provider_id UUID,
  dentist_name VARCHAR, 
  notes TEXT -- Needed for blocked time duration parsing
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with permissions of creator (must grant execute)
SET search_path = public -- Secure search path
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.date,
    a.time,
    a.service_type,
    a.status,
    a.provider_id,
    a.dentist_name, -- Keep dentist name as it's usually public/staff info
    a.notes -- Needed for parsing duration of blocked times
  FROM
    appointments a
  WHERE
    a.tenant_id = p_tenant_id
    AND a.date >= p_start_date
    AND a.date <= p_end_date
  ORDER BY
    a.date ASC,
    a.time ASC;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION get_tenant_schedule(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_schedule(UUID, DATE, DATE) TO service_role;

-- Comment for documentation
COMMENT ON FUNCTION get_tenant_schedule IS 'Fetches lightweight schedule data (excluding PII) for a given date range.';
