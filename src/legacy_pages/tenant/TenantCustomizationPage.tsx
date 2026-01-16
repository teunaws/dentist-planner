// @ts-nocheck
import { useEffect, useState } from 'react'
import { Package, Plus, Edit, Trash2, Save, ShieldCheck } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { GlassBadge } from '../../components/ui/GlassBadge'
import { useTenant } from '../../context/TenantContext'
import { useAuthStore } from '../../store/authStore'
import { adminService } from '../../services/adminService'
import type { ServiceDefinition } from '../../types/tenant'

export const TenantCustomizationPage = () => {
  const { tenant } = useParams<{ tenant: string }>()
  const navigate = useNavigate()
  const { config, refresh, updateConfig } = useTenant()
  const { user } = useAuthStore()
  const [services, setServices] = useState<ServiceDefinition[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'dentist') {
      navigate(`/${tenant ?? 'lumina'}/dentist`, { replace: true })
      return
    }
  }, [user, navigate, tenant])

  useEffect(() => {
    if (config?.services) {
      setServices(config.services)
    }
  }, [config])

  if (!user || user.role !== 'dentist') {
    return (
      <GlassCard className="text-center text-white/70">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-white/40" />
        <p className="text-sm">Please log in as a dentist to access this page.</p>
        <GlassButton className="mt-3" onClick={() => navigate(`/${tenant ?? 'lumina'}/dentist`)}>
          Go to Login
        </GlassButton>
      </GlassCard>
    )
  }

  const handleSave = async () => {
    const tenantSlug = tenant || config?.slug
    if (!tenantSlug) return
    setIsSaving(true)
    try {
      await adminService.updateTenantServices(tenantSlug, services)
      await refresh()
      setEditingId(null)
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to save services:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddService = () => {
    const newService: ServiceDefinition = {
      id: `service-${Date.now()}`,
      name: '',
      description: '',
      duration: 30,
      price: '$0',
      perks: [],
    }
    setServices([...services, newService])
    setEditingId(newService.id)
    setShowAddForm(true)
  }

  const handleUpdateService = (id: string, updates: Partial<ServiceDefinition>) => {
    setServices(services.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleDeleteService = (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) {
      return
    }

    const tenantSlug = tenant || config?.slug
    if (!tenantSlug) {
      alert('Unable to delete service: tenant slug not found')
      return
    }

    // Optimistic update: remove from UI immediately
    const updatedServices = services.filter((s) => s.id !== id)
    setServices(updatedServices)

    // Update global context optimistically (no reload needed)
    updateConfig({ services: updatedServices })

    // Save to database in the background (fire and forget)
    void (async () => {
      try {
        console.log('[TenantCustomizationPage] Deleting service in background:', id)
        await adminService.updateTenantServices(tenantSlug, updatedServices)
        console.log('[TenantCustomizationPage] Service deleted successfully from database')
      } catch (error) {
        console.error('[TenantCustomizationPage] Failed to delete service from database:', error)
        // Revert optimistic update on error
        setServices(services)
        updateConfig({ services })
        alert('Failed to delete service. It has been restored.')
      }
    })()
  }

  const handleAddPerk = (serviceId: string) => {
    setServices(
      services.map((s) =>
        s.id === serviceId
          ? { ...s, perks: [...(s.perks || []), ''] }
          : s,
      ),
    )
  }

  const handleUpdatePerk = (serviceId: string, index: number, value: string) => {
    setServices(
      services.map((s) =>
        s.id === serviceId
          ? {
            ...s,
            perks: s.perks?.map((p, i) => (i === index ? value : p)) || [],
          }
          : s,
      ),
    )
  }

  const handleDeletePerk = (serviceId: string, index: number) => {
    setServices(
      services.map((s) =>
        s.id === serviceId
          ? { ...s, perks: s.perks?.filter((_, i) => i !== index) || [] }
          : s,
      ),
    )
  }

  if (!config) {
    return (
      <GlassCard className="text-center text-white/70">Loading tenant configuration...</GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Tenant Portal</p>
          <h1 className="text-2xl font-semibold text-white">Customize Packages</h1>
          <p className="mt-1 text-xs text-white/70">{config.displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="secondary"
            onClick={() => {
              const tenantSlug = tenant || config?.slug || 'lumina'
              navigate(`/${tenantSlug}/book`)
            }}
          >
            View Public Site
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={() => {
              const tenantSlug = tenant || config?.slug || 'lumina'
              navigate(`/${tenantSlug}/dentist`)
            }}
          >
            Dentist Portal
          </GlassButton>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="h-5 w-5 text-teal-200" />
            <div>
              <h2 className="text-lg font-semibold text-white">Services & Packages</h2>
              <p className="text-xs text-white/60">Manage your available services and pricing</p>
            </div>
          </div>
          <GlassButton onClick={handleAddService}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Service
          </GlassButton>
        </div>

        {services.length === 0 ? (
          <div className="py-8 text-center text-white/60">
            <Package className="mx-auto mb-3 h-10 w-10 text-white/40" />
            <p className="text-sm">No services configured. Add your first service to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <GlassCard key={service.id} className="space-y-3 border border-white/20">
                {editingId === service.id ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <GlassInput
                        label="Service Name"
                        value={service.name}
                        onChange={(event) =>
                          handleUpdateService(service.id, { name: event.target.value })
                        }
                        placeholder="Signature Clean"
                      />
                      <GlassInput
                        label="Price"
                        value={service.price}
                        onChange={(event) =>
                          handleUpdateService(service.id, { price: event.target.value })
                        }
                        placeholder="$180"
                      />
                    </div>
                    <GlassInput
                      label="Description"
                      value={service.description}
                      onChange={(event) =>
                        handleUpdateService(service.id, { description: event.target.value })
                      }
                      placeholder="Full hygiene session with hand-finished polish."
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <GlassInput
                        label="Duration (minutes)"
                        type="number"
                        min="15"
                        value={service.duration}
                        onChange={(event) =>
                          handleUpdateService(service.id, {
                            duration: parseInt(event.target.value, 10),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-white/80">Perks & Features</p>
                      {service.perks?.map((perk, index) => (
                        <div key={index} className="flex gap-2">
                          <GlassInput
                            value={perk}
                            onChange={(event) =>
                              handleUpdatePerk(service.id, index, event.target.value)
                            }
                            placeholder="e.g., Fluoride finish"
                            className="flex-1"
                          />
                          <GlassButton
                            variant="ghost"
                            onClick={() => handleDeletePerk(service.id, index)}
                            className="text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </GlassButton>
                        </div>
                      ))}
                      <GlassButton
                        variant="ghost"
                        onClick={() => handleAddPerk(service.id)}
                        className="w-full"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Perk
                      </GlassButton>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null)
                          if (showAddForm) {
                            setServices(services.filter((s) => s.id !== service.id))
                            setShowAddForm(false)
                          }
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </GlassButton>
                      <GlassButton onClick={handleSave} isLoading={isSaving} className="flex-1">
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Save
                      </GlassButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">{service.name}</h3>
                        <p className="mt-1 text-xs text-white/70">{service.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-white">{service.price}</p>
                        <p className="text-[11px] text-white/60">{service.duration} mins</p>
                      </div>
                    </div>
                    {service.perks && service.perks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {service.perks.map((perk, index) => (
                          <GlassBadge key={index} tone="info" className="text-[11px]">
                            {perk}
                          </GlassBadge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <GlassButton
                        variant="secondary"
                        onClick={() => setEditingId(service.id)}
                        className="flex-1"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        onClick={() => handleDeleteService(service.id)}
                        className="text-rose-300 hover:text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </GlassButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

