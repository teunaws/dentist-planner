-- ============================================
-- Database Schema - Complete Table Definitions
-- ============================================
-- This file contains all CREATE TABLE statements for the application.
-- Run this file first to create the database structure.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TENANTS TABLE
-- ============================================
-- Stores dental practice information
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  hero_eyebrow TEXT,
  hero_heading TEXT,
  hero_subheading TEXT,
  operating_start_hour INTEGER DEFAULT 9,
  operating_end_hour INTEGER DEFAULT 17,
  operating_hours_per_day JSONB DEFAULT NULL, -- Per-day operating hours configuration
  theme_accent_from VARCHAR(7),
  theme_accent_to VARCHAR(7),
  booking_form_config JSONB DEFAULT NULL, -- Booking form field configuration
  is_onboarded BOOLEAN DEFAULT FALSE,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SERVICES TABLE
-- ============================================
-- Stores services/packages offered by each tenant
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- in minutes
  price VARCHAR(50) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SERVICE_PERKS TABLE
-- ============================================
-- Stores features/benefits of each service
CREATE TABLE IF NOT EXISTS service_perks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  perk_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AVAILABILITY_SLOTS TABLE
-- ============================================
-- Stores available time slots per tenant
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_slot VARCHAR(20) NOT NULL, -- e.g., "09:00 AM"
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
-- Stores patient appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID,
  patient_name VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255), -- For analytics
  patient_phone VARCHAR(50), -- For analytics
  dentist_id UUID,
  dentist_name VARCHAR(255),
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL, -- e.g., "09:30 AM"
  service_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending', -- Confirmed, Pending, Completed, Cancelled, Missed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- APPOINTMENT_DURATIONS TABLE
-- ============================================
-- Maps service types to durations for calendar display
CREATE TABLE IF NOT EXISTS appointment_durations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type VARCHAR(255) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, service_type)
);

-- ============================================
-- USERS TABLE
-- ============================================
-- Stores user authentication data
-- Note: tenant_id can be NULL (for admins or during onboarding)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'dentist', 'admin', 'patient'
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- NULL allowed
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ONBOARDING_CODES TABLE
-- ============================================
-- Stores onboarding codes for tenant setup
CREATE TABLE IF NOT EXISTS onboarding_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================
-- Create indexes for better query performance

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_name ON appointments(tenant_id, patient_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_service_type ON appointments(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_availability_slots_tenant_id ON availability_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_code ON onboarding_codes(code);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_tenant_id ON onboarding_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_is_used ON onboarding_codes(is_used);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================
-- Views for analytics dashboard

-- Patient visit history view
CREATE OR REPLACE VIEW patient_visit_history AS
SELECT 
  tenant_id,
  patient_name,
  patient_email,
  patient_phone,
  MIN(date) as first_visit_date,
  MAX(date) as last_visit_date,
  COUNT(*) as total_visits,
  MAX(CASE WHEN service_type ILIKE '%hygiene%' OR service_type ILIKE '%checkup%' OR service_type ILIKE '%clean%' THEN date END) as last_hygiene_visit
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, patient_name, patient_email, patient_phone;

-- Monthly patient statistics view
CREATE OR REPLACE VIEW monthly_patient_stats AS
SELECT 
  tenant_id,
  DATE_TRUNC('month', date) as month,
  COUNT(DISTINCT patient_name) FILTER (WHERE is_first_visit) as new_patients,
  COUNT(DISTINCT patient_name) FILTER (WHERE NOT is_first_visit) as returning_patients
FROM (
  SELECT 
    a.tenant_id,
    a.date,
    a.patient_name,
    ROW_NUMBER() OVER (PARTITION BY a.tenant_id, a.patient_name ORDER BY a.date) = 1 as is_first_visit
  FROM appointments a
  WHERE a.status IN ('Completed', 'Confirmed')
) subq
GROUP BY tenant_id, DATE_TRUNC('month', date);

-- Treatment distribution view
CREATE OR REPLACE VIEW treatment_distribution AS
SELECT 
  tenant_id,
  service_type as treatment_type,
  COUNT(*) as appointment_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY tenant_id) as percentage
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, service_type;

