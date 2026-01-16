import { toast } from 'sonner'

/**
 * Standardized notification utility for the application
 * Uses sonner for clean SaaS aesthetic toast notifications
 */

export const notifications = {
  /**
   * Show a success toast notification
   */
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3000,
    })
  },

  /**
   * Show an error toast notification
   */
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    })
  },

  /**
   * Show an info toast notification
   */
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3000,
    })
  },

  /**
   * Show a warning toast notification
   */
  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    })
  },

  /**
   * Show a loading toast notification
   * Returns a function to update/dismiss the toast
   */
  loading: (message: string) => {
    return toast.loading(message)
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (toastId: string | number) => {
    toast.dismiss(toastId)
  },
}

