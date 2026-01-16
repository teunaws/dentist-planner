-- ============================================
-- Seed Data
-- ============================================
-- This file contains sample data for development and testing.
-- Run this file after 01_schema.sql, 02_functions_and_triggers.sql, and 03_rls_policies.sql
-- ============================================

-- Insert tenants
INSERT INTO tenants (id, slug, display_name, hero_eyebrow, hero_heading, hero_subheading, operating_start_hour, operating_end_hour, theme_accent_from, theme_accent_to)
VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'lumina',
    'Lumina Dental Studio',
    'Modern Barber-Inspired Care',
    'Book a dental session without creating an account',
    'Choose a day, lock your slot, and we handle the rest.',
    9,
    17,
    '#14b8a6',
    '#3b82f6'
  ),
  (
    'b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22',
    'soho-smiles',
    'Soho Smiles Collective',
    'Downtown Dental Loft',
    'Concierge dentistry, built for creatives.',
    'Reserve an express chair, share your vibe, and we do the rest.',
    10,
    20,
    '#f97316',
    '#ec4899'
  )
ON CONFLICT (slug) DO NOTHING;

-- Insert services for Lumina
INSERT INTO services (id, tenant_id, name, description, duration, price, display_order)
VALUES
  (
    'c2aade11-be2d-6ab0-dd8f-8dd1df5a2c33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Signature Clean',
    'Full hygiene session with hand-finished polish.',
    50,
    '$180',
    1
  ),
  (
    'd3aaef22-cf3e-7ab1-ee9a-9ee2ea6b3d44',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Express Polish',
    'Quick refresh between bigger visits.',
    30,
    '$120',
    2
  ),
  (
    'e4aafb33-da4f-8ab2-ff0a-0ff3fa7c4e55',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Whitening Studio',
    'In-chair whitening inspired by boutique facial bars.',
    70,
    '$260',
    3
  )
ON CONFLICT DO NOTHING;

-- Insert service perks for Lumina
INSERT INTO service_perks (service_id, perk_text, display_order)
VALUES
  ('c2aade11-be2d-6ab0-dd8f-8dd1df5a2c33', 'Fluoride finish', 1),
  ('c2aade11-be2d-6ab0-dd8f-8dd1df5a2c33', 'Text reminders', 2),
  ('d3aaef22-cf3e-7ab1-ee9a-9ee2ea6b3d44', '15-min check-in', 1),
  ('d3aaef22-cf3e-7ab1-ee9a-9ee2ea6b3d44', 'Flexible timing', 2),
  ('e4aafb33-da4f-8ab2-ff0a-0ff3fa7c4e55', 'LED boost', 1),
  ('e4aafb33-da4f-8ab2-ff0a-0ff3fa7c4e55', 'After-care kit', 2)
ON CONFLICT DO NOTHING;

-- Insert services for Soho Smiles
INSERT INTO services (id, tenant_id, name, description, duration, price, display_order)
VALUES
  (
    'f5aabc44-ea5a-9ab3-aa1a-1aa4ab8d5f66',
    'b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22',
    'Studio Clean',
    'Curated hygiene with aromatherapy rinse.',
    55,
    '$210',
    1
  ),
  (
    'a6aabc55-fa6a-0ab4-aa2a-2aa5ab9e6a77',
    'b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22',
    'After-hours Touch-up',
    'Evening polish with complimentary transport credit.',
    35,
    '$165',
    2
  )
ON CONFLICT DO NOTHING;

-- Insert availability slots for Lumina
INSERT INTO availability_slots (tenant_id, time_slot, display_order)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '08:00 AM', 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '09:30 AM', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11:00 AM', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '01:00 PM', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '02:30 PM', 5),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '04:00 PM', 6)
ON CONFLICT DO NOTHING;

-- Insert availability slots for Soho Smiles
INSERT INTO availability_slots (tenant_id, time_slot, display_order)
VALUES
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', '10:00 AM', 1),
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', '12:00 PM', 2),
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', '02:00 PM', 3),
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', '05:30 PM', 4),
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', '07:00 PM', 5)
ON CONFLICT DO NOTHING;

