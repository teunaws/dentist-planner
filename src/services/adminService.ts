import { supabase } from '../lib/supabase'
import type { TenantConfig, ServiceDefinition } from '../types/tenant'

// Call Edge Function for admin operations
async function callAdminFunction(action: string, payload?: any, signal?: AbortSignal, retryCount = 0): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session. Please log in first.')
  }

  // Check if request was aborted before making the call
  if (signal && signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  // If AbortSignal is provided, use native fetch for proper cancellation support
  if (signal) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const functionUrl = `${supabaseUrl}/functions/v1/admin-api`

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action,
          payload,
        }),
        signal, // Pass AbortSignal to native fetch
      })

      // Check if request was aborted
      if (signal && signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }

      if (!response.ok) {
        // CRITICAL: Handle 401 Unauthorized by refreshing session and retrying once
        if (response.status === 401 && retryCount === 0) {
          console.warn('[adminService] Got 401 error (with signal), refreshing session and retrying...')
          try {
            const refreshPromise = supabase.auth.refreshSession()
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('refreshSession timeout')), 3000)
            )

            const { data: refreshData, error: refreshError } = await Promise.race([
              refreshPromise,
              timeoutPromise
            ]) as any

            if (refreshError || !refreshData?.session) {
              throw new Error('Session expired. Please log in again.')
            }

            console.log('[adminService] Session refreshed, retrying API call...')
            return callAdminFunction(action, payload, signal, retryCount + 1)
          } catch (refreshErr: any) {
            throw new Error('Session expired. Please log in again.')
          }
        }

        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data?.error) {
        throw new Error(data.error)
      }

      return data?.data
    } catch (err) {
      // Re-throw AbortError as-is
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      throw err
    }
  }

  // Use native fetch for better error handling (can extract response body from errors)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const functionUrl = `${supabaseUrl}/functions/v1/admin-api`

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        action,
        payload,
      }),
    })

    const responseData = await response.json().catch(() => ({ error: 'Failed to parse response' }))

    if (!response.ok) {
      // CRITICAL: Handle 401 Unauthorized by refreshing session and retrying once
      if (response.status === 401 && retryCount === 0) {
        console.warn('[adminService] Got 401 error, refreshing session and retrying...')
        try {
          // Refresh session with timeout
          const refreshPromise = supabase.auth.refreshSession()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('refreshSession timeout')), 3000)
          )

          const { data: refreshData, error: refreshError } = await Promise.race([
            refreshPromise,
            timeoutPromise
          ]) as any

          if (refreshError || !refreshData?.session) {
            console.error('[adminService] Session refresh failed on 401:', refreshError?.message)
            throw new Error('Session expired. Please log in again.')
          }

          console.log('[adminService] Session refreshed, retrying API call...')
          // Retry the call with the refreshed session (only once)
          return callAdminFunction(action, payload, signal, retryCount + 1)
        } catch (refreshErr: any) {
          if (refreshErr?.message?.includes('timeout')) {
            console.error('[adminService] Session refresh timed out on 401')
          }
          throw new Error('Session expired. Please log in again.')
        }
      }

      const errorMessage = responseData?.error || responseData?.message || `HTTP ${response.status}: ${response.statusText}`
      let fullErrorMessage = errorMessage

      if (responseData?.details) {
        fullErrorMessage += ` (${responseData.details})`
      }
      if (responseData?.hint) {
        fullErrorMessage += ` - Hint: ${responseData.hint}`
      }
      if (responseData?.code) {
        fullErrorMessage += ` [Code: ${responseData.code}]`
      }

      console.error(`[adminService] Error calling ${action}:`, {
        status: response.status,
        statusText: response.statusText,
        error: responseData,
        retryCount,
      })

      throw new Error(fullErrorMessage)
    }

    if (responseData?.error) {
      throw new Error(responseData.error)
    }

    return responseData?.data
  } catch (err) {
    // Re-throw if it's already an Error with a message
    if (err instanceof Error) {
      throw err
    }
    console.error(`[adminService] Exception calling ${action}:`, err)
    throw new Error(`Failed to ${action}: ${err}`)
  }
}

// Note: Tenant transformation is now handled server-side in the Edge Function
// This service only handles HTTP calls to the admin-api Edge Function

export const adminService = {
  async getAllTenants(page = 1, limit = 10, showDeleted = false, signal?: AbortSignal): Promise<{ tenants: TenantConfig[]; count: number }> {
    try {
      const result = await callAdminFunction('list_tenants', { page, limit, showDeleted }, signal)
      return {
        tenants: result?.tenants || [],
        count: result?.count || 0,
      }
    } catch (error) {
      // Don't log AbortError - it's expected when requests are cancelled
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[adminService] Error fetching tenants:', error)
      }
      throw error
    }
  },

  async getTenant(slug: string): Promise<TenantConfig | null> {
    try {
      const config = await callAdminFunction('get_tenant', { slug })
      return config || null
    } catch (error) {
      console.error('[adminService] Error fetching tenant:', error)
      // Return null if not found (404), throw for other errors
      if (error instanceof Error && error.message.includes('not found')) {
        return null
      }
      throw error
    }
  },

  async createTenant(config: TenantConfig): Promise<TenantConfig> {
    try {
      const tenantConfig = await callAdminFunction('create_tenant', config)
      if (!tenantConfig) {
        throw new Error('Failed to create tenant')
      }
      return tenantConfig
    } catch (error) {
      console.error('[adminService] Error creating tenant:', error)
      throw error
    }
  },

  async updateTenant(slug: string, updates: Partial<TenantConfig>): Promise<TenantConfig> {
    try {
      console.log('[adminService] updateTenant called with:', { slug, updates })
      const tenantConfig = await callAdminFunction('update_tenant', { slug, updates })
      if (!tenantConfig) {
        throw new Error('Failed to update tenant')
      }
      console.log('[adminService] updateTenant successful, returned config:', {
        address: tenantConfig.address,
        timezone: tenantConfig.timezone,
        phone: tenantConfig.phone,
        email: tenantConfig.email,
      })
      return tenantConfig
    } catch (error) {
      console.error('[adminService] Error updating tenant:', error)
      throw error
    }
  },

  async deleteTenant(slug: string): Promise<void> {
    try {
      await callAdminFunction('delete_tenant', { slug })
      console.log(`[adminService] Successfully deleted (soft) tenant: ${slug}`)
    } catch (error) {
      console.error('[adminService] Error deleting tenant:', error)
      throw error
    }
  },

  async restoreTenant(slug: string): Promise<void> {
    try {
      await callAdminFunction('restore_tenant', { slug })
      console.log(`[adminService] Successfully restored tenant: ${slug}`)
    } catch (error) {
      console.error('[adminService] Error restoring tenant:', error)
      throw error
    }
  },

  async updateTenantServices(slug: string, services: ServiceDefinition[]): Promise<TenantConfig> {
    try {
      const tenantConfig = await callAdminFunction('update_tenant_services', { slug, services })
      if (!tenantConfig) {
        throw new Error('Failed to update tenant services')
      }
      return tenantConfig
    } catch (error) {
      console.error('[adminService] Error updating tenant services:', error)
      throw error
    }
  },
}
