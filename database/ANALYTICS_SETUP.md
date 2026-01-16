# Analytics Dashboard Database Setup

This guide explains how to set up the database schema and seed data for the Analytics Dashboard.

## Prerequisites

- Supabase project set up
- Main schema (`schema.sql`) and seed data (`seed.sql`) already run

## Setup Steps

### 1. Run Analytics Schema Updates

Run the analytics schema SQL script in your Supabase SQL Editor:

```sql
-- File: database/analytics_schema.sql
```

This script will:
- Add `patient_email` and `patient_phone` columns to appointments (if not already present)
- Update appointment statuses for historical data
- Create indexes for faster analytics queries
- Create helpful views for analytics calculations

**To run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `database/analytics_schema.sql`
3. Click "Run"

### 2. Seed Analytics Data

Run the analytics seed SQL script to populate historical appointment data:

```sql
-- File: database/analytics_seed.sql
```

This script will:
- Generate 12 months of historical appointment data for each tenant
- Create realistic appointment patterns with various statuses (Completed, Missed, Cancelled)
- Distribute appointments across different service types
- Generate patient contact information

**To run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `database/analytics_seed.sql`
3. Click "Run"
4. Verify the data was inserted by checking the summary output

### 3. Verify Data

After running both scripts, verify the data:

```sql
-- Check appointment counts per tenant
SELECT 
  t.slug,
  COUNT(a.id) as total_appointments,
  COUNT(DISTINCT a.patient_name) as unique_patients,
  COUNT(*) FILTER (WHERE a.status = 'Completed') as completed,
  COUNT(*) FILTER (WHERE a.status = 'Missed') as missed,
  COUNT(*) FILTER (WHERE a.status = 'Cancelled') as cancelled,
  MIN(a.date) as earliest_appointment,
  MAX(a.date) as latest_appointment
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id
GROUP BY t.slug
ORDER BY t.slug;
```

## What the Analytics Dashboard Uses

The analytics service queries the `appointments` table to calculate:

1. **No-Show Rate**: Compares "Missed" vs "Completed" appointments in the last 30 days
2. **Patient Recall Rate**: Percentage of patients with hygiene/checkup visits in last 6 months
3. **New vs Returning Patients**: Tracks first visit dates to categorize patients by month
4. **Treatment Distribution**: Groups appointments by `service_type`
5. **At-Risk Patients**: Finds patients with no visit in 18+ months and no future appointments

## Data Structure

The analytics seed script generates:
- **15-25 appointments per month** for Lumina tenant
- **12-20 appointments per month** for Soho Smiles tenant
- **Realistic status distribution**: 70% Completed, 15% Confirmed (future), 10% Missed, 5% Cancelled
- **Various service types** matching each tenant's services
- **Patient contact information** (email and phone)

## Notes

- The seed script uses `ON CONFLICT DO NOTHING` to avoid duplicate entries
- Historical appointments are backdated with appropriate `created_at` timestamps
- Patient names are rotated to create realistic visit patterns
- The script automatically handles date calculations and skips future dates

## Troubleshooting

If you see empty analytics:
1. Verify appointments exist: `SELECT COUNT(*) FROM appointments WHERE tenant_id = '<your-tenant-id>'`
2. Check appointment statuses: `SELECT DISTINCT status FROM appointments`
3. Ensure dates are in the past: `SELECT MIN(date), MAX(date) FROM appointments`

If you need to regenerate data:
```sql
-- Clear existing analytics data (be careful!)
DELETE FROM appointments WHERE notes = 'Historical appointment data for analytics';
-- Then re-run analytics_seed.sql
```

