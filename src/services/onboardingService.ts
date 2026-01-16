import { supabase } from '../lib/supabase'
import { SUPABASE_ERROR_CODES, isNotFoundError, isPermissionError } from '../lib/supabaseErrors'

export interface OnboardingCode {
  id: string
  tenantId: string
  code: string
  isUsed: boolean
  usedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface OnboardingData {
  code: string
  email: string
  password: string
  name: string
}

// NOTE: Admin operations now use Edge Functions
// getAdminClient is no longer needed

export const onboardingService = {
  // Generate a unique onboarding code for a tenant
  // Now uses Edge Function for admin operations
  async generateCode(tenantId: string, expiresInDays: number = 30, useAdminClient = false): Promise<string> {
    console.log('[onboardingService] generateCode called:', { tenantId, expiresInDays, useAdminClient })

    // If using admin client, call Edge Function instead
    if (useAdminClient) {
      console.log('[onboardingService] Using Edge Function for admin code generation')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session. Please log in first.')
      }

      const { data, error } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'generate_onboarding_code',
          payload: { tenantId, expiresInDays },
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        console.error('[onboardingService] Edge Function error:', error)
        throw new Error(error.message || 'Failed to generate onboarding code')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      if (!data?.data?.code) {
        throw new Error('Failed to generate onboarding code: No code returned')
      }

      console.log('[onboardingService] Onboarding code generated via Edge Function:', data.data.code)
      return data.data.code
    }

    // Regular client flow (for non-admin users - if needed in future)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('[onboardingService] Session error:', sessionError)
      throw new Error(`Session error: ${sessionError.message}`)
    }

    if (!session) {
      console.error('[onboardingService] No active session')
      throw new Error('No active session. Please log in first.')
    }

    console.log('[onboardingService] Session verified:', session.user.id)

    const client = supabase
    console.log('[onboardingService] Using regular client')

    // Generate a random 8-character alphanumeric code
    const generateRandomCode = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    // Ensure code is unique
    let code = generateRandomCode()
    let attempts = 0
    console.log('[onboardingService] Checking code uniqueness...')

    while (attempts < 10) {
      try {
        const uniquenessCheckPromise = client
          .from('onboarding_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle()

        const uniquenessTimeoutPromise = new Promise<{ data: null; error: { message: string; code?: string } }>((resolve) =>
          setTimeout(() => resolve({
            data: null,
            error: { message: 'Uniqueness check timed out after 5 seconds', code: 'TIMEOUT' }
          }), 5000)
        )

        const { data: existing, error: checkError } = await Promise.race([
          uniquenessCheckPromise,
          uniquenessTimeoutPromise
        ])

        if (checkError) {
          // If using admin client, RLS errors shouldn't happen - this might indicate service role key issue
          if (useAdminClient && (checkError.message?.includes('row-level security') || checkError.message?.includes('RLS'))) {
            console.error('[onboardingService] RLS error with admin client - service role key may not be working:', checkError)
            throw new Error(`RLS policy error: ${checkError.message}. Verify VITE_SUPABASE_SERVICE_ROLE_KEY is set correctly.`)
          }

          if (!isNotFoundError(checkError) && checkError.code !== SUPABASE_ERROR_CODES.TIMEOUT) {
            // NOT_FOUND is "not found" which is fine, other errors are problems
            console.error('[onboardingService] Error checking code uniqueness:', checkError)
            throw new Error(`Failed to check code uniqueness: ${checkError.message}`)
          }

          if (checkError.code === 'TIMEOUT') {
            console.error('[onboardingService] Uniqueness check timed out')
            throw new Error('Uniqueness check timed out. This may indicate RLS blocking the query.')
          }
        }

        if (!existing) {
          console.log('[onboardingService] Code is unique:', code)
          break // Code is unique
        }
        console.log('[onboardingService] Code already exists, generating new one...')
        code = generateRandomCode()
        attempts++
      } catch (err) {
        // If it's an RLS error and we're using admin client, re-throw with better message
        if (useAdminClient && err instanceof Error && err.message.includes('row-level security')) {
          throw new Error(`Service role key may not be configured correctly: ${err.message}`)
        }
        throw err
      }
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique code after multiple attempts')
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Insert code - try RPC function first if using admin client, fallback to direct insert
    if (useAdminClient) {
      // Try using RPC function to bypass RLS (more reliable)
      try {
        console.log('[onboardingService] Attempting RPC function insert...')
        const rpcPromise = client.rpc('admin_insert_onboarding_code', {
          p_tenant_id: tenantId,
          p_code: code,
          p_expires_at: expiresAt.toISOString(),
        } as any)

        const rpcTimeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({
            data: null,
            error: { message: 'RPC call timed out after 5 seconds' }
          }), 5000)
        )

        const { data: rpcData, error: rpcError } = await Promise.race([rpcPromise, rpcTimeoutPromise])

        if (!rpcError && rpcData) {
          // RPC function succeeded
          console.log('[onboardingService] RPC function succeeded')
          return code
        } else if (rpcError) {
          console.warn('[onboardingService] RPC function error:', rpcError)
        }
      } catch (rpcErr) {
        // RPC function might not exist, fall through to direct insert
        console.warn('[onboardingService] RPC function not available or failed, using direct insert:', rpcErr)
      }
    }

