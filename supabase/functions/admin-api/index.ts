// Supabase Edge Function: Admin API
// Handles all admin operations that require service role access
// Deno runtime with Supabase client

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as Sentry from 'https://deno.land/x/sentry/index.mjs'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Sentry for error tracking
Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  tracesSampleRate: 1.0,
  environment: Deno.env.get('ENVIRONMENT') || 'production',
})

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

interface AdminAction {
  action: 'list_tenants' | 'create_tenant' | 'generate_onboarding_code' | 'get_tenant' | 'update_tenant' | 'delete_tenant' | 'restore_tenant' | 'update_tenant_services'
  payload?: any
}

interface UserData {
  role: string
  tenant_id: string | null
}

interface TenantConfig {
  id: string // The database UUID (not the slug!)
  slug: string
  displayName: string
  deletedAt?: string // Add deletedAt to interface
  hero: {
    eyebrow: string
    heading: string
    subheading: string
  }
  services?: Array<{
    id?: string
    name: string
    description: string
    duration: number
    price: string
    perks?: string[]
  }>
  availability?: {
    slots: string[]
  }
  sampleAppointments?: any[]
  schedule?: {
    appointments?: any[]
    operatingHours: {
      startHour: number
      endHour: number
    }
    operatingHoursPerDay?: any
    durationMap?: Record<string, number>
  }
  bookingFormConfig?: any
  theme?: {
    accentFrom: string
    accentTo: string
  }
  isOnboarded?: boolean
  emailConfig?: {
    senderName?: string
    senderLocalPart?: string
    replyTo?: string
    confirmationEnabled?: boolean
    confirmationSubject?: string
    confirmationBody?: string
    reminderEnabled?: boolean
    reminderSubject?: string
    reminderBody?: string
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key
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

    // Verify user is authenticated and is an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user role and tenant_id by querying public.users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { action, payload }: AdminAction = await req.json()

    console.log(`[admin-api] Action: ${action}`, { userId: user.id, userRole: userData.role })

    // Route to appropriate handler with user context
    switch (action) {
      case 'list_tenants':
        // Only admins can list all tenants
        if (userData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleListTenants(supabaseAdmin, payload, corsHeaders)

      case 'get_tenant':
        // Admins can get any tenant, dentists can get their own
        return await handleGetTenant(supabaseAdmin, payload?.slug, corsHeaders, userData)

      case 'create_tenant':
        // Only admins can create tenants
        if (userData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleCreateTenant(supabaseAdmin, payload, corsHeaders)

      case 'update_tenant':
        // Admins can update any tenant, dentists can only update their own
        if (userData.role === 'admin') {
          // Platform admins can update any tenant
          return await handleUpdateTenant(supabaseAdmin, payload, corsHeaders, userData)
        } else if (userData.role === 'dentist') {
          // Dentists can ONLY update their OWN tenant
          // Verify the tenant slug belongs to their tenant_id
          if (!userData.tenant_id) {
            return new Response(
              JSON.stringify({ error: 'Forbidden: Dentist must be assigned to a tenant' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Fetch the tenant to verify ownership
          const { data: tenantCheck, error: tenantCheckError } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('slug', payload?.slug)
            .single()

          if (tenantCheckError || !tenantCheck) {
            return new Response(
              JSON.stringify({ error: 'Tenant not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Verify the tenant ID matches the dentist's tenant_id
          if (tenantCheck.id !== userData.tenant_id) {
            console.error(`[admin-api] Dentist ${user.id} attempted to update wrong tenant. User tenant: ${userData.tenant_id}, Target tenant: ${tenantCheck.id}`)
            return new Response(
              JSON.stringify({ error: 'Forbidden: You can only update your own tenant' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Dentist is authorized to update their own tenant
          return await handleUpdateTenant(supabaseAdmin, payload, corsHeaders, userData)
        } else {
          // Other roles (patient) cannot update tenants
          return new Response(
            JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'delete_tenant':
        // Only admins can delete tenants
        if (userData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleDeleteTenant(supabaseAdmin, payload?.slug, corsHeaders)

      case 'restore_tenant':
        // Only admins can restore tenants
        if (userData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleRestoreTenant(supabaseAdmin, payload?.slug, corsHeaders)

      case 'update_tenant_services':
        // Admins can update any tenant's services, dentists can update their own
        return await handleUpdateTenantServices(supabaseAdmin, payload, corsHeaders, userData)

      case 'generate_onboarding_code':
        // Only admins can generate onboarding codes
        if (userData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleGenerateOnboardingCode(supabaseAdmin, payload, corsHeaders)

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('[admin-api] Error:', error)

    // Capture error in Sentry
    Sentry.captureException(error)

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper: Transform database tenant to TenantConfig
async function transformTenantToConfig(supabaseAdmin: any, tenant: any): Promise<TenantConfig | null> {
  if (!tenant) return null

  const [servicesResult, slotsResult, appointmentsResult, durationsResult] = await Promise.allSettled([
    supabaseAdmin
      .from('services')
      .select('*, service_perks(*)')
      .eq('tenant_id', tenant.id)
      .order('display_order'),
    supabaseAdmin
      .from('availability_slots')
      .select('time_slot')
      .eq('tenant_id', tenant.id)
      .order('display_order'),
    supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('date', { ascending: true }),
    supabaseAdmin
      .from('appointment_durations')
      .select('service_type, duration_minutes')
      .eq('tenant_id', tenant.id),
  ])

  const services = servicesResult.status === 'fulfilled' && servicesResult.value.data
    ? servicesResult.value.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      duration: s.duration,
      price: s.price,
      perks: s.service_perks?.map((p: any) => p.perk_text) || [],
    }))
    : []

  const slots = slotsResult.status === 'fulfilled' && slotsResult.value.data
    ? slotsResult.value.data.map((s: any) => s.time_slot)
    : []

  const appointments = appointmentsResult.status === 'fulfilled' && appointmentsResult.value.data
    ? appointmentsResult.value.data.map((a: any) => ({
      id: a.id,
      patientId: a.patient_id || '',
      patientName: a.patient_name,
      dentistId: a.dentist_id || '',
      dentistName: a.dentist_name || '',
      date: a.date,
      time: a.time,
      type: a.service_type,
      status: a.status,
      notes: a.notes || '',
    }))
    : []

  const durationMap: Record<string, number> = {}
  if (durationsResult.status === 'fulfilled' && durationsResult.value.data) {
    durationsResult.value.data.forEach((d: any) => {
      durationMap[d.service_type] = d.duration_minutes
    })
  }

  return {
    id: tenant.id, // Explicitly map the UUID (CRITICAL: This is the database ID, not the slug!)
    slug: tenant.slug,
    displayName: tenant.display_name,
    hero: {
      eyebrow: tenant.hero_eyebrow || '',
      heading: tenant.hero_heading || '',
      subheading: tenant.hero_subheading || '',
    },
    services,
    availability: { slots },
    sampleAppointments: appointments.slice(0, 3),
    schedule: {
      appointments,
      operatingHours: {
        startHour: tenant.operating_start_hour || 9,
        endHour: tenant.operating_end_hour || 17,
      },
      operatingHoursPerDay: tenant.operating_hours_per_day || undefined,
      durationMap,
    },
    bookingFormConfig: tenant.booking_form_config || undefined,
    theme: tenant.theme_accent_from
      ? {
        accentFrom: tenant.theme_accent_from,
        accentTo: tenant.theme_accent_to || tenant.theme_accent_from,
      }
      : undefined,
    isOnboarded: tenant.is_onboarded ?? false, // Explicitly map from database
    emailConfig: {
      senderName: tenant.email_sender_name || undefined,
      senderLocalPart: tenant.email_sender_local_part || undefined,
      replyTo: tenant.email_reply_to || undefined,
      confirmationEnabled: tenant.email_confirmation_enabled !== undefined ? tenant.email_confirmation_enabled : undefined,
      confirmationSubject: tenant.email_confirmation_subject || undefined,
      confirmationBody: tenant.email_confirmation_body || undefined,
      reminderEnabled: tenant.email_reminder_enabled !== undefined ? tenant.email_reminder_enabled : undefined,
      reminderSubject: tenant.email_reminder_subject || undefined,
      reminderBody: tenant.email_reminder_body || undefined,
    },
    smsConfig: {
      confirmationEnabled: tenant.sms_confirmation_enabled ?? false,
      confirmationTemplate: tenant.sms_confirmation_template || undefined,
      reminderEnabled: tenant.sms_reminder_enabled ?? false,
      reminderTemplate: tenant.sms_reminder_template || undefined,
    },
    // Practice details
    address: tenant.address || undefined,
    timezone: tenant.timezone || 'America/New_York',
    phone: tenant.phone || undefined,
    email: tenant.email || undefined,
    deletedAt: tenant.deleted_at || undefined,
  }
}

// Handler: List all tenants
async function handleListTenants(supabaseAdmin: any, payload: any, corsHeaders: any) {
  // Extract pagination parameters (default to page 1, limit 10)
  const page = payload?.page || 1
  const limit = payload?.limit || 10
  const offset = (page - 1) * limit

  const showDeleted = payload?.showDeleted || false

  console.log('[admin-api] Listing tenants with pagination:', { page, limit, offset, showDeleted })

  // Build query
  let query = supabaseAdmin
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Filter out deleted tenants unless showDeleted is true
  if (!showDeleted) {
    query = query.is('deleted_at', null)
  }

  // Execute query
  const { data: tenants, error, count } = await query

  if (error) {
    console.error('[admin-api] Error fetching tenants:', error)
    return new Response(
      JSON.stringify({ error: `Failed to fetch tenants: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!tenants || tenants.length === 0) {
    return new Response(
      JSON.stringify({ data: { tenants: [], count: count || 0 } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Transform paginated tenants
  const configs = await Promise.all(
    tenants.map((tenant) => transformTenantToConfig(supabaseAdmin, tenant))
  )

  return new Response(
    JSON.stringify({
      data: {
        tenants: configs.filter((c) => c !== null),
        count: count || 0
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Get single tenant
async function handleGetTenant(supabaseAdmin: any, slug: string, corsHeaders: any, userData?: UserData) {
  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Tenant slug is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !tenant) {
    return new Response(
      JSON.stringify({ error: 'Tenant not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // If user is a dentist, verify they belong to this tenant
  if (userData && userData.role === 'dentist' && userData.tenant_id !== tenant.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: You can only access your own tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const config = await transformTenantToConfig(supabaseAdmin, tenant)
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'Failed to transform tenant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ data: config }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Create tenant
async function handleCreateTenant(supabaseAdmin: any, config: TenantConfig, corsHeaders: any) {
  if (!config || !config.slug) {
    return new Response(
      JSON.stringify({ error: 'Invalid tenant configuration' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Insert tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      slug: config.slug,
      display_name: config.displayName,
      hero_eyebrow: config.hero.eyebrow,
      hero_heading: config.hero.heading,
      hero_subheading: config.hero.subheading,
      operating_start_hour: config.schedule?.operatingHours.startHour || 9,
      operating_end_hour: config.schedule?.operatingHours.endHour || 17,
      theme_accent_from: config.theme?.accentFrom,
      theme_accent_to: config.theme?.accentTo,
    })
    .select()
    .single()

  if (tenantError || !tenant) {
    return new Response(
      JSON.stringify({ error: `Failed to create tenant: ${tenantError?.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Insert availability slots if provided
  if (config.availability?.slots && config.availability.slots.length > 0) {
    const { error: slotsError } = await supabaseAdmin.from('availability_slots').insert(
      config.availability.slots.map((slot, index) => ({
        tenant_id: tenant.id,
        time_slot: slot,
        display_order: index,
      }))
    )

    if (slotsError) {
      console.error('Failed to insert availability slots:', slotsError)
      // Don't fail - slots are optional
    }
  }

  // Transform and return
  const tenantConfig = await transformTenantToConfig(supabaseAdmin, tenant)
  if (!tenantConfig) {
    return new Response(
      JSON.stringify({ error: 'Failed to transform tenant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ data: tenantConfig }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Update tenant
async function handleUpdateTenant(supabaseAdmin: any, payload: { slug: string; updates: Partial<TenantConfig> }, corsHeaders: any, userData?: UserData) {
  if (!payload?.slug || !payload?.updates) {
    return new Response(
      JSON.stringify({ error: 'Slug and updates are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('[admin-api] Update tenant request:', {
    slug: payload.slug,
    updatesKeys: Object.keys(payload.updates),
    hasSchedule: !!payload.updates.schedule,
    hasBookingFormConfig: !!payload.updates.bookingFormConfig,
    hasDisplayName: !!payload.updates.displayName,
    hasAddress: payload.updates.address !== undefined,
    hasTimezone: payload.updates.timezone !== undefined,
    hasPhone: payload.updates.phone !== undefined,
    hasEmail: payload.updates.email !== undefined,
    hasEmailConfig: !!payload.updates.emailConfig,
    hasSmsConfig: !!payload.updates.smsConfig,
    addressValue: payload.updates.address,
    timezoneValue: payload.updates.timezone,
    phoneValue: payload.updates.phone,
    emailValue: payload.updates.email,
  })
  console.log('[admin-api] Full updates payload:', JSON.stringify(payload.updates, null, 2))

  const updateData: any = {}
  if (payload.updates.slug) updateData.slug = payload.updates.slug
  if (payload.updates.displayName) updateData.display_name = payload.updates.displayName
  if (payload.updates.hero) {
    updateData.hero_eyebrow = payload.updates.hero.eyebrow
    updateData.hero_heading = payload.updates.hero.heading
    updateData.hero_subheading = payload.updates.hero.subheading
  }
  // Practice details
  if (payload.updates.address !== undefined) {
    updateData.address = payload.updates.address || null
    console.log('[admin-api] Setting address to:', updateData.address)
  }
  if (payload.updates.timezone !== undefined) {
    updateData.timezone = payload.updates.timezone
    console.log('[admin-api] Setting timezone to:', updateData.timezone)
  }
  if (payload.updates.phone !== undefined) {
    updateData.phone = payload.updates.phone || null
    console.log('[admin-api] Setting phone to:', updateData.phone)
  }
  if (payload.updates.email !== undefined) {
    updateData.email = payload.updates.email || null
    console.log('[admin-api] Setting email to:', updateData.email)
  }
  if (payload.updates.schedule?.operatingHours) {
    updateData.operating_start_hour = payload.updates.schedule.operatingHours.startHour
    updateData.operating_end_hour = payload.updates.schedule.operatingHours.endHour
  }
  if (payload.updates.schedule?.operatingHoursPerDay) {
    try {
      // Ensure operatingHoursPerDay is properly formatted as JSON
      updateData.operating_hours_per_day = JSON.parse(JSON.stringify(payload.updates.schedule.operatingHoursPerDay))
    } catch (e) {
      console.error('[admin-api] Error serializing operatingHoursPerDay:', e)
      return new Response(
        JSON.stringify({ error: 'Invalid operating hours format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }
  if (payload.updates.bookingFormConfig) {
    try {
      // Ensure bookingFormConfig is properly formatted as JSON
      updateData.booking_form_config = JSON.parse(JSON.stringify(payload.updates.bookingFormConfig))
      console.log('[admin-api] Setting booking_form_config to:', JSON.stringify(updateData.booking_form_config, null, 2))
    } catch (e) {
      console.error('[admin-api] Error serializing bookingFormConfig:', e)
      // Don't fail the entire update if bookingFormConfig has issues
      // Just log and skip it
      console.warn('[admin-api] Skipping bookingFormConfig update due to serialization error')
    }
  } else {
    console.log('[admin-api] No bookingFormConfig in updates payload')
  }
  // Email configuration
  if (payload.updates.emailConfig) {
    console.log('[admin-api] Processing emailConfig update:', JSON.stringify(payload.updates.emailConfig, null, 2))
    console.log('[admin-api] emailConfig keys:', Object.keys(payload.updates.emailConfig))
    console.log('[admin-api] confirmationEnabled in emailConfig?', 'confirmationEnabled' in payload.updates.emailConfig)
    console.log('[admin-api] reminderEnabled in emailConfig?', 'reminderEnabled' in payload.updates.emailConfig)

    if (payload.updates.emailConfig.senderName !== undefined) {
      updateData.email_sender_name = payload.updates.emailConfig.senderName
    }
    if (payload.updates.emailConfig.senderLocalPart !== undefined) {
      updateData.email_sender_local_part = payload.updates.emailConfig.senderLocalPart
    }
    if (payload.updates.emailConfig.replyTo !== undefined) {
      updateData.email_reply_to = payload.updates.emailConfig.replyTo
    }
    // Always check for boolean values explicitly (including false)
    // Use 'in' operator to check if property exists, even if value is false
    if ('confirmationEnabled' in payload.updates.emailConfig) {
      const value = payload.updates.emailConfig.confirmationEnabled
      // Convert to explicit boolean (handles true, false, "true", "false", etc.)
      updateData.email_confirmation_enabled = Boolean(value)
      console.log('[admin-api] Setting email_confirmation_enabled to:', updateData.email_confirmation_enabled, '(raw value:', value, ', type:', typeof value, ')')
    } else {
      console.log('[admin-api] confirmationEnabled NOT in emailConfig object')
    }
    if (payload.updates.emailConfig.confirmationSubject !== undefined) {
      updateData.email_confirmation_subject = payload.updates.emailConfig.confirmationSubject
    }
    if (payload.updates.emailConfig.confirmationBody !== undefined) {
      updateData.email_confirmation_body = payload.updates.emailConfig.confirmationBody
    }
    // Always check for boolean values explicitly (including false)
    if ('reminderEnabled' in payload.updates.emailConfig) {
      const value = payload.updates.emailConfig.reminderEnabled
      // Convert to explicit boolean (handles true, false, "true", "false", etc.)
      updateData.email_reminder_enabled = Boolean(value)
      console.log('[admin-api] Setting email_reminder_enabled to:', updateData.email_reminder_enabled, '(raw value:', value, ', type:', typeof value, ')')
    } else {
      console.log('[admin-api] reminderEnabled NOT in emailConfig object')
    }
    if (payload.updates.emailConfig.reminderSubject !== undefined) {
      updateData.email_reminder_subject = payload.updates.emailConfig.reminderSubject
    }
    if (payload.updates.emailConfig.reminderBody !== undefined) {
      updateData.email_reminder_body = payload.updates.emailConfig.reminderBody
    }
  } else {
    console.log('[admin-api] No emailConfig in updates payload')
  }
  // SMS configuration
  if (payload.updates.smsConfig) {
    console.log('[admin-api] Updating SMS config:', JSON.stringify(payload.updates.smsConfig, null, 2))
    if (payload.updates.smsConfig.confirmationEnabled !== undefined) {
      updateData.sms_confirmation_enabled = payload.updates.smsConfig.confirmationEnabled
      console.log('[admin-api] Setting sms_confirmation_enabled to:', payload.updates.smsConfig.confirmationEnabled)
    }
    if (payload.updates.smsConfig.confirmationTemplate !== undefined) {
      updateData.sms_confirmation_template = payload.updates.smsConfig.confirmationTemplate
    }
    if (payload.updates.smsConfig.reminderEnabled !== undefined) {
      updateData.sms_reminder_enabled = payload.updates.smsConfig.reminderEnabled
    }
    if (payload.updates.smsConfig.reminderTemplate !== undefined) {
      updateData.sms_reminder_template = payload.updates.smsConfig.reminderTemplate
    }
  } else {
    console.log('[admin-api] No smsConfig in updates payload')
  }

  console.log('[admin-api] Final updateData:', JSON.stringify(updateData, null, 2))

  // Check if there are any fields to update
  if (Object.keys(updateData).length === 0) {
    console.log('[admin-api] No fields to update, fetching current tenant')
    // No updates needed, just return the current tenant
    const { data: currentTenant, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('slug', payload.slug)
      .single()

    if (fetchError || !currentTenant) {
      return new Response(
        JSON.stringify({ error: `Tenant not found: ${fetchError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantConfig = await transformTenantToConfig(supabaseAdmin, currentTenant)
    if (!tenantConfig) {
      return new Response(
        JSON.stringify({ error: 'Failed to transform tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ data: tenantConfig }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let tenant, error
  try {
    console.log('[admin-api] Executing database update with:', JSON.stringify(updateData, null, 2))
    const result = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('slug', payload.slug)
      .select()
      .single()

    tenant = result.data
    error = result.error

    if (tenant) {
      console.log('[admin-api] Database update successful. Updated tenant data:', {
        address: tenant.address,
        timezone: tenant.timezone,
        phone: tenant.phone,
        email: tenant.email,
        booking_form_config: tenant.booking_form_config,
        email_confirmation_enabled: tenant.email_confirmation_enabled,
        email_reminder_enabled: tenant.email_reminder_enabled,
        sms_confirmation_enabled: tenant.sms_confirmation_enabled,
        sms_reminder_enabled: tenant.sms_reminder_enabled,
      })
      console.log('[admin-api] Email toggle values after update:', {
        email_confirmation_enabled: tenant.email_confirmation_enabled,
        email_reminder_enabled: tenant.email_reminder_enabled,
      })
    }
  } catch (e) {
    console.error('[admin-api] Exception during database update:', e)
    return new Response(
      JSON.stringify({
        error: `Database update exception: ${e instanceof Error ? e.message : String(e)}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (error || !tenant) {
    console.error('[admin-api] Database update error:', error)
    console.error('[admin-api] Update data that failed:', JSON.stringify(updateData, null, 2))
    console.error('[admin-api] Error code:', error?.code)
    console.error('[admin-api] Error details:', error?.details)
    console.error('[admin-api] Error hint:', error?.hint)
    console.error('[admin-api] Error message:', error?.message)

    // Check if error is due to missing column
    const errorMessage = error?.message || ''
    if (errorMessage.includes("Could not find the") && errorMessage.includes("column")) {
      // Try updating without the problematic column
      const columnName = errorMessage.match(/'(\w+)'/)?.[1]
      if (columnName && updateData[columnName]) {
        console.warn(`[admin-api] Column ${columnName} doesn't exist, retrying without it`)
        delete updateData[columnName]

        // Retry the update without the missing column
        const retryResult = await supabaseAdmin
          .from('tenants')
          .update(updateData)
          .eq('slug', payload.slug)
          .select()
          .single()

        if (retryResult.error || !retryResult.data) {
          return new Response(
            JSON.stringify({
              error: `Failed to update tenant: ${retryResult.error?.message || 'Unknown error'}`,
              details: retryResult.error?.details || null,
              hint: retryResult.error?.hint || null,
              code: retryResult.error?.code || null,
              note: `Column ${columnName} was skipped as it doesn't exist in the database`
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        tenant = retryResult.data
        error = null
      }
    }

    // If we still have an error after retry, return it
    if (error || !tenant) {
      return new Response(
        JSON.stringify({
          error: `Failed to update tenant: ${error?.message || 'Unknown error'}`,
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Update availability slots if provided
  if (payload.updates.availability?.slots) {
    // Delete existing slots
    await supabaseAdmin.from('availability_slots').delete().eq('tenant_id', tenant.id)

    // Insert new slots
    if (payload.updates.availability.slots.length > 0) {
      await supabaseAdmin.from('availability_slots').insert(
        payload.updates.availability.slots.map((slot, index) => ({
          tenant_id: tenant.id,
          time_slot: slot,
          display_order: index,
        }))
      )
    }
  }

  const tenantConfig = await transformTenantToConfig(supabaseAdmin, tenant)
  if (!tenantConfig) {
    return new Response(
      JSON.stringify({ error: 'Failed to transform tenant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ data: tenantConfig }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Delete tenant (Soft Delete)
async function handleDeleteTenant(supabaseAdmin: any, slug: string, corsHeaders: any) {
  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Tenant slug is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify tenant exists
  const { data: tenant, error: fetchError } = await supabaseAdmin
    .from('tenants')
    .select('id, display_name')
    .eq('slug', slug)
    .single()

  if (fetchError || !tenant) {
    return new Response(
      JSON.stringify({ error: `Tenant "${slug}" not found` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Soft Delete: Update deleted_at to NOW
  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('slug', slug)

  if (updateError) {
    return new Response(
      JSON.stringify({ error: `Failed to delete tenant: ${updateError.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Restore tenant
async function handleRestoreTenant(supabaseAdmin: any, slug: string, corsHeaders: any) {
  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Tenant slug is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify tenant exists (even if deleted)
  const { data: tenant, error: fetchError } = await supabaseAdmin
    .from('tenants')
    .select('id, display_name')
    .eq('slug', slug)
    .single()

  if (fetchError || !tenant) {
    return new Response(
      JSON.stringify({ error: `Tenant "${slug}" not found` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Restore: Set deleted_at to NULL
  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ deleted_at: null })
    .eq('slug', slug)

  if (updateError) {
    return new Response(
      JSON.stringify({ error: `Failed to restore tenant: ${updateError.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Update tenant services
async function handleUpdateTenantServices(supabaseAdmin: any, payload: { slug: string; services: any[] }, corsHeaders: any, userData: UserData) {
  if (!payload?.slug || !payload?.services) {
    return new Response(
      JSON.stringify({ error: 'Slug and services are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get tenant ID
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', payload.slug)
    .single()

  if (tenantError || !tenant) {
    return new Response(
      JSON.stringify({ error: `Tenant ${payload.slug} not found` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // If user is a dentist, verify they belong to this tenant
  if (userData.role === 'dentist' && userData.tenant_id !== tenant.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: You can only update services for your own tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Delete existing services (cascade will handle perks)
  await supabaseAdmin.from('services').delete().eq('tenant_id', tenant.id)

  // Insert new services
  if (payload.services.length > 0) {
    const servicesToInsert = payload.services.map((service, index) => ({
      tenant_id: tenant.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price,
      display_order: index,
    }))

    const { data: insertedServices, error: servicesError } = await supabaseAdmin
      .from('services')
      .insert(servicesToInsert)
      .select()

    if (servicesError || !insertedServices) {
      return new Response(
        JSON.stringify({ error: `Failed to insert services: ${servicesError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert perks
    const perksToInsert: any[] = []
    payload.services.forEach((service, serviceIndex) => {
      if (service.perks && service.perks.length > 0) {
        service.perks.forEach((perk, perkIndex) => {
          perksToInsert.push({
            service_id: insertedServices[serviceIndex].id,
            perk_text: perk,
            display_order: perkIndex,
          })
        })
      }
    })

    if (perksToInsert.length > 0) {
      await supabaseAdmin.from('service_perks').insert(perksToInsert)
    }
  }

  // Return updated config
  const { data: fullTenant, error: fetchError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', payload.slug)
    .single()

  if (fetchError || !fullTenant) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch updated tenant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const tenantConfig = await transformTenantToConfig(supabaseAdmin, fullTenant)
  if (!tenantConfig) {
    return new Response(
      JSON.stringify({ error: 'Failed to transform tenant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ data: tenantConfig }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: Generate onboarding code
async function handleGenerateOnboardingCode(supabaseAdmin: any, payload: { tenantId: string; expiresInDays?: number }, corsHeaders: any) {
  if (!payload?.tenantId) {
    return new Response(
      JSON.stringify({ error: 'Tenant ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const expiresInDays = payload.expiresInDays || 30

  // Generate random code
  const generateRandomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Ensure code is unique
  let code = generateRandomCode()
  let attempts = 0

  while (attempts < 10) {
    const { data: existing } = await supabaseAdmin
      .from('onboarding_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (!existing) {
      break // Code is unique
    }

    code = generateRandomCode()
    attempts++
  }

  if (attempts === 10) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate unique code after multiple attempts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Insert code
  const { data, error } = await supabaseAdmin
    .from('onboarding_codes')
    .insert({
      tenant_id: payload.tenantId,
      code,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: `Failed to generate code: ${error?.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ data: { code: data.code } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

