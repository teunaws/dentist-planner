-- Analytics Seed Data
-- This script populates historical appointment data for analytics
-- Run this AFTER running the main seed.sql to add analytics data

-- Insert historical appointments for Lumina tenant (past 12 months)
-- This creates realistic data for analytics visualization

-- Get Lumina tenant ID
DO $$
DECLARE
  lumina_tenant_id UUID;
  soho_tenant_id UUID;
  appointment_date DATE;
  patient_names TEXT[] := ARRAY[
    'Maya Patel', 'Noah Reed', 'Layla Kim', 'Evan Brooks', 'Sarah Johnson',
    'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Jessica Martinez', 'Robert Taylor',
    'Amanda White', 'James Brown', 'Olivia Davis', 'William Wilson', 'Sophia Moore',
    'Daniel Anderson', 'Isabella Thomas', 'Matthew Jackson', 'Emma White', 'Christopher Harris'
  ];
  -- Service types will be fetched from the services table for each tenant
  lumina_service_types TEXT[];
  soho_service_types TEXT[];
  patient_name TEXT;
  service_type TEXT;
  status TEXT;
  time_slot TEXT;
  i INTEGER;
  months_back INTEGER;
  days_in_month INTEGER;
  random_day INTEGER;
BEGIN
  -- Get tenant IDs
  SELECT id INTO lumina_tenant_id FROM tenants WHERE slug = 'lumina';
  SELECT id INTO soho_tenant_id FROM tenants WHERE slug = 'soho-smiles';

  -- Generate appointments for Lumina (past 12 months)
  IF lumina_tenant_id IS NOT NULL THEN
    -- Get actual service names from services table for Lumina
    SELECT ARRAY_AGG(name ORDER BY display_order) INTO lumina_service_types
    FROM services
    WHERE tenant_id = lumina_tenant_id;
    
    -- If no services found, skip this tenant
    IF lumina_service_types IS NULL OR array_length(lumina_service_types, 1) = 0 THEN
      RAISE NOTICE 'No services found for Lumina tenant';
    ELSE
      -- Generate appointments for each of the last 12 months
      FOR months_back IN 0..11 LOOP
        appointment_date := DATE_TRUNC('month', CURRENT_DATE - (months_back || ' months')::INTERVAL)::DATE;
        days_in_month := EXTRACT(DAY FROM (appointment_date + INTERVAL '1 month - 1 day'));
        
        -- Generate 15-25 appointments per month
        FOR i IN 1..(15 + (months_back % 10)) LOOP
          random_day := 1 + (i * 2) % days_in_month;
          appointment_date := DATE_TRUNC('month', CURRENT_DATE - (months_back || ' months')::INTERVAL)::DATE + (random_day - 1);
          
          -- Skip future dates
          IF appointment_date > CURRENT_DATE THEN
            CONTINUE;
          END IF;
          
          patient_name := patient_names[1 + (i + months_back * 3) % array_length(patient_names, 1)];
          service_type := lumina_service_types[1 + (i * 3) % array_length(lumina_service_types, 1)];
          
          -- Status distribution: 70% Completed, 15% Confirmed (future), 10% Missed, 5% Cancelled
          IF appointment_date < CURRENT_DATE THEN
            CASE (i % 10)
              WHEN 0 THEN status := 'Missed';
              WHEN 1 THEN status := 'Cancelled';
              ELSE status := 'Completed';
            END CASE;
          ELSE
            status := 'Confirmed';
          END IF;
          
          CASE (i % 6)
            WHEN 0 THEN time_slot := '08:00 AM';
            WHEN 1 THEN time_slot := '09:30 AM';
            WHEN 2 THEN time_slot := '11:00 AM';
            WHEN 3 THEN time_slot := '01:00 PM';
            WHEN 4 THEN time_slot := '02:30 PM';
            ELSE time_slot := '04:00 PM';
          END CASE;
          
          INSERT INTO appointments (
            tenant_id,
            patient_name,
            patient_email,
            patient_phone,
            date,
            time,
            service_type,
            status,
            notes,
            created_at
          ) VALUES (
            lumina_tenant_id,
            patient_name,
            LOWER(REPLACE(patient_name, ' ', '.')) || '@example.com',
            '(555) ' || LPAD((100 + i)::TEXT, 3, '0') || '-' || LPAD((1000 + i * 11)::TEXT, 4, '0'),
            appointment_date,
            time_slot,
            service_type,
            status,
            'Historical appointment data for analytics',
            appointment_date - INTERVAL '1 day'
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  -- Generate appointments for Soho Smiles (past 12 months)
  IF soho_tenant_id IS NOT NULL THEN
    -- Get actual service names from services table for Soho
    SELECT ARRAY_AGG(name ORDER BY display_order) INTO soho_service_types
    FROM services
    WHERE tenant_id = soho_tenant_id;
    
    -- If no services found, skip this tenant
    IF soho_service_types IS NULL OR array_length(soho_service_types, 1) = 0 THEN
      RAISE NOTICE 'No services found for Soho Smiles tenant';
    ELSE
      FOR months_back IN 0..11 LOOP
        appointment_date := DATE_TRUNC('month', CURRENT_DATE - (months_back || ' months')::INTERVAL)::DATE;
        days_in_month := EXTRACT(DAY FROM (appointment_date + INTERVAL '1 month - 1 day'));
        
        -- Generate 12-20 appointments per month for Soho
        FOR i IN 1..(12 + (months_back % 8)) LOOP
          random_day := 1 + (i * 3) % days_in_month;
          appointment_date := DATE_TRUNC('month', CURRENT_DATE - (months_back || ' months')::INTERVAL)::DATE + (random_day - 1);
          
          IF appointment_date > CURRENT_DATE THEN
            CONTINUE;
          END IF;
          
          patient_name := patient_names[1 + (i + months_back * 5) % array_length(patient_names, 1)];
          service_type := soho_service_types[1 + (i % array_length(soho_service_types, 1))];
          
          IF appointment_date < CURRENT_DATE THEN
            CASE (i % 10)
              WHEN 0 THEN status := 'Missed';
              WHEN 1 THEN status := 'Cancelled';
              ELSE status := 'Completed';
            END CASE;
          ELSE
            status := 'Confirmed';
          END IF;
          
          CASE (i % 5)
            WHEN 0 THEN time_slot := '10:00 AM';
            WHEN 1 THEN time_slot := '12:00 PM';
            WHEN 2 THEN time_slot := '02:00 PM';
            WHEN 3 THEN time_slot := '05:30 PM';
            ELSE time_slot := '07:00 PM';
          END CASE;
          
          INSERT INTO appointments (
            tenant_id,
            patient_name,
            patient_email,
            patient_phone,
            date,
            time,
            service_type,
            status,
            notes,
            created_at
          ) VALUES (
            soho_tenant_id,
            patient_name,
            LOWER(REPLACE(patient_name, ' ', '.')) || '@example.com',
            '(555) ' || LPAD((200 + i)::TEXT, 3, '0') || '-' || LPAD((2000 + i * 11)::TEXT, 4, '0'),
            appointment_date,
            time_slot,
            service_type,
            status,
            'Historical appointment data for analytics',
            appointment_date - INTERVAL '1 day'
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  RAISE NOTICE 'Analytics seed data inserted successfully';
END $$;

-- Verify the data
SELECT 
  t.slug,
  COUNT(a.id) as total_appointments,
  COUNT(DISTINCT a.patient_name) as unique_patients,
  COUNT(*) FILTER (WHERE a.status = 'Completed') as completed,
  COUNT(*) FILTER (WHERE a.status = 'Missed') as missed,
  COUNT(*) FILTER (WHERE a.status = 'Cancelled') as cancelled
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id
GROUP BY t.slug
ORDER BY t.slug;
