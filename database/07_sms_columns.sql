-- ============================================
-- SMS Configuration Columns (Safe Migration)
-- ============================================
-- Adds SMS customization fields to tenants table
-- CRITICAL: No RLS policies added - relies on existing policies
-- ============================================

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS sms_confirmation_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_confirmation_template text DEFAULT 'Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}.',
ADD COLUMN IF NOT EXISTS sms_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_reminder_template text DEFAULT 'Reminder: Appointment at {{tenant_name}} tomorrow at {{time}}';

-- Set default values for existing tenants (if columns were just added)
UPDATE public.tenants
SET 
  sms_confirmation_enabled = COALESCE(sms_confirmation_enabled, false),
  sms_confirmation_template = COALESCE(sms_confirmation_template, 'Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}.'),
  sms_reminder_enabled = COALESCE(sms_reminder_enabled, false),
  sms_reminder_template = COALESCE(sms_reminder_template, 'Reminder: Appointment at {{tenant_name}} tomorrow at {{time}}')
WHERE sms_confirmation_enabled IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.sms_confirmation_enabled IS 'Whether to send SMS confirmation when appointment is booked';
COMMENT ON COLUMN public.tenants.sms_confirmation_template IS 'SMS template for booking confirmations with {{variables}} support';
COMMENT ON COLUMN public.tenants.sms_reminder_enabled IS 'Whether to send SMS reminders 24 hours before appointments';
COMMENT ON COLUMN public.tenants.sms_reminder_template IS 'SMS template for appointment reminders with {{variables}} support';

