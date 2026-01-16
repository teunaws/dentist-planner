'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Edit, Trash2, Save, X, Clock } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { GlassCard } from '../../../../components/ui/GlassCard'
import { GlassButton } from '../../../../components/ui/GlassButton'
import { GlassInput } from '../../../../components/ui/GlassInput'
import { GlassBadge } from '../../../../components/ui/GlassBadge'
import { useTenant } from '../../../../context/TenantContext'
import { useAuthStore } from '../../../../store/authStore'
import { supabase } from '../../../../lib/supabase'
import type { Provider, ProviderWithDetails, ProviderSchedule, ServiceDefinition } from '../../../../types'
import { notifications } from '../../../../lib/notifications'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
]

export default function TeamPage() {
  // const { tenant } = useParams() // Handled via context
  const {
    config,
    tenantId,
    providers,
    updateProviders,
    addProvider,
    removeProvider,
    isTeamLoading,
    refreshTeam
  } = useTenant()
  const { user } = useAuthStore()
  const [services, setServices] = useState<ServiceDefinition[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  // Store original provider state when editing starts (for cancel without refresh)
  const [originalProviderSnapshot, setOriginalProviderSnapshot] = useState<ProviderWithDetails | null>(null)

  // Use services from context
  useEffect(() => {
    if (config?.services && config.services.length > 0) {
      setServices(config.services)
    }
  }, [config?.services])

  // Reload specific providers after save (updates global context)
  const reloadProviders = async (providerIds: string[]): Promise<void> => {
    if (!tenantId || providerIds.length === 0) return Promise.resolve()

    try {
      // Load only the specified providers
      const { data: providersData, error: providersError } = await supabase
        .from('providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', providerIds)

      if (providersError) throw providersError

      // Load provider services (capabilities)
      const { data: providerServicesData, error: psError } = await supabase
        .from('provider_services')
        .select('provider_id, service_id, services!inner(id, name)')
        .in('provider_id', providerIds)

      if (psError) throw psError

      // Load provider schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('provider_schedules')
        .select('*')
        .in('provider_id', providerIds)

      if (schedulesError) throw schedulesError

      // Combine data for these providers
      const updatedProviders: ProviderWithDetails[] =
        providersData?.map((p) => {
          const providerServices = providerServicesData
            ?.filter((ps) => ps.provider_id === p.id)
            .map((ps) => ({
              id: ps.service_id,
              name: (ps.services as any)?.name || '',
            })) || []

          const providerSchedules =
            schedulesData
              ?.filter((s) => s.provider_id === p.id)
              .map((s) => ({
                id: s.id,
                providerId: s.provider_id,
                dayOfWeek: s.day_of_week,
                startTime: s.start_time,
                endTime: s.end_time,
                isWorking: s.is_working,
              })) || []

          return {
            id: p.id,
            tenantId: p.tenant_id,
            name: p.name,
            color: p.color || DEFAULT_COLORS[0],
            userId: p.user_id,
            isActive: p.is_active,
            services: providerServices,
            schedules: providerSchedules,
          }
        }) || []

      // Update global context state
      updateProviders(prev => {
        const updated = [...prev]
        updatedProviders.forEach((updatedProvider) => {
          const index = updated.findIndex((p) => p.id === updatedProvider.id)
          if (index >= 0) {
            updated[index] = updatedProvider
          } else {
            updated.push(updatedProvider)
          }
        })
        return updated
      })
    } catch (error) {
      console.error('Failed to reload providers:', error)
      // Fallback: Refresh context
      refreshTeam()
    }
  }

  // DEPRECATED: Use TenantContext instead of fetching providers independently
  // This function is kept as a fallback only
  const loadData = async () => {
    if (!tenantId) return
    setIsLoading(true)
    try {
      // Use services from context if available
      if (config?.services && config.services.length > 0) {
        setServices(config.services)
      } else {
        // Fallback: Load services if not in context
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('display_order')

        if (servicesError) throw servicesError
        setServices(
          servicesData?.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description || '',
            duration: s.duration,
            price: s.price,
            perks: [],
          })) || []
        )
      }

      // CRITICAL: Use providers from context instead of fetching
      // This prevents double-fetching and connection pool exhaustion
      if (config?.providers && config.providers.length > 0) {
        // Use providers from context and just load their details
        await loadFullProviderDetails(config.providers.map(p => p.id))
        return
      }

      // Fallback: Only fetch if not in context (shouldn't happen in normal flow)
      const { data: providersData, error: providersError } = await supabase
        .from('providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name')

      if (providersError) throw providersError

      // Load provider services (capabilities)
      const { data: providerServicesData, error: psError } = await supabase
        .from('provider_services')
        .select('provider_id, service_id, services!inner(id, name)')
        .in(
          'provider_id',
          providersData?.map((p) => p.id) || []
        )

      if (psError) throw psError

      // Load provider schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('provider_schedules')
        .select('*')
        .in(
          'provider_id',
          providersData?.map((p) => p.id) || []
        )

      if (schedulesError) throw schedulesError

      // Combine data
      const providersWithDetails: ProviderWithDetails[] =
        providersData?.map((p) => {
          const providerServices = providerServicesData
            ?.filter((ps) => ps.provider_id === p.id)
            .map((ps) => ({
              id: ps.service_id,
              name: (ps.services as any)?.name || '',
            })) || []

          const providerSchedules =
            schedulesData
              ?.filter((s) => s.provider_id === p.id)
              .map((s) => ({
                id: s.id,
                providerId: s.provider_id,
                dayOfWeek: s.day_of_week,
                startTime: s.start_time,
                endTime: s.end_time,
                isWorking: s.is_working,
              })) || []

          return {
            id: p.id,
            tenantId: p.tenant_id,
            name: p.name,
            color: p.color || DEFAULT_COLORS[0],
            userId: p.user_id,
            isActive: p.is_active,
            services: providerServices,
            schedules: providerSchedules,
          }
        }) || []

      setProviders(providersWithDetails)
    } catch (error) {
      console.error('Failed to load team data:', error)
      notifications.error('Failed to load team data')
    } finally {
      setIsLoading(false)
    }
  }

  // Redirect if not a dentist
  const router = useRouter()
  const currentSlug = config?.slug || 'lumina'

  useEffect(() => {
    if (user && user.role !== 'dentist') {
      router.replace(`/${currentSlug}/login`)
    }
  }, [user, currentSlug, router])

  if (!user || user.role !== 'dentist') {
    return null
  }

  const handleSave = async () => {
    if (!tenantId) return

    // Validate all providers before saving
    const errors: Record<string, string> = {}
    for (const provider of providers) {
      if (!provider.name || provider.name.trim() === '') {
        errors[provider.id] = 'Provider name is required'
      }
    }

    // If there are validation errors, show them and stop
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      notifications.error('Please enter a name for all providers before saving')
      return
    }

    // Clear any previous validation errors
    setValidationErrors({})

    setIsSaving(true)
    try {
      const savedProviders: Array<{ oldId: string; newId: string; provider: ProviderWithDetails }> = []

      // Save all providers
      for (const provider of providers) {
        // Check if this is a new provider (temporary ID)
        const isNewProvider = provider.id.startsWith('provider-')

        let actualProviderId: string

        if (isNewProvider) {
          // New provider: Insert without ID, let database generate UUID
          const { data: newProvider, error: providerError } = await supabase
            .from('providers')
            .insert({
              tenant_id: tenantId,
              name: provider.name,
              color: provider.color,
              user_id: provider.userId || null,
              is_active: provider.isActive,
            })
            .select()
            .single()

          if (providerError) throw providerError
          if (!newProvider) throw new Error('Failed to create provider')

          actualProviderId = newProvider.id

          // Store mapping for optimistic update
          savedProviders.push({
            oldId: provider.id,
            newId: actualProviderId,
            provider: {
              ...provider,
              id: actualProviderId,
              tenantId: tenantId,
            }
          })
        } else {
          // Existing provider: Update with existing ID
          const { error: providerError } = await supabase
            .from('providers')
            .update({
              tenant_id: tenantId,
              name: provider.name,
              color: provider.color,
              user_id: provider.userId || null,
              is_active: provider.isActive,
              updated_at: new Date().toISOString(),
            })
            .eq('id', provider.id)

          if (providerError) throw providerError
          actualProviderId = provider.id

          // Store for optimistic update
          savedProviders.push({
            oldId: provider.id,
            newId: actualProviderId,
            provider: provider
          })
        }

        // Parallel execution: Delete existing services and schedules simultaneously
        const deleteServicesPromise = supabase.from('provider_services').delete().eq('provider_id', actualProviderId)
        const deleteSchedulesPromise = supabase.from('provider_schedules').delete().eq('provider_id', actualProviderId)

        await Promise.all([deleteServicesPromise, deleteSchedulesPromise])

        // Parallel execution: Insert new services and schedules simultaneously
        const insertPromises: Promise<any>[] = []

        if (provider.services.length > 0) {
          insertPromises.push(
            supabase.from('provider_services').insert(
              provider.services.map((s) => ({
                provider_id: actualProviderId,
                service_id: s.id,
              }))
            )
          )
        }

        if (provider.schedules.length > 0) {
          insertPromises.push(
            supabase.from('provider_schedules').insert(
              provider.schedules.map((schedule) => ({
                provider_id: actualProviderId,
                day_of_week: schedule.dayOfWeek,
                start_time: schedule.startTime,
                end_time: schedule.endTime,
                is_working: schedule.isWorking,
              }))
            )
          )
        }

        // Execute all inserts in parallel
        if (insertPromises.length > 0) {
          const results = await Promise.all(insertPromises)
          // Check for errors
          for (const result of results) {
            if (result.error) throw result.error
          }
        }
      }

      notifications.success('Team saved successfully')

      // OPTIMISTIC UI UPDATE: Update global context state immediately
      // This makes the UI feel instant while the background refresh happens

      // Update providers in global context with the saved data
      // For new providers, replace temporary IDs with real IDs
      updateProviders(prev => {
        return prev.map((p) => {
          // Find if this provider was just saved
          const saved = savedProviders.find(sp => sp.oldId === p.id)

          if (saved) {
            // Update with the new ID and saved data
            return saved.provider
          }

          // Provider wasn't modified, keep as is
          return p
        })
      })

      // Close UI immediately (optimistic update)
      setEditingId(null)
      setShowAddForm(false)

      // Background refresh: Reload full details and update context (non-blocking)
      const savedProviderIds = savedProviders.map(sp => sp.newId)
      if (savedProviderIds.length > 0) {
        // Load full details in the background (non-blocking)
        // Use setTimeout to make it truly async and non-blocking
        setTimeout(() => {
          reloadProviders(savedProviderIds).catch(err => {
            console.error('Background reload failed:', err)
          })
        }, 0)
      }

      // NOTE: We intentionally skip calling refresh() here to avoid the 5-second delay
      // The local state is already updated optimistically, and reloadProviders() will
      // update the full provider details. The TenantContext will be refreshed on next
      // page navigation or manual refresh, which is acceptable for better UX.
    } catch (error) {
      console.error('Failed to save team:', error)
      notifications.error('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddProvider = () => {
    // Prevent adding a new provider if a form is already open
    if (editingId !== null || showAddForm) {
      return
    }

    const newProvider: ProviderWithDetails = {
      id: `provider-${Date.now()}`,
      tenantId: tenantId || '',
      name: '',
      color: DEFAULT_COLORS[providers.length % DEFAULT_COLORS.length],
      isActive: true,
      services: [],
      schedules: DAYS_OF_WEEK.map((day) => ({
        id: `schedule-${Date.now()}-${day.value}`,
        providerId: `provider-${Date.now()}`,
        dayOfWeek: day.value,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isWorking: day.value !== 0 && day.value !== 6, // Not working on weekends by default
      })),
    }
    // Add to global context
    addProvider(newProvider)
    setEditingId(newProvider.id)
    setShowAddForm(true)
  }

  // Check if any form is currently open
  const isFormOpen = editingId !== null || showAddForm

  const handleUpdateProvider = (id: string, updates: Partial<ProviderWithDetails>) => {
    updateProviders(
      providers.map((p) =>
        p.id === id
          ? {
            ...p,
            ...updates,
          }
          : p
      )
    )
  }

  const handleDeleteProvider = (id: string) => {
    if (!confirm('Are you sure you want to delete this provider? This will also remove their schedules and capabilities.')) {
      return
    }

    // Check if this is a new provider (temporary ID) - just remove from context
    if (id.startsWith('provider-')) {
      removeProvider(id)
      // Close any open forms if this provider was being edited
      if (editingId === id) {
        setEditingId(null)
        setShowAddForm(false)
      }
      return
    }

    // OPTIMISTIC UPDATE: Remove provider from global context immediately
    const providerToDelete = providers.find((p) => p.id === id)
    removeProvider(id)

    // Close any open forms if this provider was being edited
    if (editingId === id) {
      setEditingId(null)
      setShowAddForm(false)
    }

    // Delete from database in the background (fire and forget)
    void (async () => {
      try {
        console.log('[TeamPage] Deleting provider in background:', id)

        // Delete provider services (capabilities) - CASCADE should handle this, but being explicit
        await supabase.from('provider_services').delete().eq('provider_id', id)

        // Delete provider schedules - CASCADE should handle this, but being explicit
        await supabase.from('provider_schedules').delete().eq('provider_id', id)

        // Delete the provider itself
        const { error } = await supabase.from('providers').delete().eq('id', id)

        if (error) {
          throw error
        }

        console.log('[TeamPage] Provider deleted successfully from database')
        notifications.success('Provider deleted successfully')
      } catch (error) {
        console.error('[TeamPage] Failed to delete provider from database:', error)

        // ROLLBACK: Restore the provider if deletion failed
        if (providerToDelete) {
          addProvider(providerToDelete)
        }

        notifications.error('Failed to delete provider. It has been restored.')
      }
    })()
  }

  const handleToggleService = (providerId: string, serviceId: string) => {
    updateProviders(
      providers.map((p) => {
        if (p.id !== providerId) return p
        const hasService = p.services.some((s) => s.id === serviceId)
        if (hasService) {
          return {
            ...p,
            services: p.services.filter((s) => s.id !== serviceId),
          }
        } else {
          const service = services.find((s) => s.id === serviceId)
          if (!service) return p
          return {
            ...p,
            services: [...p.services, { id: service.id, name: service.name }],
          }
        }
      })
    )
  }

  const handleUpdateSchedule = (
    providerId: string,
    dayOfWeek: number,
    updates: Partial<ProviderSchedule>
  ) => {
    updateProviders(
      providers.map((p) => {
        if (p.id !== providerId) return p
        return {
          ...p,
          schedules: p.schedules.map((s) =>
            s.dayOfWeek === dayOfWeek ? { ...s, ...updates } : s
          ),
        }
      })
    )
  }

  // Stale-While-Revalidate: Render immediately with cached data from context
  // Only show loading if we have absolutely NO data to show
  if (!config) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center text-slate-600">Loading tenant configuration...</GlassCard>
      </div>
    )
  }

  // Only show loading spinner if we have no providers data at all AND we're actively loading
  // Providers are now loaded globally, so we check the global state
  if (isTeamLoading && providers.length === 0 && !config?.providers) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center text-slate-600">Loading team...</GlassCard>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
        </div>
        <div className="flex gap-2">
          <GlassButton onClick={handleAddProvider} disabled={isFormOpen || isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </GlassButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Only show "No Providers" if we're sure there are none (check both local state and config) */}
          {providers.length === 0 && (!config?.providers || config.providers.length === 0) ? (
            <GlassCard className="rounded-3xl p-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
              <h2 className="mb-2 text-lg font-semibold text-slate-900">No Providers Yet</h2>
              <p className="mb-4 text-sm text-slate-500">
                Add your first team member to get started with multi-provider scheduling.
              </p>
              <GlassButton onClick={handleAddProvider} disabled={isFormOpen || isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </GlassButton>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {providers
                .sort((a, b) => {
                  // Sort so that providers being edited (or new providers) appear first
                  const aIsEditing = editingId === a.id
                  const bIsEditing = editingId === b.id
                  if (aIsEditing && !bIsEditing) return -1
                  if (!aIsEditing && bIsEditing) return 1
                  return 0
                })
                .map((provider) => (
                  <GlassCard key={provider.id} className="rounded-3xl p-6 space-y-4 border border-white/20">
                    {editingId === provider.id ? (
                      <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <GlassInput
                            label="Provider Name"
                            value={provider.name}
                            onChange={(e) => {
                              handleUpdateProvider(provider.id, { name: e.target.value })
                              // Clear validation error when user starts typing
                              if (validationErrors[provider.id]) {
                                setValidationErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors[provider.id]
                                  return newErrors
                                })
                              }
                            }}
                            placeholder="Dr. Jane Smith"
                            required
                            error={validationErrors[provider.id]}
                          />
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                              Color
                            </label>
                            <div className="flex gap-2">
                              {DEFAULT_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => handleUpdateProvider(provider.id, { color })}
                                  className={`h-8 w-8 rounded-full border-2 transition ${provider.color === color
                                    ? 'border-slate-900 scale-110'
                                    : 'border-slate-300 hover:border-slate-500'
                                    }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Capabilities */}
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">
                            Capabilities (Which services can this provider perform?)
                          </label>
                          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {services.map((service) => {
                              const isSelected = provider.services.some((s) => s.id === service.id)
                              return (
                                <label
                                  key={service.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleService(provider.id, service.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                  />
                                  <span className="text-sm text-slate-700">{service.name}</span>
                                </label>
                              )
                            })}
                          </div>
                          {provider.services.length === 0 && (
                            <p className="mt-2 text-xs text-amber-600">
                              ⚠️ No services selected. This provider won't be available for bookings.
                            </p>
                          )}
                        </div>

                        {/* Schedule */}
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">
                            Weekly Schedule
                          </label>
                          <div className="space-y-2">
                            {DAYS_OF_WEEK.map((day) => {
                              const schedule = provider.schedules.find((s) => s.dayOfWeek === day.value)
                              if (!schedule) return null
                              return (
                                <div
                                  key={day.value}
                                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                                >
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={schedule.isWorking}
                                      onChange={(e) =>
                                        handleUpdateSchedule(provider.id, day.value, {
                                          isWorking: e.target.checked,
                                        })
                                      }
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="w-20 text-sm font-medium text-slate-700">
                                      {day.label}
                                    </span>
                                  </label>
                                  {schedule.isWorking && (
                                    <div className="flex items-center gap-2">
                                      <GlassInput
                                        type="time"
                                        value={schedule.startTime.substring(0, 5)}
                                        onChange={(e) =>
                                          handleUpdateSchedule(provider.id, day.value, {
                                            startTime: `${e.target.value}:00`,
                                          })
                                        }
                                        className="w-32"
                                      />
                                      <span className="text-sm text-slate-500">to</span>
                                      <GlassInput
                                        type="time"
                                        value={schedule.endTime.substring(0, 5)}
                                        onChange={(e) =>
                                          handleUpdateSchedule(provider.id, day.value, {
                                            endTime: `${e.target.value}:00`,
                                          })
                                        }
                                        className="w-32"
                                      />
                                    </div>
                                  )}
                                  {!schedule.isWorking && (
                                    <span className="text-xs text-slate-400">Not working</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                          <GlassButton
                            onClick={() => {
                              // If this is a new provider (temporary ID), remove it from context
                              if (provider.id.startsWith('provider-')) {
                                removeProvider(provider.id)
                              } else {
                                // For existing providers, restore the original snapshot without refreshing
                                if (originalProviderSnapshot) {
                                  updateProviders(
                                    providers.map((p) =>
                                      p.id === provider.id ? originalProviderSnapshot : p
                                    )
                                  )
                                }
                              }
                              setEditingId(null)
                              setShowAddForm(false)
                              setValidationErrors({}) // Clear validation errors
                              setOriginalProviderSnapshot(null) // Clear snapshot
                            }}
                            variant="outline"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </GlassButton>
                          <GlassButton onClick={handleSave} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </GlassButton>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-full"
                              style={{ backgroundColor: provider.color }}
                            />
                            <div>
                              <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                              <p className="text-xs text-slate-500">
                                {provider.services.length} service{provider.services.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <GlassButton
                              onClick={() => {
                                // Store a deep copy of the original provider state for cancel
                                setOriginalProviderSnapshot(JSON.parse(JSON.stringify(provider)))
                                setEditingId(provider.id)
                                setShowAddForm(false)
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <Edit className="mr-2 h-3 w-3" />
                              Edit
                            </GlassButton>
                            <GlassButton
                              onClick={() => handleDeleteProvider(provider.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              Delete
                            </GlassButton>
                          </div>
                        </div>

                        {/* Service Badges */}
                        {provider.services.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {provider.services.map((service) => (
                              <GlassBadge key={service.id} style={{ backgroundColor: provider.color + '20' }}>
                                {service.name}
                              </GlassBadge>
                            ))}
                          </div>
                        )}

                        {/* Schedule Summary */}
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>
                            Working {provider.schedules.filter((s) => s.isWorking).length} days/week
                          </span>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

