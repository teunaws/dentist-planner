/**
 * Migration Script: Legacy -> FHIR (EU)
 * 
 * Usage: 
 *   export LEGACY_DB_URL=...
 *   export EU_DB_URL=...
 *   npx ts-node scripts/migrate_to_fhir.ts
 */

import { createClient } from '@supabase/supabase-js';
// import { encrypt } from './encryption-utils'; // Conceptual

const LEGACY_URL = process.env.LEGACY_URL || '';
const LEGACY_KEY = process.env.LEGACY_KEY || '';
const EU_URL = process.env.EU_URL || '';
const EU_KEY = process.env.EU_KEY || '';

const legacy = createClient(LEGACY_URL, LEGACY_KEY);
const eu = createClient(EU_URL, EU_KEY);

async function migrate() {
    console.log('Starting Migration...');

    // 1. Fetch Legacy Appointments (Source of Truth for Patients currently)
    const { data: appointments, error } = await legacy
        .from('appointments')
        .select('*');

    if (error) throw error;
    console.log(`Found ${appointments.length} appointments to process.`);

    // 2. Extract Unique Patients
    const patientsMap = new Map<string, any>();

    for (const appt of appointments) {
        const key = `${appt.patient_email}:${appt.patient_phone}`; // Simplistic dedup key
        if (!patientsMap.has(key)) {
            patientsMap.set(key, {
                tenant_id: appt.tenant_id,
                name: appt.patient_name,
                email: appt.patient_email,
                phone: appt.patient_phone,
                // ... extract other PII
            });
        }
    }

    console.log(`Extracted ${patientsMap.size} unique patients.`);

    // 3. Insert Patients into FHIR DB (Encrypted)
    for (const [key, p] of patientsMap) {
        // In a real script, we would call the RPC that handles encryption
        // OR we encrypt locally using the same key as the DB (if we have shared secret)
        // For TDD compliance, we call the Edge Function or RPC 'create_patient_secure'

        /*
        const { data: newPatient } = await eu.rpc('create_patient_secure', {
          _tenant_id: p.tenant_id,
          _name_json: { text: p.name },
          _telecom_json: [{ system: 'email', value: p.email }]
        });
        */

        console.log(`[Mock] Migrated Patient: ${p.email}`);
    }

    // 4. Insert Appointments linking to new Patient IDs
    // ... (Requires mapping old patient info to new UUIDs)

    console.log('Migration Complete.');
}

migrate().catch(console.error);
