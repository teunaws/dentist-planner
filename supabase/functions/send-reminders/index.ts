// Supabase Edge Function: Send SMS Reminders
// Sends SMS reminders for appointments scheduled for tomorrow
// Uses GatewayAPI.com for SMS delivery
// SECURITY: Only callable by cron job with service role key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppointmentReminder {
  id: string
  patient_name: string
  patient_phone: string | null
  date: string
  time: string
  service_type: string
  tenant_name: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // SECURITY: Verify this is called by cron job with service role key
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
    
    if (!authHeader || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the authorization header matches service role key
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid service role key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_URL not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get GatewayAPI credentials
    const gatewayApiToken = Deno.env.get('GATEWAYAPI_TOKEN')
    let smsFromName = Deno.env.get('SMS_FROM_NAME') || 'DentistApp'

    if (!gatewayApiToken) {
      console.error('[send-reminders] GatewayAPI token not set')
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GatewayAPI requires non-numeric senders to be max 11 characters
    // Truncate if necessary and remove spaces (spaces count as characters)
    if (!/^\d+$/.test(smsFromName)) {
      // Non-numeric sender - must be 11 chars or less
      smsFromName = smsFromName.replace(/\s+/g, '') // Remove spaces first
      if (smsFromName.length > 11) {
        console.warn(`[send-reminders] Sender name "${smsFromName}" exceeds 11 characters, truncating to 11`)
        smsFromName = smsFromName.substring(0, 11)
      }
    }

    // Calculate tomorrow's date range (23-25 hours from now)
    const now = new Date()
    const tomorrowStart = new Date(now)
    tomorrowStart.setHours(now.getHours() + 23, 0, 0, 0)
    
    const tomorrowEnd = new Date(now)
    tomorrowEnd.setHours(now.getHours() + 25, 0, 0, 0)

    const tomorrowStartStr = tomorrowStart.toISOString().split('T')[0]
    const tomorrowEndStr = tomorrowEnd.toISOString().split('T')[0]

    console.log(`[send-reminders] Fetching appointments for ${tomorrowStartStr} to ${tomorrowEndStr}`)

    // Query appointments scheduled for tomorrow that are not cancelled
    const { data: appointments, error: queryError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_name,
        patient_phone,
        date,
        time,
        service_type,
        status,
        tenant_id,
        tenants:tenant_id(display_name)
      `)
      .eq('date', tomorrowStartStr) // Appointments on tomorrow's date
      .neq('status', 'Cancelled')
      .neq('status', 'Blocked')

    if (queryError) {
      console.error('[send-reminders] Error querying appointments:', queryError)
      return new Response(
        JSON.stringify({ error: `Failed to fetch appointments: ${queryError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!appointments || appointments.length === 0) {
      console.log('[send-reminders] No appointments found for tomorrow')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No appointments to remind',
          count: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[send-reminders] Found ${appointments.length} appointments to remind`)

    // Process each appointment
    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const appointment of appointments) {
      // Skip if no phone number
      if (!appointment.patient_phone) {
        console.log(`[send-reminders] Skipping appointment ${appointment.id}: no phone number`)
        results.skipped++
        continue
      }

      // Format phone number (ensure it starts with +)
      let phoneNumber = appointment.patient_phone.trim()
      if (!phoneNumber.startsWith('+')) {
        // Assume US number if no country code
        phoneNumber = phoneNumber.replace(/^1/, '') // Remove leading 1 if present
        phoneNumber = `+1${phoneNumber.replace(/\D/g, '')}` // Keep only digits and add +1
      }

      // Format time for display
      const timeDisplay = appointment.time

      // Get tenant name (handle both object and array formats)
      const tenantName = appointment.tenants?.display_name || 
                        (Array.isArray(appointment.tenants) && appointment.tenants[0]?.display_name) || 
                        'your practice'

      // Create SMS message
      const message = `Reminder: You have an appointment at ${tenantName} tomorrow at ${timeDisplay}. Reply STOP to opt out.`

      try {
        // Send SMS via GatewayAPI.com
        // GatewayAPI expects MSISDN format (numeric, no '+')
        const msisdn = phoneNumber.replace(/[^0-9]/g, '')

        const payload = {
          sender: smsFromName,
          message: message,
          recipients: [{ msisdn: msisdn }],
        }

        // Add timeout protection: 5-second timeout to prevent hanging
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, 5000) // 5 seconds

        try {
          const gatewayResponse = await fetch('https://gatewayapi.com/rest/mtsms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + btoa(gatewayApiToken + ':'), // Basic Auth: Token as username, empty password
            },
            body: JSON.stringify(payload),
            signal: controller.signal, // Attach abort signal for timeout
          })

          clearTimeout(timeoutId) // Clear timeout if request completes

          if (!gatewayResponse.ok) {
            const errorText = await gatewayResponse.text()
            console.error(`[send-reminders] GatewayAPI error for appointment ${appointment.id}:`, errorText)
            results.failed++
            results.errors.push(`Appointment ${appointment.id}: ${errorText}`)
            continue
          }

          const gatewayData = await gatewayResponse.json()

          // GatewayAPI returns an 'ids' array on success
          if (!gatewayData.ids || gatewayData.ids.length === 0) {
            console.error(`[send-reminders] GatewayAPI API error for appointment ${appointment.id}:`, gatewayData)
            results.failed++
            results.errors.push(`Appointment ${appointment.id}: ${gatewayData.message || 'Unknown error from GatewayAPI'}`)
            continue
          }

          console.log(`[send-reminders] SMS sent successfully for appointment ${appointment.id} via GatewayAPI (ID: ${gatewayData.ids[0]})`)
          results.sent++
        } catch (error) {
          clearTimeout(timeoutId) // Ensure timeout is cleared even on error
          
          // Check if error is due to timeout/abort
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.warn(`[send-reminders] SMS provider timed out for appointment ${appointment.id} - skipping`)
            results.failed++
            results.errors.push(`Appointment ${appointment.id}: SMS provider timeout`)
            continue
          }
          
          // Other errors
          console.error(`[send-reminders] Error sending SMS for appointment ${appointment.id}:`, error)
          results.failed++
          results.errors.push(`Appointment ${appointment.id}: ${error.message || 'Unknown error'}`)
          continue
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[send-reminders] Error sending SMS for appointment ${appointment.id}:`, error)
        results.failed++
        results.errors.push(`Appointment ${appointment.id}: ${error.message || 'Unknown error'}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${appointments.length} appointments`,
        results: {
          sent: results.sent,
          failed: results.failed,
          skipped: results.skipped,
          total: appointments.length,
        },
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[send-reminders] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
