import { supabase } from '../lib/supabase'
import { isNotFoundError } from '../lib/supabaseErrors'
import { withTimeout } from '../lib/utils'
import type { UserRole, User } from '../types'
import type { Session } from '@supabase/supabase-js'

export interface AuthSession {
  session: Session | null
  user: User | null
}

export const authService = {
  /**
   * Sign in with email and password using Supabase Auth
   * After authentication, fetches user role and tenant info from users table
   */
  async login(role: UserRole, email: string, password: string): Promise<AuthSession> {
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.session || !authData.user) {
      throw new Error(authError?.message || 'Invalid credentials')
    }

    // Fetch user role and tenant info from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, name, tenant_id')
      .eq('id', authData.user.id)
      .eq('role', role)
      .single()

    if (userError || !userData) {
      // Sign out if user not found in users table
      await supabase.auth.signOut()
      throw new Error('User not found or invalid role')
    }

    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name || email,
      role: userData.role as UserRole,
      tenant_id: userData.tenant_id,
    }

    return {
      session: authData.session,
      user,
    }
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
  },

  /**
   * Sign up a new user (for onboarding)
   */
  async signUp(email: string, password: string, metadata?: { name?: string; role?: UserRole; tenant_id?: string }): Promise<AuthSession> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: metadata?.name,
          role: metadata?.role,
          tenant_id: metadata?.tenant_id,
        },
      },
    })

    if (authError || !authData.session || !authData.user) {
      throw new Error(authError?.message || 'Failed to create account')
    }

    // Fetch user role and tenant info from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, name, tenant_id')
      .eq('id', authData.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('Failed to fetch user data')
    }

    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name || email,
      role: userData.role as UserRole,
      tenant_id: userData.tenant_id,
    }

    return {
      session: authData.session,
      user,
    }
  },

  /**
   * Get the current session
   */
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  /**
   * Get user info from users table based on Supabase Auth user ID
   * Handles the case where user doesn't exist yet (e.g., during onboarding)
   * with retry logic for race conditions.
   * 
   * NOTE: With the database trigger in place, users should be created
   * automatically when they sign up. The retry logic handles any timing issues.
   */
  async getUserFromAuth(authUserId: string, retries = 5): Promise<User | null> {
    console.log(`[authService] Step 1: Starting getUserFromAuth for user ${authUserId}...`)
    try {
      // Use maybeSingle() instead of single() to handle missing users gracefully
      console.log('[authService] Step 1: Executing user profile query...')
      const { data: userData, error } = await withTimeout(
        supabase
          .from('users')
          .select('id, email, role, name, tenant_id')
          .eq('id', authUserId)
          .maybeSingle(), // Use maybeSingle() to handle 0 rows gracefully
        10000, // Increased to 10s for critical auth operation
        'Fetch User Profile'
      )
      console.log('[authService] Step 1: User profile query completed')

      if (error) {
        // If it's a "not found" error, the user doesn't exist yet
        // This might happen if the trigger hasn't fired yet (race condition)
        if (isNotFoundError(error)) {
          // Retry if we have retries left (wait for trigger to fire)
          if (retries > 0) {
            console.log(`[authService] User not found in public.users yet, waiting for trigger... (${retries} retries left)`)
            // CRITICAL: Actually wait between retries (not just loop instantly)
            await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms between retries
            return this.getUserFromAuth(authUserId, retries - 1)
          }
          // After all retries, throw a clear error
          throw new Error('Account created, but profile sync failed. The database trigger may not be working. Please contact support or try refreshing the page.')
        }

        console.error('[authService] Error fetching user from auth:', error)
        // Check for RLS errors
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          console.warn('[authService] RLS policy may be blocking user fetch.')
          throw new Error('Permission denied: Unable to access user profile. Please check database permissions.')
        }
        throw new Error(`Failed to fetch user profile: ${error.message}`)
      }

      if (!userData) {
        // User doesn't exist yet - retry if we have retries left
        if (retries > 0) {
          console.log(`[authService] User data is null, waiting for trigger... (${retries} retries left)`)
          // CRITICAL: Actually wait between retries (not just loop instantly)
          await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms between retries
          return this.getUserFromAuth(authUserId, retries - 1)
        }
        // After all retries, throw a clear error
        throw new Error('Account created, but profile sync failed. The database trigger may not be working. Please contact support or try refreshing the page.')
      }

      const user = {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email,
        role: userData.role as UserRole,
        tenant_id: userData.tenant_id,
      }
      console.log('[authService] Step 1: getUserFromAuth completed successfully')
      return user
    } catch (err) {
      // Re-throw if it's already an Error with a message
      if (err instanceof Error) {
        console.error('[authService] Step 1: getUserFromAuth failed with error:', err.message)
        throw err
      }
      console.error('[authService] Step 1: Exception in getUserFromAuth:', err)
      throw new Error('Failed to fetch user profile. Please try again or contact support.')
    }
  },
}
