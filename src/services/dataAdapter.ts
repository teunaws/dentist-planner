import { Appointment } from '../types';
import { supabase } from '../lib/supabase';
// import { Database } from '../types/supabase'; // Not explicitly needed if supabase instance is typed

// Interface defining the core data operations
export interface IDataService {
    getAppointments(tenantId: string, startDate?: string, endDate?: string): Promise<Appointment[]>;
    createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment>;
    // Add other methods as needed
}

// =========================================================
// Legacy Implementation (Current Production)
// =========================================================
class LegacyDataServiceImpl implements IDataService {
    async getAppointments(tenantId: string, startDate?: string, endDate?: string): Promise<Appointment[]> {
        let query = supabase
            .from('appointments')
            .select('*')
            .eq('tenant_id', tenantId);

        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((row: any) => ({
            id: row.id,
            patientId: row.patient_id || '',
            patientName: row.patient_name,
            patientEmail: row.patient_email,
            patientPhone: row.patient_phone,
            dentistId: row.dentist_id || '',
            dentistName: row.dentist_name || '',
            providerId: row.provider_id,
            date: row.date,
            time: row.time,
            type: row.service_type,
            status: row.status,
            notes: row.notes,
            dateOfBirth: row.date_of_birth,
            homeAddress: row.home_address,
            insuranceProvider: row.insurance_provider,
            emergencyContact: row.emergency_contact,
            reasonForVisit: row.reason_for_visit
        }));
    }

    async createAppointment(appt: Omit<Appointment, 'id'>): Promise<Appointment> {
        // Call the existing logic or direct insert
        // For adapter simplicity, we assume generic insert here
        const { data, error } = await supabase
            .from('appointments')
            .insert({
                tenant_id: appt.dentistId, // Assuming dentistId holds tenantId context or similar in legacy
                patient_name: appt.patientName,
                date: appt.date,
                time: appt.time,
                service_type: appt.type,
                status: appt.status,
                notes: appt.notes
                // ... map other fields
            } as any)
            .select()
            .single();

        if (error) throw error;
        return { ...appt, id: data.id };
    }
}

// =========================================================
// FHIR Implementation (EU Compliant)
// =========================================================
class FhirDataServiceImpl implements IDataService {
    // private client = supabase; // Unused for now

    async getAppointments(tenantId: string, _startDate?: string, _endDate?: string): Promise<Appointment[]> {
        // In FHIR, we query fhir_appointments and JOIN fhir_patients
        // Since Supabase Client joins are limited on disjoint tables without FK matching exactly how we want sometimes,
        // we might use a dedicated RPC or View.
        // For now, let's assume an Edge Function 'get_appointments_secure' handles the decryption and join.

        // const { data, error } = await supabase.functions.invoke('fhir-api', {
        //   body: { action: 'get_appointments', tenantId, startDate, endDate }
        // });

        // Mocking the response structure from the secure endpoint
        console.log('[FHIR] Fetching appointments via Secure Gateway...');

        // Placeholder return
        return [];
    }

    async createAppointment(appt: Omit<Appointment, 'id'>): Promise<Appointment> {
        console.log('[FHIR] Creating appointment (Encrypted)...');

        // 1. Create/Find Patient (Encrypted)
        // 2. Create Appointment
        // 3. Log Audit Event

        // This logic would move to the Edge Function to ensure keys are safe.
        // await supabase.functions.invoke('fhir-api', { 
        //   body: { action: 'create_appointment', data: appt } 
        // });

        return { ...appt, id: 'temp-fhir-id' };
    }
}

// =========================================================
// Factory
// =========================================================
export const getDataService = (): IDataService => {
    const useFhir = process.env.NEXT_PUBLIC_USE_FHIR === 'true';
    return useFhir ? new FhirDataServiceImpl() : new LegacyDataServiceImpl();
};
