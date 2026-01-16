export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            fhir_patients: {
                Row: {
                    id: string
                    tenant_id: string
                    is_active: boolean
                    name_encrypted: string // bytea comes as string in JSON/base64 usually, or we treat as opaque
                    telecom_encrypted: string
                    birth_date_encrypted: string | null
                    address_encrypted: string | null
                    created_at: string
                    updated_at: string
                    erased_at: string | null
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    is_active?: boolean
                    name_encrypted: string
                    telecom_encrypted: string
                    birth_date_encrypted?: string | null
                    address_encrypted?: string | null
                    created_at?: string
                    updated_at?: string
                    erased_at?: string | null
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    is_active?: boolean
                    name_encrypted?: string
                    telecom_encrypted?: string
                    birth_date_encrypted?: string | null
                    address_encrypted?: string | null
                    created_at?: string
                    updated_at?: string
                    erased_at?: string | null
                }
            }
            fhir_appointments: {
                Row: {
                    id: string
                    tenant_id: string
                    status: string
                    patient_id: string
                    practitioner_id: string | null
                    start_time: string
                    end_time: string
                    service_id: string | null
                    description_encrypted: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    status: string
                    patient_id: string
                    practitioner_id?: string | null
                    start_time: string
                    end_time: string
                    service_id?: string | null
                    description_encrypted?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    status?: string
                    patient_id?: string
                    practitioner_id?: string | null
                    start_time?: string
                    end_time?: string
                    service_id?: string | null
                    description_encrypted?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            audit_events: {
                Row: {
                    id: string
                    timestamp: string
                    actor_id: string | null
                    action_type: string
                    resource_type: string
                    resource_id: string
                    outcome: string
                    ip_address: string | null
                    details: Json | null
                }
                Insert: {
                    id?: string
                    timestamp?: string
                    actor_id?: string | null
                    action_type: string
                    resource_type: string
                    resource_id: string
                    outcome: string
                    ip_address?: string | null
                    details?: Json | null
                }
                Update: {
                    // Should not happen due to policy, but defined for type completeness
                    id?: string
                }
            }
        }
    }
}
