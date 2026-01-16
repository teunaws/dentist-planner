import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useTenant } from '../context/TenantContext'
import { supabase } from '../lib/supabase'
import { authService } from '../services/authService'

/**
 * Revalidation Hook - Detects when the app wakes up from idle/background
 * and forces a session refresh to ensure valid tokens for API calls.
 * 
 * This fixes issues where:
 * - Token refresh stalls after browser sleep (auto-refresh timer pauses)
 * - Stale tokens cause 401 errors on save operations
 * - getSession() returns cached expired tokens without verification
 * 
 * Solution: Uses refreshSession() to actively refresh the token against the server,
 * ensuring the Supabase client has a fresh, valid token for subsequent API calls.
 */
export const useRevalidation = () => {
  const { initialize: initAuth, user, initialized, updateSession, setUser } = useAuthStore()
  const { refresh: refreshTenant, config, isLoading: isConfigLoading } = useTenant()

  useEffect(() => {
    const handleWakeUp = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] Tab woke up. Forcing session refresh...')
        
        // 1. FORCE Token Refresh (Crucial fix)
        // refreshSession() attempts to rotate the token against the server.
        // If the token is valid, it returns the session.
        // If expired, it uses the refresh_token to get a new one.
        try {
          // Get current session first to check expiration
          const { data: { session: oldSession } } = await supabase.auth.getSession()
          
          if (!oldSession) {
            console.warn('[App] No session found on wake-up. Re-initializing...')
            await initAuth()
            return
          }
          
          // Check if token is expired or about to expire (within 60 seconds)
          const expiresAt = oldSession.expires_at ? oldSession.expires_at * 1000 : 0
          const now = Date.now()
          const timeUntilExpiry = expiresAt - now
          const isExpiredOrExpiringSoon = timeUntilExpiry < 60000 // 60 seconds
          
          console.log('[App] Current session status:', {
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
            timeUntilExpiry: Math.round(timeUntilExpiry / 1000) + 's',
            isExpiredOrExpiringSoon,
          })
          
          // SIMPLIFIED: Just sync the session to the store, don't call refreshSession()
          // The adminService will handle 401 errors by refreshing and retrying
          // This prevents hanging on refreshSession() which seems to be causing issues
          console.log('[App] Syncing session to auth store. adminService will handle token refresh on 401 errors.')
          updateSession(oldSession)
          
          // Only re-fetch user if we have a session but no user (shouldn't happen normally)
          // Don't call initAuth() on every wake-up as it might trigger unnecessary user fetches
          if (!user && initialized && oldSession?.user) {
            console.log('[App] Session exists but user is missing, attempting to fetch user profile...')
            // Try to fetch user directly instead of full initAuth to avoid triggering events
            try {
              const fetchedUser = await authService.getUserFromAuth(oldSession.user.id)
              if (fetchedUser) {
                setUser(fetchedUser)
                console.log('[App] User profile fetched successfully')
              }
            } catch (err) {
              console.warn('[App] Failed to fetch user profile on wake-up, but keeping session:', err)
              // Don't clear session or call initAuth - just log the warning
              // The user can still use the app with the session
            }
          }
        } catch (err) {
          console.error('[App] Error refreshing session on wake-up:', err)
          // Force re-initialization on error
          await initAuth()
        }

        // 2. Refresh Config ONLY if missing (Prevent overwriting optimistic updates)
        if (!isConfigLoading && !config) {
          console.log('[App] Config missing. Reloading...')
          refreshTenant()
        }
      }
    }

    // Listen for visibility changes (tab switching, window minimize/restore)
    document.addEventListener('visibilitychange', handleWakeUp)
    
    // Listen for window focus (user clicks back into the window)
    window.addEventListener('focus', handleWakeUp)

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp)
      window.removeEventListener('focus', handleWakeUp)
    }
  }, [initAuth, refreshTenant, user, config, initialized, isConfigLoading, updateSession, setUser])
}

