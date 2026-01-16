import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analyticsService, type AnalyticsData } from '../services/analyticsService'
import type { TenantConfig, ServiceDefinition } from '../types/tenant'
import type { ProviderWithDetails, Appointment } from '../types'
import { supabase } from '../lib/supabase'


// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

interface TenantContextValue {
  slug: string
  config: TenantConfig | null
  isLoading: boolean
  error: string | null
  refresh: () => void
  updateConfig: (updates: Partial<TenantConfig>) => void
  tenantId: string | null
  isOnboarded: boolean | null
  // Dashboard tab data
  analyticsData: AnalyticsData | null
  isAnalyticsLoading: boolean
  refreshAnalytics: () => void
  // Team data
  providers: ProviderWithDetails[]
  isTeamLoading: boolean
  refreshTeam: () => void
  updateProviders: (providers: ProviderWithDetails[]) => void
  addProvider: (provider: ProviderWithDetails) => void
  removeProvider: (providerId: string) => void
}

// ------------------------------------------------------------------
// Constants & Helpers
// ------------------------------------------------------------------

const TenantContext = createContext<TenantContextValue | null>(null)

// System routes that do NOT need tenant config
const SYSTEM_ROUTES = ['admin', 'onboard', 'login']

const SYSTEM_TENANT_CONFIG: TenantConfig = {
  id: 'system',
  slug: 'admin',
  displayName: 'System Admin',
  isOnboarded: true,
  hero: {
    eyebrow: '',
    heading: 'Admin Portal',
    subheading: 'System Management',
  },
  theme: {
    accentFrom: '#0f172a', // Slate-900 (Admin colors)
    accentTo: '#334155',   // Slate-700
  },
  services: [],
  availability: {
    slots: [],
  },
  sampleAppointments: [],
  schedule: {
    appointments: [],
    operatingHours: {
      startHour: 9,
      endHour: 17,
    },
    durationMap: {},
  },
}

// Recursive Deep Merge Helper
function deepMerge(target: any, source: any): any {
  if (source === null || source === undefined) return target
  if (typeof target !== 'object' || target === null || typeof source !== 'object' || source === null) return source
  if (Array.isArray(source)) return source

  const result = Array.isArray(target) ? [...target] : { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]

      if (Array.isArray(sourceValue)) {
        result[key] = sourceValue
      } else if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
        if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          result[key] = deepMerge(targetValue, sourceValue)
        } else {
          result[key] = sourceValue
        }
      } else {
        result[key] = sourceValue
      }
    }
  }
  return result
}

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

  // Duration map from services
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
    id: tenant.id,
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
    isOnboarded: tenant.is_onboarded ?? false,
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
    providers: providersList,
    address: tenant.address || undefined,
    timezone: tenant.timezone || 'America/New_York',
    phone: tenant.phone || undefined,
    email: tenant.email || undefined,
  }
}

// ------------------------------------------------------------------
// Fetch Functions
// ------------------------------------------------------------------

const fetchTenantData = async (slug: string) => {
  if (!slug || slug.trim() === '') throw new Error('Practice slug is required')

  // 1. Fetch Tenant Row
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug.trim())
    .maybeSingle() as any

  if (tenantError) throw new Error(tenantError.message)
  if (!tenant) throw new Error(`Practice "${slug}" not found`)

  const tenantId = tenant.id

  // 2. Fetch All Related Data in Parallel
  const [
    servicesResult,
    slotsResult,
    appointmentsResult,
    providersResult
  ] = await Promise.all([
    // Services
    supabase
      .from('services')
      .select('*, service_perks(*)')
      .eq('tenant_id', tenantId)
      .order('display_order') as any,
    // Slots
    supabase
      .from('availability_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_order') as any,
    // Appointments
    supabase
      .from('appointments')
      .select('*, providers(id, name)')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }) as any,
    // Providers
    supabase
      .from('providers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true) as any
  ])

  // Check for errors (optional: we could be more granular, but for now throw if any critical one fails)
  if (servicesResult.error) throw new Error(`Failed to load services: ${servicesResult.error.message}`)
  if (slotsResult.error) throw new Error(`Failed to load slots: ${slotsResult.error.message}`)
  if (appointmentsResult.error) throw new Error(`Failed to load appointments: ${appointmentsResult.error.message}`)

  // Decrypt patient names in appointments
  // v2.1 Migration: Server-Side Encryption. we do NOT decrypt here.
  // The Dashboard should use generic labels or fetch details via Edge Function.
  // We mask the name to avoid showing ciphertext.
  const maskedAppointments = (appointmentsResult.data || []).map((a: any) => ({
    ...a,
    patient_name: '***', // Masked. Use getAppointmentDetails for plaintext.
    patient_email: '***',
    patient_phone: '***',
  }))

  return transformTenantToConfig(
    tenant,
    servicesResult.data || [],
    slotsResult.data || [],
    maskedAppointments,
    providersResult.data || [] // Providers are optional, don't throw if error
  )
}

