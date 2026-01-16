-- ============================================
-- Migration: Remove Stripe-related columns
-- ============================================
-- This migration removes any Stripe-related columns from the tenants table
-- if they were previously added for subscription management.
-- ============================================

-- Remove stripe_account_id column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE tenants DROP COLUMN stripe_account_id;
    RAISE NOTICE 'Dropped column stripe_account_id from tenants table';
  END IF;
END $$;

-- Remove subscription_status column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE tenants DROP COLUMN subscription_status;
    RAISE NOTICE 'Dropped column subscription_status from tenants table';
  END IF;
END $$;

-- Remove stripe_customer_id column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE tenants DROP COLUMN stripe_customer_id;
    RAISE NOTICE 'Dropped column stripe_customer_id from tenants table';
  END IF;
END $$;

-- Remove stripe_subscription_id column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE tenants DROP COLUMN stripe_subscription_id;
    RAISE NOTICE 'Dropped column stripe_subscription_id from tenants table';
  END IF;
END $$;

-- Note: This migration is idempotent - it can be run multiple times safely
-- It only removes columns if they exist, so it won't fail if columns were never added


