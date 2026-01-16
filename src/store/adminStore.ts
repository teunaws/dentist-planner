import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AdminState {
  isAuthenticated: boolean
  isLoading: boolean
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// Helper to validate Admin Role from Session Object
const isAdminSession = (session: any) => {
  if (!session?.user) return false
  const role = session.user.user_metadata?.role || session.user.app_metadata?.role
  console.log('[AdminStore] Checking Role:', role)
  return role === 'admin'
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true, // Start loading during initialization
  initialized: false,
  error: null,
  async initialize() {
    // 1. If already initialized, stop.
    if (get().initialized) return

    console.log('[AdminStore] Initializing...')
    
    // 1. Initial Check
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('[AdminStore] Init error:', error)
        set({ isAuthenticated: false })
      } else {
        const isAdmin = isAdminSession(session)
        set({ isAuthenticated: isAdmin })
        console.log('[AdminStore] Initial auth state:', isAdmin)
      }
    } catch (e) {
      console.error('[AdminStore] Init exception:', e)
      set({ isAuthenticated: false })
    } finally {
      set({ isLoading: false, initialized: true })
    }

    // 2. CRITICAL: Subscribe to future changes (Refreshes, Wake-ups, Logouts)
    // This ensures the store stays in sync when the session is refreshed
    supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AdminStore] Auth Event: ${event}`)
      
      const isAdmin = isAdminSession(session)
      
      // Update state if it changed
      const currentAuth = get().isAuthenticated
      if (currentAuth !== isAdmin) {
        console.log('[AdminStore] Syncing Auth State ->', isAdmin)
        set({ isAuthenticated: isAdmin })
      }
      
      // Ensure loading is off and initialized is true
      set({ isLoading: false, initialized: true })
    })
  },
  async login(email: string, password: string) {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      if (!isAdminSession(data.session)) {
        await supabase.auth.signOut()
        throw new Error('Unauthorized: Account is not an administrator')
      }
      
      // State updates automatically via onAuthStateChange listener
      console.log('[AdminStore] Admin login successful, state will update via listener')
    } catch (error: any) {
      console.error('[AdminStore] Login error:', error)
      set({ isAuthenticated: false, error: error.message || 'Login failed' })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  async logout() {
    try {
      await supabase.auth.signOut()
      // State updates automatically via onAuthStateChange listener
      console.log('[AdminStore] Logout initiated, state will update via listener')
    } catch (error) {
      console.error('[AdminStore] Logout error:', error)
      // Even if signOut fails, clear local state
      set({ isAuthenticated: false })
    }
  },
}))