// Custom Hook to run the queries
const useTenantData = (slug: string) => {
  const isSystem = SYSTEM_ROUTES.includes(slug.toLowerCase()) || slug === 'admin'

  return useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => isSystem ? Promise.resolve(SYSTEM_TENANT_CONFIG) : fetchTenantData(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}

// ------------------------------------------------------------------
// Provider Component
// ------------------------------------------------------------------

export const TenantProvider = ({
  slug,
  children,
}: {
  slug: string
  children: ReactNode
}) => {
  const queryClient = useQueryClient()
  const pathSegment = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[0] || '' : ''

  // Use current slug from props, or override if system route detected
  // Realistically the slug prop should be correct from the router, but we handle the edge case
  const efficientSlug = (SYSTEM_ROUTES.includes(pathSegment.toLowerCase()) || pathSegment === 'admin')
    ? 'admin'
    : slug

  // 1. Main Tenant Data Query
  const {
    data: config,
    isLoading,
    error: queryError,
    refetch: refresh
  } = useTenantData(efficientSlug)

  const tenantId = config?.id || null
  const isSystem = config?.id === 'system'

  // 2. Analytics Query (Dependent on tenantId)
  const analyticsQuery = useQuery({
    queryKey: ['analytics', tenantId],
    queryFn: () => analyticsService.getAnalyticsData(tenantId!),
    enabled: !!tenantId && !isSystem,
    staleTime: 10 * 60 * 1000,
  })

  // 3. Team/Providers Detail Query (Dependent on tenantId)
  // We fetch full provider details (services + schedules) separately
  const teamQuery = useQuery({
    queryKey: ['team', tenantId],
    queryFn: async () => {
      if (!tenantId || isSystem) return []

      // Load provider services (capabilities)
      const { data: providerServicesData, error: psError } = await supabase
        .from('provider_services')
        .select('provider_id, service_id, services!inner(id, name)')
        .in('provider_id', config?.providers?.map(p => p.id) || []) as any

      if (psError) throw psError

      // Load provider schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('provider_schedules')
        .select('*')
        .in('provider_id', config?.providers?.map(p => p.id) || []) as any

      if (schedulesError) throw schedulesError

      // Combine
      const basicProviders = config?.providers || []
      return basicProviders.map((p) => {
        const providerServices = providerServicesData
          ?.filter((ps: any) => ps.provider_id === p.id)
          .map((ps: any) => ({
            id: ps.service_id,
            name: (ps.services as any)?.name || '',
          })) || []

        const providerSchedules =
          schedulesData
            ?.filter((s: any) => s.provider_id === p.id)
            .map((s: any) => ({
              id: s.id,
              providerId: s.provider_id,
              dayOfWeek: s.day_of_week,
              startTime: s.start_time,
              endTime: s.end_time,
              isWorking: s.is_working,
            })) || []

        return {
          id: p.id,
          tenantId: p.tenantId,
          name: p.name,
          color: p.color || '#3b82f6',
          userId: p.userId || null,
          isActive: p.isActive,
          services: providerServices,
          schedules: providerSchedules,
        }
      })
    },
    enabled: !!tenantId && !isSystem && !!config?.providers?.length,
    staleTime: 5 * 60 * 1000,
  })

  // Optimistic Updates Helpers
  const updateConfig = useCallback((updates: Partial<TenantConfig>) => {
    queryClient.setQueryData(['tenant', efficientSlug], (old: TenantConfig | undefined) => {
      if (!old) return old
      return deepMerge(old, updates)
    })
  }, [queryClient, efficientSlug])

  const updateProviders = useCallback((newProviders: ProviderWithDetails[]) => {
    queryClient.setQueryData(['team', tenantId], newProviders)
  }, [queryClient, tenantId])

  const addProvider = useCallback((provider: ProviderWithDetails) => {
    queryClient.setQueryData(['team', tenantId], (old: ProviderWithDetails[] | undefined) => {
      return old ? [...old, provider] : [provider]
    })
  }, [queryClient, tenantId])

  const removeProvider = useCallback((providerId: string) => {
    queryClient.setQueryData(['team', tenantId], (old: ProviderWithDetails[] | undefined) => {
      return old ? old.filter(p => p.id !== providerId) : []
    })
  }, [queryClient, tenantId])


  const value = useMemo(
    () => ({
      slug: efficientSlug,
      config: config || null,
      isLoading: isLoading,
      error: queryError ? (queryError as Error).message : null,
      refresh: () => void refresh(),
      updateConfig,
      tenantId: tenantId,
      isOnboarded: config?.isOnboarded ?? null,

      // Analytics
      analyticsData: analyticsQuery.data || null,
      isAnalyticsLoading: analyticsQuery.isLoading,
      refreshAnalytics: () => void analyticsQuery.refetch(),

      // Team
      providers: teamQuery.data || [],
      isTeamLoading: teamQuery.isLoading,
      refreshTeam: () => void teamQuery.refetch(),
      updateProviders,
      addProvider,
      removeProvider,
    }),
    [
      efficientSlug,
      config,
      isLoading,
      queryError,
      refresh,
      updateConfig,
      tenantId,
      analyticsQuery.data,
      analyticsQuery.isLoading,
      analyticsQuery.refetch,
      teamQuery.data,
      teamQuery.isLoading,
      teamQuery.refetch,
      updateProviders,
      addProvider,
      removeProvider
    ],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
