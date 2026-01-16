
// import { useNavigate } from 'react-router-dom' // Removed for Next.js migration

/**
 * Error Page Component
 * 
 * Fallback UI shown when Sentry ErrorBoundary catches an unhandled React error.
 * Provides a user-friendly error message and a way to reload the application.
 */
export function ErrorPage() {
  // const navigate = useNavigate()

  const handleReload = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    // navigate('/')
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-slate-600 mb-6">
            We're sorry, but something unexpected happened. Our team has been notified and is looking into it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReload}
            className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            Reload Page
          </button>
          <button
            onClick={handleGoHome}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Go Home
          </button>
        </div>


        <p className="mt-6 text-xs text-slate-500">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  )
}

