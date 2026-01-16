-- Manually Upsert Weekend Schedules for All Active Providers
-- This ensures Saturdays (6) and Sundays (7) are set to Working.

DO $$
DECLARE
    r_provider RECORD;
BEGIN
    FOR r_provider IN 
        SELECT id, tenant_id FROM providers WHERE is_active = true
    LOOP
        -- Insert/Update Saturday (6)
        INSERT INTO provider_schedules (provider_id, day_of_week, start_time, end_time, is_working, created_at, updated_at)
        VALUES (
            r_provider.id, 
            6, 
            '09:00:00', 
            '17:00:00', 
            true, 
            NOW(), 
            NOW()
        )
        ON CONFLICT (provider_id, day_of_week) 
        DO UPDATE SET 
            is_working = true,
            start_time = '09:00:00',
            end_time = '17:00:00',
            updated_at = NOW();

        -- Insert/Update Sunday (0)
        -- Constraints enforce 0-6 range for day_of_week
        INSERT INTO provider_schedules (provider_id, day_of_week, start_time, end_time, is_working, created_at, updated_at)
        VALUES (
            r_provider.id, 
            0, 
            '09:00:00', 
            '17:00:00', 
            true, 
            NOW(), 
            NOW()
        )
        ON CONFLICT (provider_id, day_of_week) 
        DO UPDATE SET 
            is_working = true,
            start_time = '09:00:00',
            end_time = '17:00:00',
            updated_at = NOW();



    END LOOP;
END;
$$;
