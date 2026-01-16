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
            tenants: {
                Row: {
                    id: string
                    slug: string
                    display_name: string
                    hero_eyebrow: string | null
                    hero_heading: string | null
                    hero_subheading: string | null
                    operating_start_hour: number
                    operating_end_hour: number
                    operating_hours_per_day: Json | null
                    theme_accent_from: string | null
                    theme_accent_to: string | null
                    booking_form_config: Json | null
                    is_onboarded: boolean
                    onboarded_at: string | null
                    email_sender_name: string | null
                    email_sender_local_part: string | null
                    email_reply_to: string | null
                    email_confirmation_enabled: boolean
                    email_confirmation_subject: string | null
                    email_confirmation_body: string | null
                    email_reminder_enabled: boolean
                    email_reminder_subject: string | null
                    email_reminder_body: string | null
                    sms_confirmation_enabled: boolean
                    sms_confirmation_template: string | null
                    sms_reminder_enabled: boolean
                    sms_reminder_template: string | null
                    address: string | null
                    timezone: string
                    phone: string | null
                    email: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    slug: string
                    display_name: string
                    hero_eyebrow?: string | null
                    hero_heading?: string | null
                    hero_subheading?: string | null
                    operating_start_hour?: number
                    operating_end_hour?: number
                    operating_hours_per_day?: Json | null
                    theme_accent_from?: string | null
                    theme_accent_to?: string | null
                    booking_form_config?: Json | null
                    is_onboarded?: boolean
                    onboarded_at?: string | null
                    email_sender_name?: string | null
                    email_sender_local_part?: string | null
                    email_reply_to?: string | null
                    email_confirmation_enabled?: boolean
                    email_confirmation_subject?: string | null
                    email_confirmation_body?: string | null
                    email_reminder_enabled?: boolean
                    email_reminder_subject?: string | null
                    email_reminder_body?: string | null
                    sms_confirmation_enabled?: boolean
                    sms_confirmation_template?: string | null
                    sms_reminder_enabled?: boolean
                    sms_reminder_template?: string | null
                    address?: string | null
                    timezone?: string
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    slug?: string
                    display_name?: string
                    hero_eyebrow?: string | null
                    hero_heading?: string | null
                    hero_subheading?: string | null
                    operating_start_hour?: number
                    operating_end_hour?: number
                    operating_hours_per_day?: Json | null
                    theme_accent_from?: string | null
                    theme_accent_to?: string | null
                    booking_form_config?: Json | null
                    is_onboarded?: boolean
                    onboarded_at?: string | null
                    email_sender_name?: string | null
                    email_sender_local_part?: string | null
                    email_reply_to?: string | null
                    email_confirmation_enabled?: boolean
                    email_confirmation_subject?: string | null
                    email_confirmation_body?: string | null
                    email_reminder_enabled?: boolean
                    email_reminder_subject?: string | null
                    email_reminder_body?: string | null
                    sms_confirmation_enabled?: boolean
                    sms_confirmation_template?: string | null
                    sms_reminder_enabled?: boolean
                    sms_reminder_template?: string | null
                    address?: string | null
                    timezone?: string
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            services: {
                Row: {
                    id: string
                    tenant_id: string
                    name: string
                    description: string | null
                    duration: number
                    price: string
                    display_order: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    name: string
                    description?: string | null
                    duration: number
                    price: string
                    display_order?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    name?: string
                    description?: string | null
                    duration?: number
                    price?: string
                    display_order?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            appointments: {
                Row: {
                    id: string
                    tenant_id: string
                    patient_id: string | null
                    patient_name: string
                    patient_email: string | null
                    patient_email_hash: string | null
                    patient_phone: string | null
                    patient_phone_hash: string | null
                    dentist_id: string | null
                    dentist_name: string | null
                    provider_id: string | null
                    date: string
                    time: string
                    service_type: string
                    status: string | null
                    notes: string | null
                    date_of_birth: string | null
                    home_address: string | null
                    insurance_provider: string | null
                    emergency_contact: string | null
                    reason_for_visit: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    patient_id?: string | null
                    patient_name: string
                    patient_email?: string | null
                    patient_email_hash?: string | null
                    patient_phone?: string | null
                    patient_phone_hash?: string | null
                    dentist_id?: string | null
                    dentist_name?: string | null
                    provider_id?: string | null
                    date: string
                    time: string
                    service_type: string
                    status?: string | null
                    notes?: string | null
                    date_of_birth?: string | null
                    home_address?: string | null
                    insurance_provider?: string | null
                    emergency_contact?: string | null
                    reason_for_visit?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    patient_id?: string | null
                    patient_name?: string
                    patient_email?: string | null
                    patient_email_hash?: string | null
                    patient_phone?: string | null
                    patient_phone_hash?: string | null
                    dentist_id?: string | null
                    dentist_name?: string | null
                    provider_id?: string | null
                    date?: string
                    time?: string
                    service_type?: string
                    status?: string | null
                    notes?: string | null
                    date_of_birth?: string | null
                    home_address?: string | null
                    insurance_provider?: string | null
                    emergency_contact?: string | null
                    reason_for_visit?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            providers: {
                Row: {
                    id: string
                    tenant_id: string
                    name: string
                    color: string | null
                    user_id: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    name: string
                    color?: string | null
                    user_id?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    name?: string
                    color?: string | null
                    user_id?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            availability_slots: {
                Row: {
                    id: string
                    tenant_id: string
                    time_slot: string
                    display_order: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    tenant_id: string
                    time_slot: string
                    display_order?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    time_slot?: string
                    display_order?: number | null
                    created_at?: string
                }
            }
        }
    }
}
