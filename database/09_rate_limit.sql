-- ============================================
-- Rate Limiting Table
-- ============================================
-- This table stores rate limit information for API endpoints
-- Used to prevent abuse of public endpoints (e.g., contact-sales)
-- ============================================

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  last_request TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Composite unique constraint: one record per IP + endpoint combination
  UNIQUE(ip, endpoint)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_request ON rate_limits(last_request);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_rate_limits_updated_at 
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public can INSERT (for rate limiting checks)
-- This allows Edge Functions to create/update rate limit records
CREATE POLICY "Public can insert rate limits"
  ON public.rate_limits FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy 2: Public can SELECT (for rate limiting checks)
-- Edge Functions need to read rate limit records
CREATE POLICY "Public can select rate limits"
  ON public.rate_limits FOR SELECT
  TO public
  USING (true);

-- Policy 3: Public can UPDATE (for incrementing count)
-- Edge Functions need to update count and last_request
CREATE POLICY "Public can update rate limits"
  ON public.rate_limits FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Policy 4: Admin Full Access
-- FIXED: Wrapped auth.jwt() in (select ...) for per-query evaluation
-- NOTE: Public policies already cover SELECT/INSERT/UPDATE, so this is redundant but kept for admin-specific logic
CREATE POLICY "Admins can manage all rate limits"
  ON public.rate_limits FOR ALL
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- CLEANUP FUNCTION (Optional)
-- ============================================
-- Function to clean up old rate limit records (older than 24 hours)
-- Can be called periodically via cron job or manually
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE last_request < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits() TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits() TO service_role;

-- ============================================
-- NOTES
-- ============================================
-- 
-- Usage in Edge Functions:
-- 1. Extract client IP from request headers
-- 2. Check if rate limit exists for IP + endpoint
-- 3. If exists and count > limit and within time window: return 429
-- 4. Otherwise: upsert (increment count or create new record)
--
-- Rate Limit Logic:
-- - Max 5 requests per hour per IP per endpoint
-- - Time window: 3600000 milliseconds (1 hour)
-- - Records older than 24 hours can be cleaned up
--
-- ============================================

