-- ============================================
-- Add Missing Columns Migration
-- ============================================
-- This migration adds any missing columns that may not exist
-- in databases that were created before these columns were added
-- ============================================

-- Add booking_form_config column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'booking_form_config'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN booking_form_config JSONB DEFAULT NULL;
    
    RAISE NOTICE 'Added booking_form_config column to tenants table';
  ELSE
    RAISE NOTICE 'booking_form_config column already exists';
  END IF;
END $$;

-- Add practice details columns if they don't exist
DO $$ 
BEGIN
  -- Address
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN address TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added address column to tenants table';
  ELSE
    RAISE NOTICE 'address column already exists';
  END IF;

  -- Timezone
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN timezone VARCHAR(100) DEFAULT 'America/New_York';
    
    RAISE NOTICE 'Added timezone column to tenants table';
  ELSE
    RAISE NOTICE 'timezone column already exists';
  END IF;

  -- Phone
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN phone VARCHAR(50) DEFAULT NULL;
    
    RAISE NOTICE 'Added phone column to tenants table';
  ELSE
    RAISE NOTICE 'phone column already exists';
  END IF;

  -- Email
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email VARCHAR(255) DEFAULT NULL;
    
    RAISE NOTICE 'Added email column to tenants table';
  ELSE
    RAISE NOTICE 'email column already exists';
  END IF;
END $$;

-- Add email configuration columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_sender_name'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_sender_name VARCHAR(255) DEFAULT NULL;
    
    RAISE NOTICE 'Added email_sender_name column to tenants table';
  ELSE
    RAISE NOTICE 'email_sender_name column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_sender_local_part'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_sender_local_part VARCHAR(255) DEFAULT 'bookings';
    
    RAISE NOTICE 'Added email_sender_local_part column to tenants table';
  ELSE
    RAISE NOTICE 'email_sender_local_part column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_reply_to'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_reply_to VARCHAR(255) DEFAULT NULL;
    
    RAISE NOTICE 'Added email_reply_to column to tenants table';
  ELSE
    RAISE NOTICE 'email_reply_to column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_confirmation_subject'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_confirmation_subject TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added email_confirmation_subject column to tenants table';
  ELSE
    RAISE NOTICE 'email_confirmation_subject column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'email_confirmation_body'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN email_confirmation_body TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added email_confirmation_body column to tenants table';
  ELSE
    RAISE NOTICE 'email_confirmation_body column already exists';
  END IF;
END $$;

-- Add SMS configuration columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'sms_confirmation_enabled'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN sms_confirmation_enabled BOOLEAN DEFAULT FALSE;
    
    RAISE NOTICE 'Added sms_confirmation_enabled column to tenants table';
  ELSE
    RAISE NOTICE 'sms_confirmation_enabled column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'sms_confirmation_template'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN sms_confirmation_template TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added sms_confirmation_template column to tenants table';
  ELSE
    RAISE NOTICE 'sms_confirmation_template column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'sms_reminder_enabled'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN sms_reminder_enabled BOOLEAN DEFAULT FALSE;
    
    RAISE NOTICE 'Added sms_reminder_enabled column to tenants table';
  ELSE
    RAISE NOTICE 'sms_reminder_enabled column already exists';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'sms_reminder_template'
  ) THEN
    ALTER TABLE tenants 
    ADD COLUMN sms_reminder_template TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added sms_reminder_template column to tenants table';
  ELSE
    RAISE NOTICE 'sms_reminder_template column already exists';
  END IF;
END $$;

-- Verify all columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN (
  'booking_form_config', 
  'address', 
  'timezone', 
  'phone', 
  'email',
  'email_sender_name',
  'email_sender_local_part',
  'email_reply_to',
  'email_confirmation_subject',
  'email_confirmation_body',
  'sms_confirmation_enabled',
  'sms_confirmation_template',
  'sms_reminder_enabled',
  'sms_reminder_template'
)
ORDER BY column_name;

