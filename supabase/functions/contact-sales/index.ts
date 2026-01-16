// Supabase Edge Function: Contact Sales
// Handles contact form submissions from potential customers
// Sends email to platform owner via Resend API
// Includes rate limiting to prevent abuse

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as Sentry from 'https://deno.land/x/sentry/index.mjs'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateContactHTML } from './email-template.ts'

// Initialize Sentry for error tracking
const sentryDsn = Deno.env.get('SENTRY_DSN')
console.log('[Sentry] Initializing... DSN exists:', !!sentryDsn)
console.log('[Sentry] Environment:', Deno.env.get('ENVIRONMENT') || 'production')

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 1.0,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
  })
  console.log('[Sentry] Initialized successfully')
} else {
  console.warn('[Sentry] WARNING: SENTRY_DSN not found in environment variables')
  console.warn('[Sentry] Make sure SENTRY_DSN is set in Supabase Secrets and function is redeployed')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 5 // Max requests per time window
const RATE_LIMIT_WINDOW_MS = 3600000 // 1 hour in milliseconds
const RATE_LIMIT_ENDPOINT = 'contact-sales'

/**
 * Check and update rate limit for a given IP address
 * Returns true if request should be allowed, false if rate limit exceeded
 */
async function checkRateLimit(clientIp: string): Promise<{ allowed: boolean; remaining?: number }> {
  try {
    // Create Supabase client with anon key for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Rate Limit] Missing Supabase credentials, skipping rate limit check')
      return { allowed: true } // Allow request if we can't check rate limit
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check existing rate limit record
    const { data: existingLimit, error: selectError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('ip', clientIp)
      .eq('endpoint', RATE_LIMIT_ENDPOINT)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected for new IPs
      console.error('[Rate Limit] Error checking rate limit:', selectError)
      return { allowed: true } // Allow request on error (fail open)
    }

    const now = new Date()
    
    if (existingLimit) {
      const lastRequestTime = new Date(existingLimit.last_request)
      const timeSinceLastRequest = now.getTime() - lastRequestTime.getTime()

      // If within time window and count exceeds limit, block request
      if (timeSinceLastRequest < RATE_LIMIT_WINDOW_MS && existingLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        const remainingTime = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLastRequest) / 1000 / 60) // minutes
        console.log(`[Rate Limit] Blocked request from ${clientIp}: ${existingLimit.count}/${RATE_LIMIT_MAX_REQUESTS} requests in last hour`)
        return { allowed: false, remaining: remainingTime }
      }

      // Reset count if time window has passed
      if (timeSinceLastRequest >= RATE_LIMIT_WINDOW_MS) {
        // Update: reset count and update timestamp
        const { error: updateError } = await supabase
          .from('rate_limits')
          .update({
            count: 1,
            last_request: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('ip', clientIp)
          .eq('endpoint', RATE_LIMIT_ENDPOINT)

        if (updateError) {
          console.error('[Rate Limit] Error resetting rate limit:', updateError)
        }
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
      }

      // Increment count (within time window, below limit)
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({
          count: existingLimit.count + 1,
          last_request: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('ip', clientIp)
        .eq('endpoint', RATE_LIMIT_ENDPOINT)

      if (updateError) {
        console.error('[Rate Limit] Error incrementing rate limit:', updateError)
      }

      const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - (existingLimit.count + 1))
      return { allowed: true, remaining }
    } else {
      // First request from this IP - create new record
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({
          ip: clientIp,
          endpoint: RATE_LIMIT_ENDPOINT,
          count: 1,
          last_request: now.toISOString(),
        })

      if (insertError) {
        console.error('[Rate Limit] Error creating rate limit record:', insertError)
      }

      return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
    }
  } catch (error) {
    console.error('[Rate Limit] Exception in rate limit check:', error)
    // Fail open - allow request if rate limit check fails
    return { allowed: true }
  }
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // TEST ENDPOINT - Remove after testing Sentry
  // Check query parameter more reliably
  const url = new URL(req.url)
  const testSentry = url.searchParams.get('test-sentry') === 'true'
  
  if (testSentry) {
    console.log('[Test] Triggering test error for Sentry')
    console.log('[Test] DSN available:', !!sentryDsn)
    try {
      throw new Error('Test Sentry error - this should appear in your Deno project dashboard')
    } catch (error) {
      console.log('[Test] Error caught, sending to Sentry...')
      if (sentryDsn) {
        Sentry.captureException(error)
        console.log('[Test] Error sent to Sentry (DSN was available)')
      } else {
        console.error('[Test] ERROR: Cannot send to Sentry - DSN not available!')
        console.error('[Test] Make sure SENTRY_DSN is set in Supabase Secrets')
      }
      
      return new Response(
        JSON.stringify({ 
          message: 'Test error triggered',
          sentryDsnAvailable: !!sentryDsn,
          error: error.message,
          note: 'Check your Deno project (not React project) in Sentry dashboard',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  try {
    // 2. Rate Limiting Check
    // Extract client IP from headers (x-forwarded-for is set by Supabase)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    
    console.log(`[Contact Sales] Rate limit check for IP: ${clientIp}`)
    
    const rateLimitResult = await checkRateLimit(clientIp)
    
    if (!rateLimitResult.allowed) {
      const remainingMinutes = rateLimitResult.remaining || 60
      console.log(`[Contact Sales] Rate limit exceeded for IP: ${clientIp}`)
      
      return new Response(
        JSON.stringify({ 
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${remainingMinutes} minute(s).`,
          retryAfter: remainingMinutes * 60, // seconds
        }),
        { 
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(remainingMinutes * 60),
          } 
        }
      )
    }

    console.log(`[Contact Sales] Rate limit check passed. Remaining requests: ${rateLimitResult.remaining ?? 'unknown'}`)

    // 3. Parse Body
    const { name, email, phone, practiceName, message } = await req.json()

    // 4. Validate required fields
    if (!name || !email || !phone || !practiceName || !message) {
      const missingFields = []
      if (!name) missingFields.push('name')
      if (!email) missingFields.push('email')
      if (!phone) missingFields.push('phone')
      if (!practiceName) missingFields.push('practiceName')
      if (!message) missingFields.push('message')

      console.error('[Contact Sales] Missing required fields:', missingFields)
      return new Response(
        JSON.stringify({ error: 'Missing required fields', missing: missingFields }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Load & Check Secrets
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL')

    // Debug Logs (Check Supabase Dashboard > Edge Functions > Logs if 500 occurs)
    console.log(`[Contact Sales] Request received for: ${practiceName}`)
    console.log(`[Contact Sales] Has Resend Key: ${!!RESEND_API_KEY}`)
    console.log(`[Contact Sales] Has Owner Email: ${!!OWNER_EMAIL}`)
    console.log(`[Contact Sales] Contact info: ${name}, ${email}, ${phone}`)

    if (!RESEND_API_KEY || !OWNER_EMAIL) {
      throw new Error('Server Misconfiguration: Missing API Keys')
    }

    // 7. Generate email HTML using template (matches confirmation email style)
    const emailHTML = generateContactHTML({
      name,
      email,
      phone,
      practiceName,
      message,
    })

    // 8. Send Email via Resend
    // Note: 'onboarding@resend.dev' ONLY works if sending TO the registered Resend account email.
    // If you verified a domain (e.g. updates.dentistplanner.com), change the 'from' below.
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Dentist Planner Leads <onboarding@resend.dev>',
        to: OWNER_EMAIL,
        reply_to: email,
        subject: `New Lead: ${practiceName}`,
        html: emailHTML,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Contact Sales] Resend API Error:', errorText)
      throw new Error(`Resend Rejected Email: ${errorText}`)
    }

    const data = await res.json()
    console.log('[Contact Sales] Email sent successfully:', data.id)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[Contact Sales] Function Error:', error)
    
    // Capture error in Sentry
    if (sentryDsn) {
      Sentry.captureException(error)
      console.log('[Contact Sales] Error sent to Sentry')
    } else {
      console.warn('[Contact Sales] WARNING: Error NOT sent to Sentry - DSN not available')
    }

    return new Response(JSON.stringify({ error: error.message || 'Unknown server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
