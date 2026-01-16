-- 1. Rate Limits Table (For DoS Protection)
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_address TEXT,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  last_request_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ip_address, endpoint)
);

-- 2. Access Logs Table (For HIPAA/GDPR Compliance)
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  resource_type TEXT NOT NULL, -- e.g., 'appointment'
  resource_id UUID NOT NULL,
  action TEXT NOT NULL, -- e.g., 'decrypt_view'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Secure the logs (Append-only)
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view logs
CREATE POLICY "Admins view logs" ON access_logs 
  FOR SELECT 
  TO authenticated 
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policy: No one can update or delete logs (Immutable)
-- (No UPDATE/DELETE policies created implies denial by default)
