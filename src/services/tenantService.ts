import { supabase } from '../lib/supabase'
import { isPermissionError } from '../lib/supabaseErrors'
import { withTimeout } from '../lib/utils'
import type { TenantConfig, ServiceDefinition } from '../types/tenant'
import type { Appointment } from '../types'

// Helper to transform database tenant to TenantConfig
// CRITICAL: Uses SEQUENTIAL loading to prevent connection pool exhaustion
// and RLS recursion deadlocks. Slower but much safer.
// All data is now passed in as parameters (loaded sequentially in getTenantConfig)
// This function just transforms the data, no queries
const transformTenantToConfig = (
  tenant: any,
  services: any[] = [],
  slots: any[] = [],
  appointments: any[] = [],
  providers: any[] = []
): TenantConfig | null => {
  if (!tenant) return null

  // Transform services data
  const servicesList: ServiceDefinition[] = services.map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    duration: s.duration,
    price: s.price,
    perks: s.service_perks?.map((p: any) => p.perk_text) || [],
  }))

  // Transform slots data
  const slotsList = slots.map((s: any) => s.time_slot || s.time_slot)

  // Transform appointments data
  const appointmentsList: Appointment[] = appointments.map((a: any) => ({
    id: a.id,
    patientId: a.patient_id || '',
    patientName: a.patient_name,
    dentistId: a.dentist_id || '',
    dentistName: a.dentist_name || '',
    providerId: a.provider_id || undefined,
    providerName: a.providers?.name || undefined,
    date: a.date,
    time: a.time,
    type: a.service_type,
    status: a.status as 'Confirmed' | 'Pending' | 'Completed',
    notes: a.notes || '',
  }))

  // Note: durationMap is now built from services, not a separate query
  const durationMap: Record<string, number> = {}
  servicesList.forEach((s) => {
    durationMap[s.name] = s.duration
  })

  // Transform providers data
  const providersList = (providers || []).map((p: any) => ({
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    color: p.color || '#3b82f6',
    userId: p.user_id || null,
    isActive: p.is_active ?? true,
  }))

  return {
    id: tenant.id, // Explicitly map the UUID (CRITICAL: This is the database ID, not the slug!)
    slug: tenant.slug,
    displayName: tenant.display_name,
    hero: {
      eyebrow: tenant.hero_eyebrow || '',
      heading: tenant.hero_heading || '',
      subheading: tenant.hero_subheading || '',
    },
    services: servicesList,
    availability: {
      slots: slotsList,
    },
    sampleAppointments: appointmentsList.slice(0, 3), // First 3 as samples
    schedule: {
      appointments: appointmentsList,
      operatingHours: {
        startHour: tenant.operating_start_hour || 9,
        endHour: tenant.operating_end_hour || 17,
      },
      operatingHoursPerDay: tenant.operating_hours_per_day || undefined,
      durationMap,
    },
    bookingFormConfig: tenant.booking_form_config
      ? (tenant.booking_form_config as any)
      : undefined,
    theme: tenant.theme_accent_from
      ? {
        accentFrom: tenant.theme_accent_from,
        accentTo: tenant.theme_accent_to || tenant.theme_accent_from,
      }
      : undefined,
    isOnboarded: tenant.is_onboarded ?? false, // Explicitly map from database, default to false if missing
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
      confirmationEnabled: tenant.sms_confirmation_enabled || undefined,
      confirmationTemplate: tenant.sms_confirmation_template || undefined,
      reminderEnabled: tenant.sms_reminder_enabled || undefined,
      reminderTemplate: tenant.sms_reminder_template || undefined,
    },
    providers: providersList, // Include providers in config
    // Practice details
    address: tenant.address || undefined,
    timezone: tenant.timezone || 'America/New_York',
    phone: tenant.phone || undefined,
    email: tenant.email || undefined,
  }
}