    // Step 2: Perform Direct Insert Query
    console.log('[onboardingService] Attempting direct insert...')
    const { data, error } = await client
      .from('onboarding_codes')
      .insert({
        tenant_id: tenantId,
        code,
        expires_at: expiresAt.toISOString(),
      } as any)
      .select()
      .single()

    // Step 3: Throw Error to UI (Essential for UI to catch it)
    if (error) {
      console.error('[onboardingService] Supabase Error:', error)
      // Check for RLS/403 errors specifically
      if (isPermissionError(error)) {
        throw new Error(`RLS Policy Error: ${error.message}. Please check database permissions.`)
      }
      if (error.code === 'PGRST301' || error.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new Error(`Database constraint error: ${error.message}`)
      }
      // Throw the error so UI can catch it
      throw error
    }

    if (!data) {
      console.error('[onboardingService] No data returned from insert')
      throw new Error('Failed to generate code: No data returned')
    }

    console.log('[onboardingService] Code inserted successfully:', code)
    return code
  },

  // Get code details
  async getCodeDetails(code: string): Promise<OnboardingCode | null> {
    try {
      // No need to wait for session - onboarding codes should be publicly readable
      const { data: rawData, error } = await supabase
        .from('onboarding_codes')
        .select('*, tenant:tenants(id, slug, display_name, is_onboarded)')
        .eq('code', code.toUpperCase())
        .maybeSingle() // Use maybeSingle() to handle "not found" gracefully

      const data = rawData as any

      if (error) {
        console.error('[onboardingService] Error fetching code details:', error)
        // RLS errors should be handled gracefully
        if (isPermissionError(error)) {
          throw new Error('Permission denied: Unable to verify code. Please check database permissions.')
        }
        // NOT_FOUND means "not found" - this is expected if code doesn't exist
        if (isNotFoundError(error)) {
          console.log('[onboardingService] Code not found:', code)
          return null
        }
        return null
      }

      if (!data) {
        return null
      }

      // Check if code is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null
      }

      // Check if tenant is already onboarded
      if (data.tenant?.is_onboarded) {
        return null
      }

      // Validate that tenant exists (prevent foreign key issues)
      if (!data.tenant || !data.tenant.id) {
        console.error('[onboardingService] Onboarding code has invalid tenant:', {
          code: code,
          tenant_id: data.tenant_id,
          tenant: data.tenant,
        })
        throw new Error('The practice associated with this onboarding code no longer exists. Please contact your administrator.')
      }

      return {
        id: data.id,
        tenantId: data.tenant.id, // Use tenant.id from the join, not tenant_id (more reliable)
        code: data.code,
        isUsed: data.is_used || false,
        usedAt: data.used_at,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
      }
    } catch (err) {
      console.error('[onboardingService] Exception in getCodeDetails:', err)
      throw err
    }
  },

  // Complete onboarding with credentials
  async completeOnboarding(data: OnboardingData): Promise<void> {
    try {
      // Step 1: Wait for session to be ready (for public access, this should be quick)
      const { error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[onboardingService] Session error:', sessionError)
        throw new Error(`Session error: ${sessionError.message}`)
      }

      // Step 2: Verify code and tenant
      const codeDetails = await this.getCodeDetails(data.code)
      if (!codeDetails) {
        throw new Error('Invalid or expired onboarding code')
      }

      if (codeDetails.isUsed) {
        throw new Error('This onboarding code has already been used')
      }

      // Step 2.5: Verify tenant exists BEFORE proceeding (prevent foreign key constraint violation)
      console.log('[onboardingService] Verifying tenant exists:', codeDetails.tenantId)

      if (!codeDetails.tenantId) {
        throw new Error('Onboarding code is invalid: missing tenant information. Please contact support.')
      }

      const { data: rTenantCheck, error: tenantCheckError } = await supabase
        .from('tenants')
        .select('id, slug, display_name, is_onboarded')
        .eq('id', codeDetails.tenantId)
        .maybeSingle()

      const tenantCheck = rTenantCheck as any

      if (tenantCheckError) {
        console.error('[onboardingService] Error checking tenant:', tenantCheckError)
        throw new Error(`Failed to verify practice: ${tenantCheckError.message}`)
      }

      if (!tenantCheck) {
        console.error('[onboardingService] Tenant not found for onboarding code:', {
          code: data.code,
          tenantId: codeDetails.tenantId,
        })
        throw new Error('The practice associated with this onboarding code no longer exists. Please contact your administrator for a new code.')
      }

      console.log('[onboardingService] Tenant verified:', {
        name: tenantCheck.display_name,
        slug: tenantCheck.slug,
        id: tenantCheck.id,
      })

      // Use the verified tenant ID (in case there was any mismatch)
      const verifiedTenantId = tenantCheck.id

      // Step 3: Create user in Supabase Auth
      // NOTE: The database trigger will automatically create the user in public.users
      // We just need to sign up and then call complete_onboarding to set tenant_id
      console.log('[onboardingService] Creating auth user with verified tenant_id:', verifiedTenantId)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'dentist',
            tenant_id: verifiedTenantId, // Use verified tenant ID
          },
        },
      })

      if (authError) {
        console.error('[onboardingService] Auth signup error:', authError)
        throw new Error(authError.message || 'Failed to create authentication account')
      }

      if (!authData.user) {
        throw new Error('Failed to create authentication account: No user returned')
      }

      console.log('[onboardingService] Auth user created, waiting for trigger to sync to public.users...')

      // Step 3.5: Wait for the trigger to create the user in public.users
      // The trigger should fire immediately, but we'll wait a moment to be safe
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify the user was created by the trigger
      const { data: triggerUser, error: triggerError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (triggerError && !isNotFoundError(triggerError)) {
        console.warn('[onboardingService] Error checking trigger-created user:', triggerError)
      }

      if (!triggerUser) {
        console.warn('[onboardingService] User not yet created by trigger, will be created by complete_onboarding function')
      } else {
        console.log('[onboardingService] User successfully created by trigger')
      }

      console.log('[onboardingService] Calling complete_onboarding function to set tenant_id and mark code as used...')

      // Step 4: Complete onboarding using database function (bypasses RLS)
      // This function creates the user record, marks code as used, and marks tenant as onboarded
      console.log('[onboardingService] Calling complete_onboarding with:', {
        user_id: authData.user.id,
        tenant_id: verifiedTenantId, // Use verified tenant ID
        code_id: codeDetails.id,
      })

      console.log('[onboardingService] Calling complete_onboarding RPC with:', {
        p_user_id: authData.user.id,
        p_user_email: data.email,
        p_user_name: data.name,
        p_user_role: 'dentist',
        p_user_tenant_id: verifiedTenantId,
        p_onboarding_code_id: codeDetails.id,
      })

      const { data: resultData, error: onboardingError } = await supabase.rpc('complete_onboarding', {
        p_user_id: authData.user.id,
        p_user_email: data.email,
        p_user_name: data.name,
        p_user_role: 'dentist',
        p_user_tenant_id: verifiedTenantId, // Use verified tenant ID (not from codeDetails)
        p_onboarding_code_id: codeDetails.id,
      } as any)

      if (onboardingError) {
        console.error('[onboardingService] Onboarding function error:', {
          code: onboardingError.code,
          message: onboardingError.message,
          details: onboardingError.details,
          hint: onboardingError.hint,
        })
        // If onboarding fails, try to clean up auth user
        // Note: We can't delete auth users directly, but the signup will be in a pending state
        if (onboardingError.code === '23505') {
          throw new Error('An account with this email already exists')
        }
        if (onboardingError.code === '42883' || onboardingError.message?.includes('function') || onboardingError.message?.includes('does not exist')) {
          throw new Error(`Database function error: The complete_onboarding function may not exist or have incorrect parameters. Please check the database. Error: ${onboardingError.message}`)
        }
        throw new Error(`Failed to complete onboarding: ${onboardingError.message}`)
      }

      console.log('[onboardingService] Onboarding RPC completed successfully, result:', resultData)

      // Step 4.5: Wait a moment for the database to commit and RLS to propagate
      // This helps prevent race conditions when auth state change fires
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 5: Verify the user exists and has tenant_id set
      const { data: rVerifyUser, error: verifyError } = await supabase
        .from('users')
        .select('id, email, role, tenant_id')
        .eq('id', authData.user.id)
        .maybeSingle()

      const verifyUser = rVerifyUser as any

      if (verifyError) {
        console.error('[onboardingService] Error verifying user after onboarding:', verifyError)
        // Don't throw - the user might exist but RLS might be blocking
        // The authService retry logic will handle this
      } else if (!verifyUser) {
        console.error('[onboardingService] WARNING: User was NOT found in public.users after onboarding!')
        throw new Error('Onboarding completed but user profile was not found. Please contact support.')
      } else {
        console.log('[onboardingService] User verified in public.users:', {
          id: verifyUser.id,
          email: verifyUser.email,
          role: verifyUser.role,
          tenant_id: verifyUser.tenant_id,
        })

        // Verify tenant_id was set correctly
        if (verifyUser.tenant_id !== verifiedTenantId) {
          console.warn('[onboardingService] WARNING: tenant_id mismatch!', {
            expected: verifiedTenantId,
            actual: verifyUser.tenant_id,
          })
        }
      }

      // Step 5: Verify tenant_id was set (safety check)
      const { data: rUserCheck, error: userCheckError } = await supabase
        .from('users')
        .select('id, tenant_id')
        .eq('id', authData.user.id)
        .single()

      const userCheck = rUserCheck as any

      if (userCheckError) {
        console.warn('[onboardingService] Could not verify user tenant_id:', userCheckError)
      } else if (!userCheck?.tenant_id) {
        console.error('[onboardingService] WARNING: User created but tenant_id is NULL!', {
          user_id: authData.user.id,
          tenant_id: userCheck?.tenant_id,
        })
        // Try to fix it manually using verified tenant ID
        const { error: fixError } = await (supabase
          .from('users') as any)
          .update({ tenant_id: verifiedTenantId } as any)
          .eq('id', authData.user.id)

        if (fixError) {
          console.error('[onboardingService] Failed to fix tenant_id:', fixError)
        } else {
          console.log('[onboardingService] Fixed tenant_id manually:', verifiedTenantId)
        }
      } else if (userCheck.tenant_id !== verifiedTenantId) {
        console.warn('[onboardingService] Tenant ID mismatch!', {
          expected: verifiedTenantId,
          actual: userCheck.tenant_id,
        })
        // Try to fix it
        const { error: fixError } = await (supabase
          .from('users') as any)
          .update({ tenant_id: verifiedTenantId } as any)
          .eq('id', authData.user.id)

        if (fixError) {
          console.error('[onboardingService] Failed to fix tenant_id mismatch:', fixError)
        } else {
          console.log('[onboardingService] Fixed tenant_id mismatch')
        }
      } else {
        console.log('[onboardingService] Verified tenant_id is set correctly:', userCheck.tenant_id)
      }
    } catch (err) {
      console.error('[onboardingService] Exception in completeOnboarding:', err)
      throw err
    }
  },

  // Get codes for a tenant (admin view)
  // NOTE: This should also use Edge Function in the future, but for now uses regular client
  // (onboarding_codes has public read access for onboarding flow)
  async getTenantCodes(tenantId: string, _useAdminClient = false): Promise<OnboardingCode[]> {
    // For now, use regular client (onboarding_codes has public read access)
    // TODO: Move to Edge Function for consistency
    const client = supabase

    const { data, error } = await client
      .from('onboarding_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch codes: ${error.message}`)
    }

    return (
      (data as any[])?.map((c: any) => ({
        id: c.id,
        tenantId: c.tenant_id,
        code: c.code,
        isUsed: c.is_used,
        usedAt: c.used_at,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
      })) || []
    )
  },
}


