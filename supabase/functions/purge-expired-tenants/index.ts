import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verify Authorization Header (Security)
        // The cron job sends "Authorization: Bearer <SERVICE_ROLE_KEY>"
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables')
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })

        // 3. Calculate Cutoff Date (Now - 30 Days)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)
        const cutoffISO = cutoffDate.toISOString()

        console.log(`[Reaper] Starting purge job. Cutoff date: ${cutoffISO}`)

        // 4. Query Expired Tenants
        // We only need the ID to delete them
        const { data: expiredTenants, error: fetchError } = await supabaseAdmin
            .from('tenants')
            .select('id, slug, deleted_at')
            .lt('deleted_at', cutoffISO)

        if (fetchError) {
            console.error('[Reaper] Error fetching expired tenants:', fetchError)
            throw new Error(`Failed to fetch expired tenants: ${fetchError.message}`)
        }

        console.log(`[Reaper] Found ${expiredTenants?.length || 0} tenants to purge.`)

        if (!expiredTenants || expiredTenants.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No expired tenants found to purge.', count: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Hard Delete Loop
        let deletedCount = 0
        const errors: any[] = []

        for (const tenant of expiredTenants) {
            try {
                console.log(`[Reaper] Purging tenant: ${tenant.slug} (${tenant.id})`)

                // DELETE CASCADE should handle related data if FKs are set up correctly.
                // If not, we might need to delete related data manually (appointments, patients, etc.) first.
                // Assuming database schema handles cascade delete for central tenant row.

                const { error: deleteError } = await supabaseAdmin
                    .from('tenants')
                    .delete()
                    .eq('id', tenant.id)

                if (deleteError) {
                    throw deleteError
                }

                deletedCount++
            } catch (err: any) {
                console.error(`[Reaper] Failed to purge tenant ${tenant.slug}:`, err)
                errors.push({ slug: tenant.slug, error: err.message })
            }
        }

        // 6. Report Results
        const result = {
            message: `Purge complete. Deleted ${deletedCount} tenants.`,
            count: deletedCount,
            errors: errors.length > 0 ? errors : undefined,
        }

        console.log(`[Reaper] Job finished. ${JSON.stringify(result)}`)

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[Reaper] Critical Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
