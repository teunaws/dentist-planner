/**
 * Supabase/PostgREST error codes
 * These are standard error codes returned by Supabase/PostgREST
 * @see https://postgrest.org/en/stable/api.html#errors
 */
export const SUPABASE_ERROR_CODES = {
  /** The result contains 0 rows (when using .single() but no rows found) */
  NOT_FOUND: 'PGRST116',
  /** Permission denied / Row-level security policy violation */
  PERMISSION_DENIED: '42501',
  /** Unique constraint violation */
  UNIQUE_VIOLATION: '23505',
  /** Foreign key constraint violation */
  FOREIGN_KEY_VIOLATION: '23503',
  /** PostgREST timeout error */
  TIMEOUT: 'TIMEOUT',
} as const

/**
 * Helper function to check if an error is a "not found" error
 */
export const isNotFoundError = (error: any): boolean => {
  return error?.code === SUPABASE_ERROR_CODES.NOT_FOUND
}

/**
 * Helper function to check if an error is a permission/RLS error
 */
export const isPermissionError = (error: any): boolean => {
  return (
    error?.code === SUPABASE_ERROR_CODES.PERMISSION_DENIED ||
    error?.message?.includes('row-level security') ||
    error?.message?.includes('permission denied') ||
    error?.message?.includes('RLS')
  )
}

