-- Link all dentists to all services for their tenant
-- Using 'users' table because 'providers' table logic failed or is empty
INSERT INTO provider_services (service_id, provider_id)
SELECT 
    s.id, 
    u.id
FROM services s
JOIN users u ON u.tenant_id = s.tenant_id
WHERE u.role = 'dentist'
ON CONFLICT DO NOTHING;
