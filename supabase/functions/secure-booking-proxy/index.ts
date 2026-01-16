
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { encrypt, hashForSearch } from "../_shared/encryption.ts";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    // ADD 'x-application-name' TO THIS STRING 👇
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}
// Zod Schema for validation
// Zod Schema for validation
const PatientBookingSchema = z.object({
    tenant_id: z.string().uuid(),
    patient_name: z.string().min(2),
    patient_email: z.string().email(),
    patient_phone: z.string().min(10),
    date: z.string(),
    time: z.string(),
    service_id: z.string().uuid(),
    provider_id: z.string().uuid().nullish(), // Accepts null or undefined
    date_of_birth: z.string().nullish(),
    home_address: z.string().nullish(),
    insurance_provider: z.string().nullish(),
    emergency_contact: z.string().nullish(),
    reason_for_visit: z.string().nullish(),
});

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        console.log("📥 Received Payload (Raw):", JSON.stringify(body));

        // Detailed manual logging for debugging
        console.log(`🔎 Validating fields:
          - tenant_id: ${body.tenant_id}
          - service_id: ${body.service_id}
          - provider_id: ${body.provider_id} (${body.provider_id ? 'Present' : 'MISSING/NULL'})
          - date: ${body.date}
          - time: ${body.time}
        `);

        if (!body.provider_id) {
            console.warn("⚠️ provider_id is missing in the payload. This might be intentional if auto-assignment is expected, but check client logic.");
        }

        // Initialize Admin Client for System Operations (bypassing RLS/User Context)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const rawIp = req.headers.get('x-forwarded-for') ?? 'unknown';
        const ip = rawIp.split(',')[0].trim();

        console.log(`🛡️ Rate Limit Debug - Raw IP: '${rawIp}', Resolved IP: '${ip}'`);

        // 0. Rate Limiting Check
        if (ip !== 'unknown') {
            const { data: limitData, error: limitError } = await supabaseAdmin
                .from('rate_limits')
                .select('*')
                .eq('ip_address', ip)
                .single();

            // Perform check logic...
            if (limitError && limitError.code !== 'PGRST116') { // PGRST116 is "Row not found" (no data)
                console.error("Rate Limit DB Error:", limitError);
                // We fail open here to not block legitimate users if DB is quirky, but log it.
            }

            const parseDate = (d: any) => d ? new Date(d) : new Date(0);
            const now = new Date();
            const windowMinutes = 15;
            const maxRequests = 5;

            if (limitData) {
                const diffMs = now.getTime() - parseDate(limitData.last_request_at).getTime();
                const diffMins = diffMs / 60000;

                if (limitData.request_count >= maxRequests && diffMins < windowMinutes) {
                    console.warn(`⛔ Rate Limit Exceeded for IP: ${ip}`);
                    return new Response(
                        JSON.stringify({ error: 'Too Many Requests' }),
                        {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                            status: 429,
                        }
                    );
                }

                // Reset count if window passed, otherwise increment
                const newCount = diffMins >= windowMinutes ? 1 : limitData.request_count + 1;

                const { error: upsertError } = await supabaseAdmin.from('rate_limits').upsert({
                    ip_address: ip,
                    request_count: newCount,
                    last_request_at: now.toISOString(),
                    endpoint: 'secure-booking-proxy'
                }, { onConflict: 'ip_address, endpoint' });

                if (upsertError) console.error("❌ Rate Limit UPSERT Error:", upsertError);
                else console.log(`✅ Rate Limit Updated for ${ip}: ${newCount}`);

            } else if (!limitError || limitError.code === 'PGRST116') {
                // Insert new record if not found
                console.log(`🆕 First request from ${ip}. Inserting record.`);
                const { error: insertError } = await supabaseAdmin.from('rate_limits').insert({
                    ip_address: ip,
                    request_count: 1,
                    last_request_at: now.toISOString(),
                    endpoint: 'secure-booking-proxy' // Required by DB constraint
                });

                if (insertError) console.error("❌ Rate Limit INSERT Error:", insertError);
            }
        }

        // 1. Validate Input
        const payload = PatientBookingSchema.parse(body);

        // 2. Encrypt PII
        const encryptedName = await encrypt(payload.patient_name);
        const encryptedEmail = await encrypt(payload.patient_email);
        const encryptedPhone = await encrypt(payload.patient_phone);

        // 3. Hash Search Fields
        const emailHash = await hashForSearch(payload.patient_email);
        const phoneHash = await hashForSearch(payload.patient_phone);

        // 4. Fetch Service Name
        const { data: serviceData, error: serviceError } = await supabaseClient
            .from('services')
            .select('name')
            .eq('id', payload.service_id)
            .single();

        if (serviceError || !serviceData) {
            throw new Error('Invalid Service ID');
        }

        // 5. Upsert Patient
        // We use email_hash as the unique key to identify existing patients securely
        const { data: patientData, error: patientError } = await supabaseClient
            .from('patients')
            .upsert({
                tenant_id: payload.tenant_id,
                full_name: encryptedName,
                email: encryptedEmail,
                email_hash: emailHash,
                phone: encryptedPhone,
                phone_hash: phoneHash,
                date_of_birth: payload.date_of_birth ? payload.date_of_birth : null,
                address: payload.home_address ? payload.home_address : null,
                insurance_provider: payload.insurance_provider ? payload.insurance_provider : null,
                emergency_contact: payload.emergency_contact ? payload.emergency_contact : null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'email_hash',
                ignoreDuplicates: false
            })
            .select('id')
            .single();

        if (patientError || !patientData) {
            console.error("Patient Upsert Error:", patientError);
            throw new Error('Failed to create or retrieve patient record');
        }

        // 6. Call Atomic Booking RPC (New Signature)
        const { data, error } = await supabaseClient.rpc('book_appointment_atomic', {
            p_tenant_id: payload.tenant_id,
            p_date: payload.date,
            p_time: payload.time,
            p_patient_id: patientData.id, // Linking to the upserted patient
            p_service_type: serviceData.name,
            p_status: 'Confirmed',
            p_notes: null,
            p_provider_id: payload.provider_id || null,
            p_reason_for_visit: payload.reason_for_visit || null
        });

        if (error) {
            // Handle "Time slot is no longer available" (P0001)
            // Supabase error object might wrap the PG code
            if (error.code === 'P0001' || error.message.includes('Time slot is no longer available')) {
                return new Response(
                    JSON.stringify({ error: 'Time slot is no longer available', type: 'CONFLICT' }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 409 // Conflict
                    }
                );
            }
            throw error;
        }

        // 7. Response
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Appointment created securely',
                appointmentId: data?.id // RPC returns {id: ...} object
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error("❌ Booking Failed:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