export const tenantService = {
  /**
   * Get tenant configuration for public access (no authentication required)
   * This function is designed to work for anonymous users and should not
   * wait for or depend on authentication state.
   * 
   * CRITICAL: This function fires immediately without waiting for auth.
   * Even if a user is logged in, this query should work for any tenant
   * because RLS policies allow public read access.
   */
  async getTenantConfig(slug: string, retries = 2): Promise<TenantConfig> {
    // CRITICAL: Do NOT wait for auth session - fire immediately
    // This prevents frontend delays and ensures public pages load fast
    // RLS policies with public read access ensure this works for any tenant

    if (!slug || slug.trim() === '') {
      throw new Error('Practice slug is required')
    }

    // REMOVED: Health Check logic
    // REASON: It causes connection pool exhaustion during parallel testing.
    // The health check effectively doubles the HTTP request count (health check + main query),
    // which saturates the browser's connection limit (max 6) when running multiple tests in parallel.
    // If the main query fails, we catch and handle the error anyway.

    // Query tenant immediately (no auth dependency, no session wait)
    // The RLS policy "Enable Public Read Access" allows this to work
    // regardless of whether the user is logged in or which tenant they belong to
    // CRITICAL: Ensure we use the regular client (not admin client) to avoid conflicts
    console.log(`[tenantService] Step 1: Starting fetch for slug "${slug.trim()}"...`)

    let tenantResult
    try {
      console.log(`[tenantService] Step 1: Executing tenant query...`)
      tenantResult = await withTimeout(
        supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug.trim())
          .maybeSingle(),
        5000,
        'Fetch Tenant Row'
      )
      console.log(`[tenantService] Step 1: Tenant query completed successfully`)
    } catch (timeoutError: any) {
      console.error('[tenantService] Step 1: Tenant query timed out or failed:', timeoutError?.message || timeoutError)

      // Retry with exponential backoff if we have retries left
      if (retries > 0) {
        const delay = Math.pow(2, 2 - retries) * 2000 // 2000ms, 4000ms delays
        console.log(`[tenantService] Step 1: Retrying tenant query (${retries} retries left) after ${delay}ms delay...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.getTenantConfig(slug, retries - 1)
      }

      console.error('[tenantService] Step 1: This may indicate:', {
        message: 'Database connection pool exhaustion or RLS recursion',
        suggestion: 'If admin operations are running, they may be blocking regular queries. Try refreshing the page or restarting the Supabase database.'
      })
      throw new Error(`Request timed out while loading practice "${slug}". This may indicate a database connection issue, RLS policy blocking access, or connection pool exhaustion from admin operations.`)
    }

    const { data: tenant, error } = tenantResult as any

    if (error) {
      console.error('[tenantService] Failed to load tenant:', error)
      // Check for RLS errors - this is the critical issue
      if (isPermissionError(error)) {
        throw new Error(
          `Permission denied: Unable to access practice "${slug}". ` +
          `The database security policies may be blocking public access. ` +
          `Please run the fix_public_access.sql script to enable public read access.`
        )
      }
      // Check for "not found" errors
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        throw new Error(`Practice "${slug}" not found. Please check the URL and try again.`)
      }
      // Generic error
      throw new Error(`Failed to load practice "${slug}": ${error.message}`)
    }

    if (!tenant) {
      throw new Error(`Practice "${slug}" not found. Please check the URL and try again.`)
    }

    console.log(`[tenantService] Step 1 Success. Tenant ID: ${tenant.id}`)
    const tenantId = tenant.id

    // CRITICAL: Sequential loading to prevent connection pool exhaustion
    // and RLS recursion deadlocks. Load one query at a time.
    console.log('[tenantService] Step 2: Starting sequential data fetch...')

    // 1. Fetch Services (Sequential)
    console.log('[tenantService] Step 2.1: Starting services query...')
    let services, servicesError
    try {
      const result = await withTimeout(
        supabase
          .from('services')
          .select('*, service_perks(*)')
          .eq('tenant_id', tenantId)
          .order('display_order'),
        5000,
        'Fetch Services'
      )
      services = result.data
      servicesError = result.error
      console.log('[tenantService] Step 2.1: Services query completed')
    } catch (err: any) {
      console.error('[tenantService] Step 2.1: Services query timed out:', err?.message || err)
      servicesError = err
    }

    if (servicesError) {
      console.error('[tenantService] Step 2.1: Failed to load services:', servicesError)
    }

    // 2. Fetch Slots (Sequential)
    console.log('[tenantService] Step 2.2: Starting availability slots query...')
    let slots, slotsError
    try {
      const result = await withTimeout(
        supabase
          .from('availability_slots')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('display_order'),
        5000,
        'Fetch Availability Slots'
      )
      slots = result.data
      slotsError = result.error
      console.log('[tenantService] Step 2.2: Availability slots query completed')
    } catch (err: any) {
      console.error('[tenantService] Step 2.2: Availability slots query timed out:', err?.message || err)
      slotsError = err
    }

    if (slotsError) {
      console.error('[tenantService] Step 2.2: Failed to load availability slots:', slotsError)
    }

    // 3. Fetch Appointments (Sequential)
    console.log('[tenantService] Step 2.3: Starting appointments query...')
    let appointments, appointmentsError
    try {
      const result = await withTimeout(
        supabase
          .from('appointments')
          .select('*, providers(id, name)')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: true }),
        5000,
        'Fetch Appointments'
      )
      appointments = result.data
      appointmentsError = result.error
      console.log('[tenantService] Step 2.3: Appointments query completed')
    } catch (err: any) {
      console.error('[tenantService] Step 2.3: Appointments query timed out:', err?.message || err)
      appointmentsError = err
    }

    if (appointmentsError) {
      console.error('[tenantService] Step 2.3: Failed to load appointments:', appointmentsError)
    }

    // 4. Fetch Providers (Sequential) - Optional, don't fail if this errors
    console.log('[tenantService] Step 2.4: Starting providers query...')
    let providers, providersError
    try {
      const result = await withTimeout(
        supabase
          .from('providers')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        5000,
        'Fetch Providers'
      )
      providers = result.data
      providersError = result.error
      console.log('[tenantService] Step 2.4: Providers query completed')
    } catch (err: any) {
      console.error('[tenantService] Step 2.4: Providers query timed out:', err?.message || err)
      providersError = err
    }

    if (providersError) {
      console.warn('[tenantService] Step 2.4: Failed to load providers (non-critical):', providersError)
    }

    console.log('[tenantService] Step 3: All data loaded, transforming config...')

    // 5. Transform & Return
    const config = transformTenantToConfig(
      tenant,
      services || [],
      slots || [],
      appointments || [],
      providers || []
    )

    if (!config) {
      throw new Error(`Failed to load configuration for practice "${slug}"`)
    }

    if (!config) {
      throw new Error(`Failed to load configuration for practice "${slug}"`)
    }

    console.log('[tenantService] Step 3: Config transformation completed successfully')
    console.log('[tenantService] All steps completed. Returning config.')
    return config
  },
}
