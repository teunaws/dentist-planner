-- ============================================
-- Add Booking Form Columns to Appointments Table
-- ============================================
-- This migration adds columns to store booking form data
-- that was previously stored in the notes field
-- ============================================

-- Add date_of_birth column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE appointments 
    ADD COLUMN date_of_birth DATE DEFAULT NULL;
    
    RAISE NOTICE 'Added date_of_birth column to appointments table';
  ELSE
    RAISE NOTICE 'date_of_birth column already exists';
  END IF;
END $$;

-- Add home_address column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'home_address'
  ) THEN
    ALTER TABLE appointments 
    ADD COLUMN home_address TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added home_address column to appointments table';
  ELSE
    RAISE NOTICE 'home_address column already exists';
  END IF;
END $$;

-- Add insurance_provider column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'insurance_provider'
  ) THEN
    ALTER TABLE appointments 
    ADD COLUMN insurance_provider VARCHAR(255) DEFAULT NULL;
    
    RAISE NOTICE 'Added insurance_provider column to appointments table';
  ELSE
    RAISE NOTICE 'insurance_provider column already exists';
  END IF;
END $$;

-- Add emergency_contact column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE appointments 
    ADD COLUMN emergency_contact VARCHAR(255) DEFAULT NULL;
    
    RAISE NOTICE 'Added emergency_contact column to appointments table';
  ELSE
    RAISE NOTICE 'emergency_contact column already exists';
  END IF;
END $$;

-- Add reason_for_visit column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'reason_for_visit'
  ) THEN
    ALTER TABLE appointments 
    ADD COLUMN reason_for_visit TEXT DEFAULT NULL;
    
    RAISE NOTICE 'Added reason_for_visit column to appointments table';
  ELSE
    RAISE NOTICE 'reason_for_visit column already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN (
  'date_of_birth',
  'home_address',
  'insurance_provider',
  'emergency_contact',
  'reason_for_visit'
)
ORDER BY column_name;

