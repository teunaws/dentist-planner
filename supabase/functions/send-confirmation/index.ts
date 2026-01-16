// Supabase Edge Function: Send Confirmation Email
// Sends transactional email confirmations for appointment bookings
// Uses Resend API for email delivery

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as Sentry from 'https://deno.land/x/sentry/index.mjs'
import { generateHTML } from './email-template.ts'

// Initialize Sentry for error tracking
Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  tracesSampleRate: 1.0,
  environment: Deno.env.get('ENVIRONMENT') || 'production',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

// Helper: Fetch with Timeout
// Prevents hanging if external APIs (Resend, GatewayAPI) are slow or unresponsive
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 5000): Promise<Response> => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err // Re-throw to be caught by caller
  }
}

// GatewayAPI.com SMS Helper Function
async function sendSms(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiToken = Deno.env.get('GATEWAYAPI_TOKEN')
  let sender = Deno.env.get('SMS_FROM_NAME') || 'DentistApp'

  if (!apiToken) {
    console.error('[send-confirmation] Missing GATEWAYAPI_TOKEN')
    return { success: false, error: 'GatewayAPI token not configured' }
  }

  // GatewayAPI requires non-numeric senders to be max 11 characters
  // Truncate if necessary and remove spaces (spaces count as characters)
  if (!/^\d+$/.test(sender)) {
    // Non-numeric sender - must be 11 chars or less
    sender = sender.replace(/\s+/g, '') // Remove spaces first
    if (sender.length > 11) {
      console.warn(`[send-confirmation] Sender name "${sender}" exceeds 11 characters, truncating to 11`)
      sender = sender.substring(0, 11)
    }
  }

  // GatewayAPI expects MSISDN format (numeric, no '+')
  // Strip non-numeric characters just in case
  const msisdn = to.replace(/[^0-9]/g, '')

  const payload = {
    sender: sender,
    message: text,
    recipients: [{ msisdn: msisdn }],
  }

  try {
    const response = await fetchWithTimeout(
      'https://gatewayapi.com/rest/mtsms',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(apiToken + ':'), // Basic Auth: Token as username, empty password
        },
        body: JSON.stringify(payload),
      },
      5000 // 5 second timeout
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[send-confirmation] GatewayAPI Error:', errorText)
      return { success: false, error: errorText }
    }

    const result = await response.json()

    // GatewayAPI returns an 'ids' array on success
    if (!result.ids || result.ids.length === 0) {
      console.error('[send-confirmation] GatewayAPI Error:', result)
      return { success: false, error: result.message || 'Unknown error from GatewayAPI' }
    }

    console.log(`[send-confirmation] SMS sent successfully via GatewayAPI (ID: ${result.ids[0]})`)
    return { success: true, messageId: result.ids[0].toString() }
  } catch (error) {
    // Check if error is due to timeout/abort
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.warn('[send-confirmation] SMS provider timed out after 5 seconds - continuing without SMS')
      return { success: false, error: 'SMS provider timeout - notification skipped' }
    }
    
    console.error('[send-confirmation] Error sending SMS:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

interface ConfirmationRequest {
  appointment_id: string
  patient_email: string
  patient_name: string
  patient_phone?: string // Optional phone number for SMS
  date: string // ISO date string (YYYY-MM-DD)
  time: string // e.g., "09:30 AM"
  service_name: string
  tenant_id: string // UUID of the tenant
  tenant_name: string // Fallback if tenant config not found
}

serve(async (req) => {
  // CRITICAL: Log immediately when function is invoked
  console.log('[send-confirmation] ===== FUNCTION INVOKED =====')
  console.log('[send-confirmation] Timestamp:', new Date().toISOString())
  console.log('[send-confirmation] Method:', req.method)
  console.log('[send-confirmation] URL:', req.url)
  console.log('[send-confirmation] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2))

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[send-confirmation] Handling OPTIONS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body = await req.json()
    console.log('[send-confirmation] Request payload:', JSON.stringify(body, null, 2))
    const payload: ConfirmationRequest = body

    // Validate required fields
    if (!payload.patient_email || !payload.patient_name || !payload.date || !payload.time || !payload.service_name || !payload.tenant_id) {
      const missingFields = []
      if (!payload.patient_email) missingFields.push('patient_email')
      if (!payload.patient_name) missingFields.push('patient_name')
      if (!payload.date) missingFields.push('date')
      if (!payload.time) missingFields.push('time')
      if (!payload.service_name) missingFields.push('service_name')
      if (!payload.tenant_id) missingFields.push('tenant_id')
      
      console.error('[send-confirmation] Missing required fields:', missingFields)
      return new Response(
        JSON.stringify({ error: 'Missing required fields', missing: missingFields }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('[send-confirmation] RESEND_API_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[send-confirmation] RESEND_API_KEY found, length:', resendApiKey.length)

    // Fetch tenant email configuration from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    
    let tenantConfig: any = null
    if (payload.tenant_id && supabaseUrl && supabaseServiceKey) {
      try {
        const tenantResponse = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${payload.tenant_id}&select=email_sender_name,email_sender_local_part,email_reply_to,email_confirmation_subject,email_confirmation_body,sms_confirmation_enabled,sms_confirmation_template,display_name`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json()
          if (tenantData && tenantData.length > 0) {
            tenantConfig = tenantData[0]
          }
        }
      } catch (error) {
        console.warn('[send-confirmation] Failed to fetch tenant config, using defaults:', error)
      }
    }

    // Format date for display (e.g., "Monday, January 15, 2024")
    const appointmentDate = new Date(payload.date)
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Variable replacement function
    const replaceVariables = (template: string): string => {
      return template
        .replace(/\{\{patient_name\}\}/g, payload.patient_name)
        .replace(/\{\{service_name\}\}/g, payload.service_name)
        .replace(/\{\{date\}\}/g, formattedDate)
        .replace(/\{\{time\}\}/g, payload.time)
        .replace(/\{\{tenant_name\}\}/g, tenantConfig?.display_name || payload.tenant_name)
        .replace(/\{\{location\}\}/g, '') // TODO: Add location if available
    }

    // Get email subject and body from tenant config or use defaults
    const emailSubject = replaceVariables(
      tenantConfig?.email_confirmation_subject || 
      'Appointment Confirmed: {{date}}'
    )
    
    const emailBodyText = replaceVariables(
      tenantConfig?.email_confirmation_body || 
      `Hi {{patient_name}},

Your appointment for {{service_name}} is confirmed for {{time}} on {{date}}.

We look forward to seeing you! If you need to reschedule or cancel, please contact us at least 24 hours in advance.`
    )

    // Get sender information
    const senderName = tenantConfig?.email_sender_name || payload.tenant_name
    const senderLocalPart = tenantConfig?.email_sender_local_part || 'bookings'
    const replyTo = tenantConfig?.email_reply_to || undefined

    // Generate beautiful HTML email using the pure template function
    const htmlContent = generateHTML({
      tenantName: tenantConfig?.display_name || payload.tenant_name,
      patientName: payload.patient_name,
      date: formattedDate,
      time: payload.time,
      service: payload.service_name,
      bodyText: emailBodyText, // Raw text from DB (variables already replaced)
      manageLink: undefined, // Optional - can be added later
    })

    // Send email via Resend API
    const emailPayload: any = {
      from: `${senderName} <${senderLocalPart}@resend.dev>`, // TODO: Update with your verified domain
      to: payload.patient_email,
      subject: emailSubject,
      html: htmlContent,
    }
    
    if (replyTo) {
      emailPayload.reply_to = replyTo
    }
    
    console.log('[send-confirmation] Sending email to Resend API:', {
      to: payload.patient_email,
      subject: emailPayload.subject,
      from: emailPayload.from,
    })
    
    let resendData: any
    try {
      const resendResponse = await fetchWithTimeout(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload),
        },
        5000 // 5 second timeout
      )

      console.log('[send-confirmation] Resend API response status:', resendResponse.status)

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text()
        console.error('[send-confirmation] Resend API error:', {
          status: resendResponse.status,
          statusText: resendResponse.statusText,
          error: errorText,
        })
        return new Response(
          JSON.stringify({ error: 'Failed to send email', details: errorText, status: resendResponse.status }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      resendData = await resendResponse.json()
      console.log('[send-confirmation] Email sent successfully:', {
        emailId: resendData.id,
        to: payload.patient_email,
      })
    } catch (err) {
      // Check if error is due to timeout/abort
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.error('[send-confirmation] Resend API timed out after 5 seconds')
        return new Response(
          JSON.stringify({ error: 'Email provider timed out', details: 'Resend API did not respond within 5 seconds' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Re-throw other errors
      throw err
    }

    // Send SMS confirmation if enabled and phone number provided
    let smsResult = null
    console.log('[send-confirmation] SMS check:', {
      smsEnabled: tenantConfig?.sms_confirmation_enabled,
      hasPhone: !!payload.patient_phone,
      phone: payload.patient_phone ? '***' + payload.patient_phone.slice(-4) : 'missing',
    })
    
    if (tenantConfig?.sms_confirmation_enabled && payload.patient_phone) {
      try {
        // Replace variables in SMS template
        const smsTemplate = tenantConfig.sms_confirmation_template || 
          'Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}.'
        
        const smsBody = smsTemplate
          .replace(/\{\{patient_name\}\}/g, payload.patient_name)
          .replace(/\{\{service_name\}\}/g, payload.service_name)
          .replace(/\{\{date\}\}/g, formattedDate)
          .replace(/\{\{time\}\}/g, payload.time)
          .replace(/\{\{tenant_name\}\}/g, tenantConfig.display_name || payload.tenant_name)
          .replace(/\{\{location\}\}/g, '') // TODO: Add location if available

        // Phone number formatting is handled inside sendSms function
        smsResult = await sendSms(payload.patient_phone, smsBody)
        if (smsResult.success) {
          console.log('[send-confirmation] SMS sent successfully:', smsResult.messageId)
        } else {
          console.error('[send-confirmation] SMS failed:', smsResult.error)
        }
      } catch (err) {
        // Swallow error - do not crash the function, so Email still tries to send
        console.error('[send-confirmation] SMS provider timed out or failed:', err)
        smsResult = { success: false, error: err.message || 'SMS provider error' }
      }
    } else {
      console.log('[send-confirmation] SMS skipped:', {
        reason: !tenantConfig?.sms_confirmation_enabled ? 'SMS not enabled for tenant' : 'No phone number provided',
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Confirmation sent',
        email_id: resendData.id,
        sms: smsResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[send-confirmation] Error:', error)
    
    // Capture error in Sentry
    Sentry.captureException(error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
