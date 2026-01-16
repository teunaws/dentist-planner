'use client'


import { useMemo, useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ShieldCheck, Filter } from 'lucide-react'
import { GlassCard } from '../../../../components/ui/GlassCard'
import { GlassButton } from '../../../../components/ui/GlassButton'
import { useAuthStore } from '../../../../store/authStore'
import { useTenant } from '../../../../context/TenantContext'
import type { Appointment, Provider } from '../../../../types'
import { BlockTimeModal } from '../../../../components/dentist/BlockTimeModal'
import { appointmentService } from '../../../../services/appointmentService'
import { supabase } from '../../../../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as availabilityService from '../../../../services/availabilityService'
import dynamic from 'next/dynamic'
import { AppointmentDetailsModal } from '../../../../components/calendar/AppointmentDetailsModal'
import { computeAppointmentLayout } from '../../../../utils/calendarLayout'
import type { LayoutAppointment } from '../../../../utils/calendarLayout'


// Dynamically import WeeklyCalendar component with no SSR to avoid hydration issues
const WeeklyCalendar = dynamic(
  () => import('../../../../components/dentist/WeeklyCalendar'),
  { ssr: false }
)

const getWeekWindow = (offsetWeeks = 0) => {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7)
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

const parseTimeToMinutes = (value: string) => {
  const [timePart, period] = value.split(' ')
  const [rawHours, rawMinutes] = timePart.split(':').map(Number)
  let hours24 = rawHours % 12
  if (period?.toUpperCase() === 'PM') {
    hours24 += 12
  }
  return hours24 * 60 + (rawMinutes || 0)
}

