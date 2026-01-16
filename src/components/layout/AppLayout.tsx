// @ts-nocheck
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { GlassCard } from '../ui/GlassCard'
import { useTenant } from '../../context/TenantContext'
import { TopNav } from './TopNav'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { useRevalidation } from '../../hooks/useRevalidation'

export const AppLayout = () => {
  // Activate the wake-up handler to prevent infinite loading after inactivity
  useRevalidation()
  const { isLoading: isConfigLoading, error, config, slug, isOnboarded } = useTenant()
  const { user, initialized, isLoading: isAuthLoading } = useAuthStore()
  const location = useLocation()
  const [forceConfigUnstuck, setForceConfigUnstuck] = useState(false)

  // "Stuck State" Breaker for tenant config: If isLoading is true for more than 8 seconds, force it to false
  useEffect(() => {
    if (!isConfigLoading || forceConfigUnstuck) {
      return
    }

    const stuckTimer = setTimeout(() => {
      console.warn('[AppLayout] Tenant config loading stuck for 8+ seconds. Forcing unstuck...')
      setForceConfigUnstuck(true)
    }, 8000) // 8 second timeout

    return () => {
      clearTimeout(stuckTimer)
    }
  }, [isConfigLoading, forceConfigUnstuck])

  // 1. Calculate Authorization immediately
  // Not logged in is fine (handled by protected routes)
  // Admin is always authorized
  // System tenant (admin/onboard routes) always authorized
  // User must match Config UUID for real tenants
  const isAuthorized = !user || // Not logged in is fine
    user.role === 'admin' || // Admin is always authorized
    config?.id === 'system' || // System tenant always authorized
    (user.tenant_id && config?.id && user.tenant_id === config.id) // Must match Config UUID

  // 2. Handle Mismatch (The Fix)
  useEffect(() => {
    // Wait for both auth and config to be loaded
    if (!initialized || isAuthLoading || isConfigLoading || !config) {
      return
    }

    // If user is logged in but not authorized (tenant mismatch)
    if (user && !isAuthorized) {
      console.warn('[AppLayout] ⚠️ Tenant Mismatch: Logged in as', user.tenant_id, 'visiting', config.id, '. Signing out...')

      // Force immediate signout and redirect
      void (async () => {
        try {
          await supabase.auth.signOut()
          await useAuthStore.getState().logout()
          // Hard refresh to clear all state
          window.location.href = `/${slug}/login`
        } catch (error) {
          console.error('[AppLayout] Error during signout:', error)
          // Still redirect even if signout fails
          window.location.href = `/${slug}/login`
        }
      })()
    }
  }, [user, isAuthorized, config, slug, initialized, isAuthLoading, isConfigLoading])

  // 3. The "Hard Stop" Render Guard
  // If we are logged in BUT not authorized, show loading instead of the children
  // This prevents the Dashboard from mounting and causing redirect loops
  if (initialized && !isAuthLoading && !isConfigLoading && user && !isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">Switching practices...</p>
        </div>
      </div>
    )
  }

  // Only show TopNav on dentist routes when:
  // 1. User is logged in as dentist
  // 2. On a dentist route (not /book or /login)
  // 3. Tenant is onboarded
  // 4. Not on onboarding/login screens (those are handled by DentistDashboard)
  const isDentistRoute = location.pathname.includes('/dentist')
  const isPublicRoute = location.pathname.includes('/book') || location.pathname.includes('/login')

  // Only show TopNav when user is logged in, on dentist route, tenant is onboarded, and not on public routes
  const shouldShowTopNav =
    user &&
    user.role === 'dentist' &&
    isDentistRoute &&
    !isPublicRoute &&
    !location.pathname.includes('/onboard') &&
    isOnboarded === true // Only show if tenant is confirmed onboarded

  return (
    <div className="relative h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Toaster position="top-right" richColors />
      {/* Main Container - Fixed Viewport */}
      <div className="flex h-screen flex-col">
        {/* Top Navigation - Fixed Height */}
        {shouldShowTopNav && <TopNav />}

        {/* Main Content Area - Takes Remaining Height */}
        <main className="flex-1 overflow-hidden">
          {isConfigLoading && !forceConfigUnstuck && (
            <div className="flex h-full items-center justify-center p-8">
              <GlassCard className="text-sm text-slate-600">Loading practice experience…</GlassCard>
            </div>
          )}
          {forceConfigUnstuck && !config && (
            <div className="flex h-full items-center justify-center p-8">
              <GlassCard className="border-rose-200 bg-rose-50 p-6 max-w-md w-full">
                <div className="text-sm text-rose-700 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                      <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="font-semibold mb-2 text-base">Connection Timeout</p>
                  <p className="text-sm mb-4">
                    Loading practice data is taking longer than expected. This may happen after the browser has been idle.
                  </p>
                  <button
                    onClick={() => {
                      setForceConfigUnstuck(false)
                      window.location.reload()
                    }}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Retry
                  </button>
                </div>
              </GlassCard>
            </div>
          )}
          {!isConfigLoading && error && (
            <div className="flex h-full items-center justify-center p-8">
              <GlassCard className="border-rose-200 bg-rose-50 p-6 max-w-md w-full">
                <div className="text-sm text-rose-700 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                      <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="font-semibold mb-2 text-base">Practice Not Found</p>
                  <p className="text-sm mb-4">{error}</p>
                  {error.includes('not found') && (
                    <div className="mt-4 space-y-2 text-xs text-rose-600">
                      <p>• Check that the practice URL is correct</p>
                      <p>• Contact support if you believe this is an error</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}
          {!isConfigLoading && !error && (
            <div className="h-full overflow-y-auto">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
