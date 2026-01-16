import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/**
 * Wraps a promise with a timeout to prevent hanging indefinitely
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds
 * @param label Label for error messages (for debugging)
 */
export const withTimeout = <T>(promise: Promise<T> | PromiseLike<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout] ${label} took longer than ${ms}ms`)), ms)
    )
  ])
}

