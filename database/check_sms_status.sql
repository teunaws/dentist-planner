-- Check SMS Configuration for Tenant
-- Replace 'o3' with your tenant slug

-- Check if SMS is enabled and see the template
SELECT 
  id,
  slug,
  display_name,
  sms_confirmation_enabled,
  sms_confirmation_template,
  sms_reminder_enabled,
  sms_reminder_template
FROM tenants
WHERE slug = 'o3';

-- Enable SMS for tenant 'o3' if it's disabled
UPDATE tenants
SET 
  sms_confirmation_enabled = true,
  sms_confirmation_template = COALESCE(
    sms_confirmation_template,
    'Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}.'
  )
WHERE slug = 'o3';

