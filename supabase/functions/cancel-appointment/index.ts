
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
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { appointment_id } = await req.json();
        if (!appointment_id) throw new Error('Missing appointment_id');

        // Initialize Supabase Admin Client (Service Role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Authenticate User
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        console.log(`[cancel-appointment] Processing ID: ${appointment_id}`);

        // 2. Fetch Appointment Details
        const { data: appointment, error: fetchError } = await supabaseAdmin
            .from('appointments')
            .select('*, patients(id, full_name, email), tenants(display_name)')
            .eq('id', appointment_id)
            .single();

        if (fetchError) {
            console.error('[cancel-appointment] DB Fetch Error:', fetchError);
        }

        if (fetchError || !appointment) {
            console.error('[cancel-appointment] Appointment lookup failed');
            throw new Error('Appointment not found');
        }
        console.log('[cancel-appointment] Found appointment, checking permissions...');

        // 3. Permission Check (RBAC + Tenant Isolation)
        const role = user.user_metadata.role; // Note: We might want app_metadata pending previous migration usage, but let's check both or user standard for now.
        // Actually, previous phases migrated to app_metadata. Let's try to read app_metadata first, fallback to user_metadata
        const appMeta = user.app_metadata || {};
        const userMeta = user.user_metadata || {};
        const effectiveRole = appMeta.role || userMeta.role;
        const effectiveTenant = appMeta.tenant_id || userMeta.tenant_id;

        if (effectiveRole !== 'admin') {
            if (effectiveRole === 'dentist') {
                if (appointment.tenant_id !== effectiveTenant) {
                    throw new Error('Forbidden: Tenant mismatch');
                }
            } else {
                throw new Error('Forbidden: Insufficient permissions');
            }
        }

        // 4. Update Appointment Status
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
            .eq('id', appointment_id);

        if (updateError) throw new Error('Failed to cancel appointment');

        // 5. Log Action
        await supabaseAdmin.from('access_logs').insert({
            user_id: user.id,
            resource_type: 'appointment',
            resource_id: appointment_id,
            action: 'cancel_appointment',
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
            user_agent: req.headers.get('user-agent')
        });

        // 6. Notify Patient (Decrypt -> Send Email)
        if (appointment.patients) {
            try {
                const patientEmail = await decrypt(appointment.patients.email);
                const patientName = await decrypt(appointment.patients.full_name);

                // Format Date
                const dateObj = new Date(appointment.date);
                const readableDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

                // Simple Email Logic via Resend
                const resendApiKey = Deno.env.get('RESEND_API_KEY');
                if (resendApiKey) {
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: `${appointment.tenants?.display_name || 'Dentist App'} <bookings@resend.dev>`,
                            to: patientEmail,
                            subject: `Cancellation: Appointment on ${readableDate}`,
                            html: `
                                <p>Dear ${patientName},</p>
                                <p>Your appointment with <strong>${appointment.tenants?.display_name || 'us'}</strong> on ${readableDate} at ${appointment.time} has been cancelled.</p>
                                <p>Please contact us if you have any questions.</p>
                            `
                        })
                    });
                }
            } catch (notifyError) {
                console.error("Notification failed:", notifyError);
                // Non-blocking error
            }
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Appointment cancelled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