export default function DentistDashboard() {
  const { user, initialized, session, isLoading: isAuthLoading } = useAuthStore()
  const { config, slug, error: tenantError, isLoading: isLoadingTenant, tenantId, isOnboarded } = useTenant()
  const router = useRouter()
  const { tenant } = useParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false)
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Debug logging
  useEffect(() => {
    // ... (logging remains same)
  }, [initialized, user, session, slug, tenant, tenantId, isCheckingOnboarding, isOnboarded])

  const week = useMemo(() => getWeekWindow(weekOffset), [weekOffset])

  // REAL-TIME SCHEDULE FETCHING
  // 1. Fetch lightweight schedule using RPC
  const startDate = week[0].toISOString().split('T')[0]
  const endDate = week[6].toISOString().split('T')[0]

  console.log('[DentistDashboard] Query params:', { tenantId, startDate, endDate })

  const { data: appointmentData, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ['appointments', tenantId, startDate, endDate],
    queryFn: async () => {
      console.log('[DentistDashboard] Fetching schedule...')
      if (!tenantId) return []
      try {
        const data = await availabilityService.getTenantSchedule(tenantId, startDate, endDate)
        console.log('[DentistDashboard] Fetched data:', data)
        return data
      } catch (err) {
        console.error('[DentistDashboard] Fetch failed:', err)
        throw err
      }
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  })

  // Debug Data Flow
  console.log('[DentistDashboard] Debug:', { userTenantId: user?.tenant_id, contextTenantId: tenantId, hasQueryData: !!appointmentData })

  // Debug Query State
  useEffect(() => {
    console.log('[DentistDashboard] Query State:', {
      isLoading: isQueryLoading,
      hasData: !!appointmentData,
      error: queryError,
      dataLength: appointmentData?.length
    })
  }, [isQueryLoading, appointmentData, queryError])

  // 2. Map to UI Appointment format (handling missing PII)
  const appointments: Appointment[] = useMemo(() => {
    console.log('[DentistDashboard] Raw appointmentData:', appointmentData)
    const container = (appointmentData || []).map(apt => ({
      id: apt.id,
      tenantId: tenantId!,
      patientId: '', // Default for lightweight view
      patientName: apt.status === 'Blocked' ? 'Blocked' : 'Booked Patient', // Privacy by default
      patientEmail: '', // Not available in lightweight view
      patientPhone: '', // Not available in lightweight view
      dentistId: '', // Default
      dentistName: '', // Default
      date: apt.date,
      time: apt.time,
      type: apt.service_type,
      status: apt.status as any,
      notes: apt.notes || '',
      providerId: apt.provider_id || undefined,
      providerName: apt.providerName
    }))
    console.log('[DentistDashboard] Mapped appointments:', container)
    return container
  }, [appointmentData, tenantId])

  // 3. Real-time Subscription
  useEffect(() => {
    if (!tenantId) return

    console.log('[DentistDashboard] Subscribing to realtime updates for tenant:', tenantId)

    // Subscribe to ALL changes on appointments table for this tenant
    const channel = supabase
      .channel(`dashboard-appointments-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[DentistDashboard] Realtime update received:', payload.eventType)
          // Invalidate cache to trigger smart refetch via RPC
          queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
        }
      )
      .subscribe()

    return () => {
      console.log('[DentistDashboard] Unsubscribing from realtime updates')
      supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])

  const schedule = config?.schedule
  const operatingHours = schedule?.operatingHours ?? { startHour: 9, endHour: 17 }

  // Rest of the component...
  const START_HOUR = operatingHours.startHour
  const END_HOUR = operatingHours.endHour
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index)




  // 5. Calendar Data Processing (Memoized)
  const calendar = useMemo(() => {
    const groupedByDate: Record<string, LayoutAppointment[]> = {}

    // Initialize dates for the week
    week.forEach((date) => {
      groupedByDate[date.toDateString()] = []
    })

    const durationMap = config?.schedule?.durationMap || {}

    // Filter appointments for this week
    const start = week[0]
    const end = week[6]

    const filtered = selectedProviderId
      ? appointments.filter((apt) => apt.providerId === selectedProviderId)
      : appointments

    const relevant = filtered.filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate >= start && aptDate <= end
    })

    // Add items to their date groups
    relevant.forEach((apt) => {
      const key = new Date(apt.date).toDateString()
      if (groupedByDate[key]) {
        let duration: number | undefined = undefined;

        // Special handling for Blocked Time duration parsing
        if (apt.status === 'Blocked' || apt.type === 'Blocked Time') {
          duration = 60 // Default context-aware fallback
          if (apt.notes) {
            const durationMatch = apt.notes.match(/DURATION:\s*(\d+)/i)
            if (durationMatch) {
              duration = parseInt(durationMatch[1], 10)
            } else {
              const endTimeMatch = apt.notes.match(/END_TIME:\s*(\d{1,2}):(\d{2})/i)
              if (endTimeMatch) {
                const startTotal = parseTimeToMinutes(apt.time)
                const endTotal = parseInt(endTimeMatch[1], 10) * 60 + parseInt(endTimeMatch[2], 10)
                const diff = endTotal - startTotal
                if (diff > 0 && diff <= 480) duration = diff
              } else {
                duration = 30
              }
            }
          }
        }

        groupedByDate[key].push({
          ...apt,
          duration
        } as LayoutAppointment)
      }
    })

    // Compute Layouts for each day
    Object.keys(groupedByDate).forEach(key => {
      groupedByDate[key] = computeAppointmentLayout(
        groupedByDate[key],
        durationMap,
        START_HOUR,
        END_HOUR
      )
    })

    return groupedByDate
  }, [week, appointments, config, selectedProviderId, START_HOUR, END_HOUR])

  const handleWeekChange = (direction: 'prev' | 'next') => {
    setWeekOffset((prev) => prev + (direction === 'next' ? 1 : -1))
  }

  // CRITICAL: Redirect to login if user is not logged in (useEffect backup)
  // This ensures redirect happens even if render-phase check doesn't trigger
  // BUT only if tenant IS onboarded - don't redirect if tenant is not onboarded
  // Also wait for onboarding check to complete before redirecting
  useEffect(() => {
    // Don't redirect while onboarding is still being checked
    if (isCheckingOnboarding) {
      return
    }

    // Only redirect if tenant is explicitly onboarded (true)
    // If isOnboarded is false, show onboarding instead (isOnboarded is always boolean, never null)
    if (initialized && !user && isOnboarded === true) {
      const tenantSlug = slug || tenant || 'lumina'
      console.log('[DentistDashboard] useEffect: User not logged in, redirecting to login', {
        initialized,
        hasUser: !!user,
        tenantSlug,
        isOnboarded
      })
      // Clear any stale session
      if (session) {
        void supabase.auth.signOut()
      }
      router.replace(`/${tenantSlug}/login`)
      return
    }

    // CRITICAL: If user is logged in but has no tenant_id (tenant was deleted), redirect to login
    if (initialized && user && !user.tenant_id) {
      const tenantSlug = slug || tenant || 'lumina'
      console.log('[DentistDashboard] useEffect: User has no tenant_id (tenant deleted), redirecting to login', {
        userEmail: user.email,
        tenantSlug
      })
      // Sign out the user since their tenant no longer exists
      void supabase.auth.signOut()
      router.replace(`/${tenantSlug}/login`)
      return
    }
  }, [initialized, user, session, slug, tenant, isOnboarded, isCheckingOnboarding, router])

  // Redirect if user belongs to different tenant (useEffect for side effect)
  // BUT only if tenant IS onboarded - if tenant is not onboarded, show onboarding screen instead
  useEffect(() => {
    // Don't redirect while checking onboarding status
    if (isCheckingOnboarding) {
      return
    }

    // CRITICAL: Only redirect if tenant IS onboarded
    // If tenant is NOT onboarded, show onboarding screen instead (handled in render)
    if (initialized && user && tenantId && user.tenant_id && user.tenant_id !== tenantId && isOnboarded === true) {
      const tenantSlug = slug || tenant || 'lumina'
      console.log('[DentistDashboard] User belongs to different tenant (and tenant is onboarded), redirecting to login', {
        userTenantId: user.tenant_id,
        currentTenantId: tenantId,
        userEmail: user.email,
        tenantSlug,
        isOnboarded
      })
      router.replace(`/${tenantSlug}/login`)
    }
  }, [initialized, user, tenantId, slug, tenant, router, isOnboarded, isCheckingOnboarding])

  // Use tenant ID and onboarding status from TenantContext
  // This avoids duplicate queries and connection pool exhaustion
  useEffect(() => {
    // Once the context has finished loading (even if it failed), we're done checking
    // The context will set tenantId and isOnboarded when the tenant query completes
    if (!isLoadingTenant) {
      setIsCheckingOnboarding(false)
    }
  }, [isLoadingTenant])

  // Load providers
  useEffect(() => {
    if (!tenantId) return
    loadProviders()
  }, [tenantId])

  const loadProviders = async () => {
    if (!tenantId) return
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.warn('[DentistDashboard] Error loading providers:', error)
        return
      }

      setProviders(
        (data as any[])?.map((p) => ({
          id: p.id,
          tenantId: p.tenant_id,
          name: p.name,
          color: p.color || '#3b82f6',
          userId: p.user_id,
          isActive: p.is_active,
        })) || []
      )
    } catch (error) {
      console.error('[DentistDashboard] Failed to load providers:', error)
    }
  }

  // Create provider map for quick lookup
  const providerMap = useMemo(() => {
    const map = new Map<string, Provider>()
    providers.forEach((p) => map.set(p.id, p))
    return map
  }, [providers])

  const handleBlockTimeSuccess = (createdAppointment?: any) => {
    if (createdAppointment) {
      // Invalidate query to refetch schedule
      void queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
      console.log('✓ Blocked time added (invalidating cache)')
    }
  }

  const handleDeleteBlockedTime = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this blocked time?')) {
      return
    }

    try {
      // Delete in background
      await appointmentService.deleteBlockedTime(appointmentId)
      console.log('✓ Blocked time deleted successfully')

      // Invalidate query to refetch schedule
      void queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
    } catch (error) {
      console.error('Failed to delete blocked time:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete blocked time')
    }
  }

  const weekLabel = `${week[0].toLocaleDateString()} – ${week[6].toLocaleDateString()}`

  // CRITICAL: Show loading state while checking onboarding status OR waiting for auth to initialize
  // This prevents redirect logic from running while auth is still loading (race condition fix)
  if (isCheckingOnboarding || !initialized || isAuthLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="w-full max-w-md text-center text-slate-600">
          <p className="text-sm">Loading...</p>
        </GlassCard>
      </div>
    )
  }

  // If tenant doesn't exist (no config AND error), show error
  if (!config && tenantError && !isLoadingTenant) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="w-full max-w-md text-center text-slate-600">
          <p className="text-sm">{tenantError}</p>
        </GlassCard>
      </div>
    )
  }

  // CRITICAL: Show onboarding screen if tenant is NOT onboarded
  // This must happen BEFORE the login redirect check
  // Newly created tenants should show onboarding, not redirect to login
  // This screen is accessible WITHOUT being logged in
  // Show onboarding if isOnboarded is explicitly false
  // isOnboarded is now always a boolean (true/false) from TenantConfig, never null
  if (isOnboarded === false) {
    console.log('[DentistDashboard] Showing onboarding screen', {
      isOnboarded,
      tenantId,
      slug
    })
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Dentist Portal</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Setup Required</h2>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              This practice hasn't been set up yet. Complete the onboarding process to create your account and access the dentist portal.
            </p>
            <GlassButton
              onClick={() => router.push('/onboard')}
              className="w-full"
            >
              Start Onboarding
            </GlassButton>
          </div>
          <p className="text-xs text-slate-500">
            You'll need an onboarding code from your administrator to get started.
          </p>
        </GlassCard>
      </div>
    )
  }

  // CRITICAL: Redirect check happens AFTER onboarding check
  // Only redirect to login if tenant IS onboarded but user is NOT logged in
  // Do NOT redirect if tenant is not onboarded (show onboarding instead)
  // Do NOT redirect if onboarding status is still being checked
  if (initialized && !user && isOnboarded === true) {
    // Redirection handled in useEffect
    return null
  }

  // CRITICAL: If user is logged in but has no tenant_id (tenant was deleted), redirect to login
  // This handles the case where a user's tenant was deleted but they're still logged in
  if (initialized && user && !user.tenant_id) {
    // Redirection and signout handled in useEffect
    return null
  }

  // CRITICAL: If user is logged in, check if they belong to the current tenant
  // BUT only redirect if tenant IS onboarded - if tenant is not onboarded, show onboarding screen instead
  if (initialized && user && tenantId && user.tenant_id && user.tenant_id !== tenantId) {
    // If tenant is not onboarded, sign out and show onboarding screen (already handled above)
    if (isOnboarded !== true) {
      console.log('[DentistDashboard] User from different tenant, but current tenant not onboarded - signing out and showing onboarding', {
        userTenantId: user.tenant_id,
        currentTenantId: tenantId,
        userEmail: user.email,
        slug,
        isOnboarded
      })
      // Sign out the user from the other tenant
      void supabase.auth.signOut()
      // The onboarding screen will be shown (already handled above at line 338)
      // Return null to prevent rendering anything else while sign out is in progress
      return null
    }

    // If tenant IS onboarded, redirect to login
    // Redirection handled in useEffect
    return null
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header Strip - Same format as Analytics */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500">
            <CalendarDays className="h-4 w-4" />
            <span>{weekLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Provider Filter */}
          {providers.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={selectedProviderId || ''}
                onChange={(e) => setSelectedProviderId(e.target.value || null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              >
                <option value="">All Providers</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <GlassButton
            variant="secondary"
            onClick={() => setShowBlockTimeModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Block time
          </GlassButton>
        </div>
      </div>

      {/* Main Content - Fixed Height Container */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Calendar Card - Takes Full Height */}
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
          <GlassCard className="rounded-3xl p-4 flex flex-col overflow-hidden flex-1">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Weekly Calendar</h2>
                <p className="mt-0.5 text-xs text-slate-500">Continuous chair flow</p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => handleWeekChange('prev')}
                  className="rounded-full px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleWeekChange('next')}
                  className="rounded-full px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[600px] overflow-x-auto">
              {/* Temporary fix to prove it works */}
              <div className="h-[600px] w-full relative border border-transparent">
                <WeeklyCalendar
                  week={week}
                  hours={hours}
                  calendar={calendar}
                  providerMap={providerMap}
                  onDeleteBlockedTime={(id) => void handleDeleteBlockedTime(id)}
                  onAppointmentClick={(id) => setSelectedAppointmentId(id)}
                />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {showBlockTimeModal && tenantId && (
        <BlockTimeModal
          tenantId={tenantId}
          onClose={() => setShowBlockTimeModal(false)}
          onSuccess={handleBlockTimeSuccess}
        />
      )}

      {selectedAppointmentId && (
        <AppointmentDetailsModal
          appointmentId={selectedAppointmentId}
          isOpen={!!selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
        />
      )}
    </div>
  )
}
