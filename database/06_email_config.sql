-- ============================================
-- Email Configuration Migration
-- ============================================
-- Adds email customization fields to tenants table
-- Allows each tenant to customize their email sender identity and templates
-- ============================================

-- Add email configuration columns to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS email_sender_name TEXT,
ADD COLUMN IF NOT EXISTS email_sender_local_part TEXT,
ADD COLUMN IF NOT EXISTS email_reply_to TEXT,
ADD COLUMN IF NOT EXISTS email_confirmation_subject TEXT DEFAULT 'Appointment Confirmed: {{date}}',
ADD COLUMN IF NOT EXISTS email_confirmation_body TEXT DEFAULT 'Hi {{patient_name}},

Your appointment for {{service_name}} is confirmed for {{time}} on {{date}}.

We look forward to seeing you! If you need to reschedule or cancel, please contact us at least 24 hours in advance.';

-- Set default values for existing tenants
UPDATE public.tenants
SET 
  email_sender_name = COALESCE(email_sender_name, display_name),
  email_sender_local_part = COALESCE(email_sender_local_part, 'bookings'),
  email_reply_to = COALESCE(email_reply_to, NULL),
  email_confirmation_subject = COALESCE(email_confirmation_subject, 'Appointment Confirmed: {{date}}'),
  email_confirmation_body = COALESCE(email_confirmation_body, 'Hi {{patient_name}},

Your appointment for {{service_name}} is confirmed for {{time}} on {{date}}.

We look forward to seeing you! If you need to reschedule or cancel, please contact us at least 24 hours in advance.')
WHERE email_sender_name IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.email_sender_name IS 'Display name for email sender (e.g., "Soho Smiles")';
COMMENT ON COLUMN public.tenants.email_sender_local_part IS 'Local part of email address before @domain (e.g., "bookings" for bookings@domain.com)';
COMMENT ON COLUMN public.tenants.email_reply_to IS 'Reply-to email address for patient responses (e.g., "office@sohosmiles.com")';
COMMENT ON COLUMN public.tenants.email_confirmation_subject IS 'Email subject template with {{variables}} support';
COMMENT ON COLUMN public.tenants.email_confirmation_body IS 'Email body template with {{variables}} support (Markdown or HTML)';

-- Note: RLS policies already allow tenants to update their own records
-- The existing policies in 03_rls_policies.sql handle UPDATE permissions

