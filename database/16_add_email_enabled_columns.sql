-- ============================================
-- Add Email Enabled Boolean Columns Migration
-- ============================================
-- Adds boolean columns to control email confirmation and reminder sending
-- These columns allow the frontend to save and persist email toggle states
-- ============================================

-- Add email_confirmation_enabled column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_confirmation_enabled'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_confirmation_enabled BOOLEAN DEFAULT TRUE;
    
    -- Set default value for existing tenants (default to TRUE for backward compatibility)
    UPDATE tenants
    SET email_confirmation_enabled = COALESCE(email_confirmation_enabled, TRUE)
    WHERE email_confirmation_enabled IS NULL;
    
    RAISE NOTICE 'Added email_confirmation_enabled column to tenants table';
  ELSE
    RAISE NOTICE 'email_confirmation_enabled column already exists';
  END IF;
END $$;

-- Add email_reminder_enabled column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_reminder_enabled'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_reminder_enabled BOOLEAN DEFAULT FALSE;
    
    -- Set default value for existing tenants (default to FALSE)
    UPDATE tenants
    SET email_reminder_enabled = COALESCE(email_reminder_enabled, FALSE)
    WHERE email_reminder_enabled IS NULL;
    
    RAISE NOTICE 'Added email_reminder_enabled column to tenants table';
  ELSE
    RAISE NOTICE 'email_reminder_enabled column already exists';
  END IF;
END $$;

-- Add email_reminder_body column if it doesn't exist (for reminder emails)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_reminder_body'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_reminder_body TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added email_reminder_body column to tenants table';
  ELSE
    RAISE NOTICE 'email_reminder_body column already exists';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.email_confirmation_enabled IS 'Whether to send email confirmation when appointment is booked (default: TRUE)';
COMMENT ON COLUMN public.tenants.email_reminder_enabled IS 'Whether to send email reminders 24 hours before appointments (default: FALSE)';
COMMENT ON COLUMN public.tenants.email_reminder_body IS 'Email body template for reminder emails with {{variables}} support (Markdown or HTML)';

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN (
  'email_confirmation_enabled',
  'email_reminder_enabled',
  'email_reminder_body'
)
ORDER BY column_name;

-- Note: RLS policies already allow tenants to update their own records
-- The existing policies in 03_rls_policies.sql handle UPDATE permissions
-- These new columns will automatically be included in UPDATE operations

