// @ts-nocheck
// @ts-nocheck
import { useEffect, useState } from 'react'
import { Building2, Plus, Edit, Trash2, ExternalLink, Users, Calendar, Key, Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { GlassBadge } from '../../components/ui/GlassBadge'
import { useAdminStore } from '../../store/adminStore'
import { adminService } from '../../services/adminService'
import { onboardingService } from '../../services/onboardingService'
import { supabase } from '../../lib/supabase'
// NOTE: supabaseAdmin is no longer needed - admin operations use Edge Functions
import type { TenantConfig } from '../../types/tenant'
import { CreateTenantModal } from '../../components/admin/CreateTenantModal'
import { EditTenantModal } from '../../components/admin/EditTenantModal'
import { notifications } from '../../lib/notifications'

export const AdminDashboard = () => {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAdminStore()
  const [tenants, setTenants] = useState<TenantConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0) // Force reload by incrementing
  const limit = 10 // Items per page
  const [selectedTenant, setSelectedTenant] = useState<TenantConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({})
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [generatingCodeFor, setGeneratingCodeFor] = useState<string | null>(null)

  useEffect(() => {
    // Authentication check is now handled by ProtectedAdminRoute in AppRouter
    // This check is kept as a safety fallback
    if (!isAuthenticated) {
      navigate('/admin/login', { replace: true })
      return
    }

    // Create AbortController for this request
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)

      try {
        const data = await adminService.getAllTenants(page, limit, controller.signal)
        setTenants(data.tenants)
        setTotalCount(data.count)
      } catch (err) {
        // Don't show error if request was aborted (expected when page changes)
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load tenants:', err)
          const errorMessage = err.message || 'Unknown error'
          notifications.error('Failed to load tenants', errorMessage)

          // If it's an RLS error, provide helpful message
          if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
            notifications.error(
              'RLS Policy Error',
              'The service role key may not be configured correctly. Check VITE_SUPABASE_SERVICE_ROLE_KEY in .env'
            )
          }
        }
      } finally {
        // Only set loading to false if request wasn't aborted
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    load()

    // Cleanup: Abort request immediately on unmount or page change
    return () => {
      controller.abort()
    }
  }, [isAuthenticated, navigate, page, reloadKey])

  const handleDelete = async (slug: string) => {
    // Find tenant display name for better confirmation message
    const tenant = tenants.find(t => t.slug === slug)
    const tenantName = tenant?.displayName || slug

    // Enhanced confirmation dialog
    const confirmed = window.confirm(
      `⚠️ WARNING: This action cannot be undone!\n\n` +
      `Are you sure you want to delete tenant "${tenantName}" (${slug})?\n\n` +
      `This will permanently delete:\n` +
      `• All services and service perks\n` +
      `• All availability slots\n` +
      `• All appointments\n` +
      `• All onboarding codes\n` +
      `• All appointment durations\n\n` +
      `User accounts will be preserved but unlinked from this tenant.`
    )

    if (!confirmed) return

    // Optimistic UI: Snapshot current state for rollback
    const previousTenants = [...tenants]
    const previousCount = totalCount

    // Immediately remove from UI
    setTenants((prev) => prev.filter((t) => t.slug !== slug))
    setTotalCount((prev) => prev - 1)

    // Provide instant feedback
    notifications.success('Tenant deleted', `"${tenantName}" has been hidden and is being deleted in the background.`)

    try {
      console.log(`[AdminDashboard] Deleting tenant background: ${slug}`)

      // Perform actual deletion
      await adminService.deleteTenant(slug)

      // Quietly verify consistency (optional, but good practice to ensure DB is clean)
      // We don't trigger a full reload to keep it smooth
      console.log(`[AdminDashboard] Background deletion successful`)

    } catch (error) {
      console.error('[AdminDashboard] Failed to delete tenant:', error)

      // Rollback UI on failure
      setTenants(previousTenants)
      setTotalCount(previousCount)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Provide specific error messages
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        notifications.error(
          'Permission Denied',
          'RLS policy blocked deletion. Restoring tenant to list.'
        )
      } else if (errorMessage.includes('Related data')) {
        notifications.error(
          'Cannot Delete',
          'This tenant has related data that prevents deletion. Restoring tenant to list.'
        )
      } else {
        notifications.error('Failed to delete tenant', `${errorMessage}. Restoring tenant to list.`)
      }
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    // Reset to page 1 to show the newly created tenant
    setPage(1)
    setReloadKey((prev) => prev + 1) // Trigger reload
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedTenant(null)
    // Refresh current page without changing page number
    setReloadKey((prev) => prev + 1) // Trigger reload
  }

  const handleGenerateCode = async (tenantSlug: string) => {
    if (generatingCodeFor === tenantSlug) return // Prevent double-clicks

    setGeneratingCodeFor(tenantSlug)
    console.log('[AdminDashboard] Starting code generation for:', tenantSlug)

    // Safety Timeout - Force reset loading state after 8 seconds
    const timeoutId = setTimeout(() => {
      console.error('[AdminDashboard] Safety timeout triggered - forcing loading state reset')
      setGeneratingCodeFor(null)
      notifications.error('Request timed out', 'The operation took too long. Please check your connection and try again.')
    }, 8000)

    try {
      console.log('[AdminDashboard] Generating onboarding code for:', tenantSlug)

      // Get tenant ID using regular client (public read access)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle()

      if (tenantError) {
        console.error('[AdminDashboard] Error fetching tenant:', tenantError)
        notifications.error('Failed to fetch tenant', tenantError.message)
        return
      }

      if (!tenantData) {
        console.error('[AdminDashboard] Tenant not found')
        notifications.error('Tenant not found', 'Could not find tenant with slug: ' + tenantSlug)
        return
      }

      console.log('[AdminDashboard] Tenant found, generating code...', tenantData.id)

      // Generate code using admin client
      const code = await onboardingService.generateCode(tenantData.id, 30, true)
      console.log('[AdminDashboard] Code generated successfully:', code)

      // Update state with the new code
      setGeneratedCodes((prev) => {
        const updated = { ...prev, [tenantSlug]: code }
        return updated
      })

      notifications.success('Onboarding code generated', `Code: ${code}`)
    } catch (error: any) {
      console.error('[AdminDashboard] Operation Failed:', error)

      // Handle 403/RLS errors specifically
      if (error?.code === '42501' || error?.code === '403' || error?.message?.includes('row-level security') || error?.message?.includes('RLS')) {
        notifications.error('Permission Denied', 'RLS Policy Error: Please check database permissions. Run fix_rls_policies.sql')
      } else if (error?.code === 'PGRST301' || error?.code === '23505') {
        notifications.error('Database Error', error.message || 'Constraint violation')
      } else {
        notifications.error('Failed to generate key', error?.message || 'Unknown error occurred')
      }
    } finally {
      // CRUCIAL: Clear safety timeout and ALWAYS reset loading state
      clearTimeout(timeoutId)
      setGeneratingCodeFor(null)
      console.log('[AdminDashboard] Code generation finished, loading state reset')
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="space-y-6">
      <GlassCard className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Control Center</p>
          <h1 className="text-3xl font-semibold text-slate-900">Tenant Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton
            variant="secondary"
            onClick={() => {
              const firstTenant = tenants.length > 0 ? tenants[0] : null
              if (firstTenant) {
                window.open(`/${firstTenant.slug}/book`, '_blank')
              } else {
                navigate('/lumina/book')
              }
            }}
          >
            View Public Site
          </GlassButton>
          <GlassButton onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Tenant
          </GlassButton>
          <GlassButton variant="ghost" onClick={logout}>
            Logout
          </GlassButton>
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard className="text-center text-slate-600">Loading tenants...</GlassCard>
      ) : tenants.length === 0 ? (
        <GlassCard className="text-center text-slate-600">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <p>No tenants found. Create your first tenant to get started.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <GlassCard key={tenant.slug} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-slate-600" />
                    <h3 className="text-xl font-semibold text-slate-900">{tenant.displayName}</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">/{tenant.slug}</p>
                </div>
                <GlassBadge tone="info">{tenant.slug}</GlassBadge>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{tenant.services.length} services</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {tenant.schedule.appointments.length} appointments
                  </span>
                </div>
              </div>

              {/* Onboarding Code Section */}
              {generatedCodes[tenant.slug] && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-900">Onboarding Code</p>
                    <button
                      onClick={() => handleCopyCode(generatedCodes[tenant.slug])}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      {copiedCode === generatedCodes[tenant.slug] ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-lg font-bold text-emerald-900">
                    {generatedCodes[tenant.slug]}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Share this code with the tenant to start onboarding
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <GlassButton
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTenant(tenant)
                    setShowEditModal(true)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  onClick={() => handleGenerateCode(tenant.slug)}
                  title="Generate onboarding code"
                  isLoading={generatingCodeFor === tenant.slug}
                  disabled={generatingCodeFor === tenant.slug}
                >
                  <Key className="h-4 w-4" />
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  onClick={() => window.open(`/${tenant.slug}/book`, '_blank')}
                  title="View public site"
                >
                  <ExternalLink className="h-4 w-4" />
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  onClick={() => handleDelete(tenant.slug)}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  title="Delete tenant (permanent)"
                  disabled={generatingCodeFor === `deleting-${tenant.slug}`}
                  isLoading={generatingCodeFor === `deleting-${tenant.slug}`}
                >
                  <Trash2 className="h-4 w-4" />
                </GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && tenants.length > 0 && (
        <GlassCard className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} tenants
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              variant="secondary"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || isLoading}
            >
              Previous
            </GlassButton>
            <span className="text-sm text-slate-600">
              Page {page} of {Math.ceil(totalCount / limit) || 1}
            </span>
            <GlassButton
              variant="secondary"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page * limit >= totalCount || isLoading}
            >
              Next
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showEditModal && selectedTenant && (
        <EditTenantModal
          tenant={selectedTenant}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTenant(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