-- Insert appointment durations for Lumina
INSERT INTO appointment_durations (tenant_id, service_type, duration_minutes)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cleaning', 60),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Consultation', 45),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Whitening', 90),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Filling', 75),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Signature Clean', 50),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Express Polish', 30),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Whitening Studio', 70)
ON CONFLICT (tenant_id, service_type) DO NOTHING;

-- Insert appointment durations for Soho Smiles
INSERT INTO appointment_durations (tenant_id, service_type, duration_minutes)
VALUES
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', 'Studio Clean', 55),
  ('b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22', 'After-hours Touch-up', 40)
ON CONFLICT (tenant_id, service_type) DO NOTHING;

-- Insert sample appointments for Lumina
INSERT INTO appointments (id, tenant_id, patient_name, dentist_name, date, time, service_type, status, notes)
VALUES
  (
    'a7aabc66-aa7a-1ab5-aa3a-3aa6ab0f7a88',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Maya Patel',
    'Dr. Evelyn Hart',
    CURRENT_DATE,
    '09:30 AM',
    'Cleaning',
    'Confirmed',
    '6-month hygiene visit'
  ),
  (
    'a8aabc77-aa8a-2ab6-aa4a-4aa7aa1a8a99',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Noah Reed',
    'Dr. Evelyn Hart',
    CURRENT_DATE + INTERVAL '1 day',
    '11:00 AM',
    'Consultation',
    'Pending',
    'Discuss whitening plan'
  ),
  (
    'a9aabc88-aa9a-3ab7-aa5a-5aa8ab2a9a00',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Layla Kim',
    'Dr. Evelyn Hart',
    CURRENT_DATE + INTERVAL '2 days',
    '01:30 PM',
    'Whitening',
    'Confirmed',
    'LED boost follow-up'
  ),
  (
    'a0aabc99-aa0a-4ab8-aa6a-6aa9aa3a0a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Evan Brooks',
    'Dr. Evelyn Hart',
    CURRENT_DATE + INTERVAL '3 days',
    '03:30 PM',
    'Filling',
    'Confirmed',
    'Composite on #12'
  )
ON CONFLICT DO NOTHING;

-- Insert sample appointments for Soho Smiles
INSERT INTO appointments (id, tenant_id, patient_name, dentist_name, date, time, service_type, status, notes)
VALUES
  (
    'a1aabc00-aa1a-5ab9-aa7a-7aa9aa4a1a22',
    'b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22',
    'Isla Monroe',
    'Dr. Alana Cho',
    CURRENT_DATE,
    '10:00 AM',
    'Studio Clean',
    'Confirmed',
    'Prefers citrus polish'
  ),
  (
    'a2aabc11-aa2a-6ab0-aa8a-8aa0aa5a2a33',
    'b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22',
    'Emerson Tate',
    'Dr. Alana Cho',
    CURRENT_DATE + INTERVAL '1 day',
    '07:00 PM',
    'After-hours Touch-up',
    'Confirmed',
    'Send car at 6:15 PM'
  )
ON CONFLICT DO NOTHING;

-- Insert users (for authentication)
-- Note: In production, passwords should be properly hashed. These are demo credentials.
INSERT INTO users (id, email, password_hash, role, tenant_id, name)
VALUES
  (
    'a3aabc22-aa3a-7ab1-aa9a-9aa2aa6a3a44',
    'dentist@example.com',
    'demo_hash_smile123', -- In production, use proper bcrypt hashing
    'dentist',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Dr. Evelyn Hart'
  ),
  (
    'a4aabc33-aa4a-8ab2-aa0a-0aa3aa7a4a55',
    'admin@system.com',
    'demo_hash_admin123', -- In production, use proper bcrypt hashing
    'admin',
    NULL,
    'System Admin'
  )
ON CONFLICT (email) DO NOTHING;

