'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, Edit, Trash2, ExternalLink, Users, Calendar, Key, Copy, Check, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '../../../components/ui/GlassCard'
import { GlassButton } from '../../../components/ui/GlassButton'
import { GlassBadge } from '../../../components/ui/GlassBadge'
import { useAdminStore } from '../../../store/adminStore'
import { adminService } from '../../../services/adminService'
import { onboardingService } from '../../../services/onboardingService'
import { supabase } from '../../../lib/supabase'
import type { TenantConfig } from '../../../types/tenant'
import { CreateTenantModal } from '../../../components/admin/CreateTenantModal'
import { EditTenantModal } from '../../../components/admin/EditTenantModal'
import { notifications } from '../../../lib/notifications'

export default function AdminDashboard() {
    const router = useRouter()
    const { isAuthenticated, logout } = useAdminStore()
    const [tenants, setTenants] = useState<TenantConfig[]>([])
    const [showDeleted, setShowDeleted] = useState(false)
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
        // Safety check - verify usage of middleware protection in future
        if (!isAuthenticated) {
            router.replace('/admin/login')
            return
        }

        const controller = new AbortController()

        const load = async () => {
            setIsLoading(true)

            try {
                const data = await adminService.getAllTenants(page, limit, showDeleted, controller.signal)
                setTenants(data.tenants)
                setTotalCount(data.count)
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.error('Failed to load tenants:', err)
                    const errorMessage = err.message || 'Unknown error'
                    notifications.error('Failed to load tenants', errorMessage)

                    if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
                        notifications.error(
                            'RLS Policy Error',
                            'The service role key may not be configured correctly. Check VITE_SUPABASE_SERVICE_ROLE_KEY in .env'
                        )
                    }
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        load()
        return () => {
            controller.abort()
        }
    }, [isAuthenticated, router, page, reloadKey, showDeleted])

    const handleDelete = async (slug: string) => {
        const tenant = tenants.find(t => t.slug === slug)
        const tenantName = tenant?.displayName || slug

        const confirmed = window.confirm(
            `⚠️ WARNING: This action will Soft Delete the tenant!\n\n` +
            `Are you sure you want to delete tenant "${tenantName}" (${slug})?\n\n` +
            `• The tenant will be hidden immediately.\n` +
            `• Data will be retained for 30 days.\n` +
            `• You can restore it within the grace period.`
        )

        if (!confirmed) return

        const previousTenants = [...tenants]
        const previousCount = totalCount

        setTenants((prev) => prev.filter((t) => t.slug !== slug))
        setTotalCount((prev) => prev - 1)

        notifications.success('Tenant deleted', `"${tenantName}" has been soft deleted. It will be permanently removed in 30 days.`)

        try {
            console.log(`[AdminDashboard] Soft deleting tenant: ${slug}`)
            await adminService.deleteTenant(slug)
            console.log(`[AdminDashboard] Soft deletion successful`)

        } catch (error) {
            console.error('[AdminDashboard] Failed to delete tenant:', error)

            setTenants(previousTenants)
            setTotalCount(previousCount)

            const errorMessage = error instanceof Error ? error.message : 'Unknown error'

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

    const handleRestore = async (slug: string) => {
        const tenant = tenants.find(t => t.slug === slug)
        const tenantName = tenant?.displayName || slug

        if (!window.confirm(`Are you sure you want to restore tenant "${tenantName}"?`)) return

        const previousTenants = [...tenants]

        // Optimistic update: remove from list (since we are showing deleted) 
        // OR keep it but remove deleted status? 
        // If we are in "Show Deleted" mode, it should probably disappear or show as active?
        // Let's assume we remove it from the "Deleted" view if we are filtering, 
        // but since we only have "Show Deleted" (implies Show ALL or Show ONLY deleted? 
        // My implementation in admin-api was: if showDeleted=false, filter OUT deleted. If true, show ALL.)
        // So if showDeleted=true, the tenant is still there, just active.

        // Actually, let's just trigger a reload to be safe and simple.

        try {
            console.log(`[AdminDashboard] Restoring tenant: ${slug}`)
            await adminService.restoreTenant(slug)
            notifications.success('Tenant restored', `"${tenantName}" is now active again.`)
            setReloadKey(prev => prev + 1)
        } catch (error) {
            console.error('[AdminDashboard] Failed to restore tenant:', error)
            notifications.error('Failed to restore tenant', error instanceof Error ? error.message : 'Unknown error')
        }
    }

    const handleCreateSuccess = () => {
        setShowCreateModal(false)
        setPage(1)
        setReloadKey((prev) => prev + 1)
    }

    const handleEditSuccess = () => {
        setShowEditModal(false)
        setSelectedTenant(null)
        setReloadKey((prev) => prev + 1)
    }

    const handleGenerateCode = async (tenantSlug: string) => {
        if (generatingCodeFor === tenantSlug) return

        setGeneratingCodeFor(tenantSlug)
        console.log('[AdminDashboard] Starting code generation for:', tenantSlug)

        const timeoutId = setTimeout(() => {
            console.error('[AdminDashboard] Safety timeout triggered - forcing loading state reset')
            setGeneratingCodeFor(null)
            notifications.error('Request timed out', 'The operation took too long. Please check your connection and try again.')
        }, 8000)

        try {
            console.log('[AdminDashboard] Generating onboarding code for:', tenantSlug)

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

            const code = await onboardingService.generateCode(tenantData.id, 30, true)
            console.log('[AdminDashboard] Code generated successfully:', code)

            setGeneratedCodes((prev) => {
                const updated = { ...prev, [tenantSlug]: code }
                return updated
            })

            notifications.success('Onboarding code generated', `Code: ${code}`)
        } catch (error: any) {
            console.error('[AdminDashboard] Operation Failed:', error)

            if (error?.code === '42501' || error?.code === '403' || error?.message?.includes('row-level security') || error?.message?.includes('RLS')) {
                notifications.error('Permission Denied', 'RLS Policy Error: Please check database permissions. Run fix_rls_policies.sql')
            } else if (error?.code === 'PGRST301' || error?.code === '23505') {
                notifications.error('Database Error', error.message || 'Constraint violation')
            } else {
                notifications.error('Failed to generate key', error?.message || 'Unknown error occurred')
            }
        } finally {
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
        <div className="space-y-6 p-8">
            <GlassCard className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Control Center</p>
                    <h1 className="text-3xl font-semibold text-slate-900">Tenant Management</h1>
                </div>
                <div className="flex items-center gap-3">
                    <GlassButton
                        variant={showDeleted ? "primary" : "ghost"}
                        onClick={() => {
                            setShowDeleted(!showDeleted)
                            setPage(1)
                        }}
                        className={showDeleted ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "text-slate-600"}
                    >
                        {showDeleted ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {showDeleted ? "Hide Deleted" : "Show Deleted"}
                    </GlassButton>
                    <GlassButton
                        variant="secondary"
                        onClick={() => {
                            const firstTenant = tenants.find(t => !t.deletedAt)
                            if (firstTenant) {
                                // Assuming defaults to en locale
                                window.open(`/en/${firstTenant.slug}/book`, '_blank')
                            } else {
                                window.open('/en/lumina/book', '_blank')
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

                                <div className="flex flex-col items-end gap-1">
                                    <GlassBadge tone="info">{tenant.slug}</GlassBadge>
                                    {tenant.deletedAt && (
                                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                                            Deleted
                                        </span>
                                    )}
                                </div>
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
                            {
                                generatedCodes[tenant.slug] && (
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
                                )
                            }

                            < div className="flex flex-wrap gap-2" >
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

                                {!tenant.deletedAt && (
                                    <GlassButton
                                        variant="secondary"
                                        // Defaulting to EN for admin links
                                        onClick={() => window.open(`/en/${tenant.slug}/book`, '_blank')}
                                        title="View public site"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </GlassButton>
                                )}
                                {!tenant.deletedAt ? (
                                    <GlassButton
                                        variant="ghost"
                                        onClick={() => handleDelete(tenant.slug)}
                                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                        title="Delete tenant (Soft)"
                                        disabled={generatingCodeFor === `deleting-${tenant.slug}`}
                                        isLoading={generatingCodeFor === `deleting-${tenant.slug}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </GlassButton>
                                ) : (
                                    <GlassButton
                                        variant="secondary"
                                        onClick={() => handleRestore(tenant.slug)}
                                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        title="Restore tenant"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Restore
                                    </GlassButton>
                                )}
                            </div>
                        </GlassCard >
                    ))
                    }
                </div >
            )}

            {/* Pagination Controls */}
            {
                !isLoading && tenants.length > 0 && (
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
                )
            }

            {
                showCreateModal && (
                    <CreateTenantModal
                        onClose={() => setShowCreateModal(false)}
                        onSuccess={handleCreateSuccess}
                    />
                )
            }

            {
                showEditModal && selectedTenant && (
                    <EditTenantModal
                        tenant={selectedTenant}
                        onClose={() => {
                            setShowEditModal(false)
                            setSelectedTenant(null)
                        }}
                        onSuccess={handleEditSuccess}
                    />
                )
            }
        </div >
    )
}
