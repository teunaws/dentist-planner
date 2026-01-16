import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { authService } from '../services/authService'
import type { User, UserRole } from '../types'
import type { Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  selectedRole: UserRole
  isLoading: boolean
  error: string | null
  initialized: boolean
  setRole: (role: UserRole) => void
  login: (email: string, password: string, role?: UserRole) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
  updateSession: (session: Session | null) => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  selectedRole: 'dentist',
  isLoading: false,
  error: null,
  initialized: false,
  setRole: (role) => set({ selectedRole: role }),
  async login(email, password, overrideRole) {
    const role = overrideRole ?? get().selectedRole
    set({ isLoading: true, error: null })

    try {
      const { session, user } = await authService.login(role, email, password)
      set({ user, session, selectedRole: role, isLoading: false, error: null })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to login at this time'
      set({ error: message, isLoading: false, user: null, session: null })
      throw error
    }
  },
  async logout() {
    try {
      await authService.signOut()
      set({ user: null, session: null, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to logout'
      set({ error: message })
    }
  },
  async initialize() {
    if (get().initialized) return

    set({ isLoading: true })
    try {
      // Get current session with timeout
      const sessionPromise = authService.getSession()
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      )
      const session = await Promise.race([sessionPromise, timeoutPromise])
      
      if (session?.user) {
        try {
          // Fetch user info from users table with timeout
          const userPromise = authService.getUserFromAuth(session.user.id)
          const userTimeoutPromise = new Promise<User | null>((resolve) => 
            setTimeout(() => resolve(null), 5000)
          )
          const user = await Promise.race([userPromise, userTimeoutPromise])
          set({ session, user, isLoading: false, initialized: true })
        } catch (userError) {
          console.error('Failed to fetch user data:', userError)
          // Still set initialized to true so app doesn't hang
          set({ session, user: null, isLoading: false, initialized: true })
        }
      } else {
        set({ session: null, user: null, isLoading: false, initialized: true })
      }

      // Set up auth state change listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[authStore] Auth state change event: ${event}`)
        
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // Only fetch user if we don't already have one (prevents unnecessary fetches on token refresh)
            const currentUser = get().user
            if (currentUser && currentUser.id === session.user.id) {
              console.log('[authStore] User already exists, just updating session')
              set({ session, error: null })
            } else {
              console.log('[authStore] Fetching user profile for new sign-in...')
              // getUserFromAuth has retry logic to handle race conditions
              // (e.g., during onboarding when user is created in auth.users
              // but not yet in public.users)
              const user = await authService.getUserFromAuth(session.user.id)
              set({ session, user, error: null })
            }
          } catch (error) {
            console.error('[authStore] Failed to fetch user on sign in:', error)
            // CRITICAL: Don't clear existing user on timeout - preserve current user state
            // Only clear user if we don't have one already (first-time sign-in failure)
            const currentUser = get().user
            if (!currentUser) {
              console.warn('[authStore] No existing user, setting to null due to fetch failure')
              set({ session, user: null, error: null })
            } else {
              console.warn('[authStore] User fetch failed but keeping existing user to prevent logout')
              // Keep existing user and session - just update session
              set({ session, error: null })
            }
          }
        } else if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, error: null })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // CRITICAL: On token refresh, just update the session
          // Don't re-fetch user profile - we already have it
          // This prevents timeouts from logging users out
          console.log('[authStore] Token refreshed, updating session only')
          set({ session })
        }
      })
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      set({ session: null, user: null, isLoading: false, initialized: true })
    }
  },
  updateSession: (session) => {
    set({ session })
  },
  setUser: (user) => {
    set({ user })
  },
}))

