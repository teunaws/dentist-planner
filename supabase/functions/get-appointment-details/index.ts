
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { decrypt } from "../_shared/encryption.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Auth Check (Implicit via getUser, but we need to verify role/permissions explicitly or rely on RLS if using Service Role judiciously)
        //    Actually, for "Reading Decrypted Data", we should strictly control this.
        //    Better to use the USER'S JWT to fetch the data first? 
        //    Problem: The data might be encrypted even if they fetch it.
        //    So we use Service Role to decrypt, but we must verify the USER first.

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const body = await req.json();
        const { appointmentId } = body;

        console.log(`[get-appointment-details] Fetching ID: ${appointmentId}`);

        // 2. Fetch Appointment (Encrypted) with Linked Patient AND Provider
        //    Using left join (patients, providers)
        const { data: appointment, error: fetchError } = await supabaseClient
            .from('appointments')
            .select('*, patients(full_name, email, phone), providers(name, color)')
            .eq('id', appointmentId)
            .single();

        if (fetchError) {
            console.error('[get-appointment-details] DB Error:', fetchError);
        }
        if (!appointment) {
            console.error('[get-appointment-details] No appointment found for ID:', appointmentId);
            throw new Error('Appointment not found');
        }
        console.log('[get-appointment-details] Found appointment:', appointment.id);

        // Permission Check
        const role = user.user_metadata.role;
        const tenantId = user.user_metadata.tenant_id;

        if (role !== 'admin') {
            if (role === 'dentist' && appointment.tenant_id !== tenantId) {
                throw new Error('Forbidden: Tenant mismatch');
            }
            if (role !== 'dentist') {
                // Patients can't read arbitrary appointments via this API
                throw new Error('Forbidden: Insufficient role');
            }
        }

        // 2.5 Security Audit Log (Compliance)
        const rawIp = req.headers.get('x-forwarded-for') ?? null;
        const clientIp = rawIp ? rawIp.split(',')[0].trim() : null;
        const userAgent = req.headers.get('user-agent') ?? null;

        // Use dedicated Admin client for Logging to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fire and forget audit log to improve performance? 
        // No, for security/compliance we should await, but we can do it in parallel with decryption!
        const auditPromise = supabaseAdmin.from('access_logs').insert({
            user_id: user.id,
            resource_type: 'appointment',
            resource_id: appointmentId,
            action: 'view_decrypted',
            ip_address: clientIp,
            user_agent: userAgent
        });

        // 3. Decrypt PII (Parallelized)
        // Run audit log and decryption concurrently
        const [auditResult, decryptedName, decryptedEmail, decryptedPhone] = await Promise.all([
            auditPromise,
            decrypt(appointment.patients?.full_name ?? ''),
            decrypt(appointment.patients?.email ?? ''),
            decrypt(appointment.patients?.phone ?? '')
        ]);

        if (auditResult.error) {
            console.error("Audit Log Failed:", auditResult.error);
            // We can choose to throw here if strict compliance is needed
        }

        // 4. Return Decrypted
        return new Response(
            JSON.stringify({
                ...appointment,
                patient_name: decryptedName,
                patient_email: decryptedEmail,
                patient_phone: decryptedPhone,
                provider_name: appointment.providers?.name,
                provider_color: appointment.providers?.color,
                // Remove the nested objects to keep contract clean
                patients: undefined,
                providers: undefined
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
