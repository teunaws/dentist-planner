import * as Sentry from '@sentry/react'

/**
 * Test Sentry Integration Page
 * 
 * This page provides buttons to test various Sentry error capture scenarios.
 * Remove this file after testing, or keep it for future debugging.
 */
export function TestSentry() {
  // Test 1: Error Boundary (React Component Error)
  const triggerErrorBoundary = () => {
    throw new Error('Test Sentry Error Boundary - This should show the ErrorPage component!')
  }

  // Test 2: Manual Error Capture
  const triggerManualCapture = () => {
    try {
      throw new Error('Manual Sentry test error - captured explicitly')
    } catch (error) {
      Sentry.captureException(error)
      alert('Error sent to Sentry! Check your dashboard.')
    }
  }

  // Test 3: Unhandled Promise Rejection
  const triggerPromiseRejection = () => {
    Promise.reject(new Error('Test Sentry Promise Rejection - unhandled'))
  }

  // Test 4: Add Breadcrumb
  const addBreadcrumb = () => {
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'User clicked test button',
      level: 'info',
    })
    alert('Breadcrumb added! Trigger an error to see it in Sentry.')
  }

  // Test 5: Capture Message (not an error, just a message)
  const captureMessage = () => {
    Sentry.captureMessage('Test message from Sentry test page', 'info')
    alert('Message sent to Sentry!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Sentry Integration Test</h1>
          <p className="text-slate-600 mb-8">
            Use these buttons to test different Sentry error capture scenarios.
            Check your Sentry dashboard after each test.
          </p>

          <div className="space-y-4">
            {/* Test 1: Error Boundary */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Test 1: Error Boundary</h2>
              <p className="text-sm text-slate-600 mb-3">
                This will trigger a React error that should be caught by the ErrorBoundary
                and show the ErrorPage component.
              </p>
              <button
                onClick={triggerErrorBoundary}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Trigger Error Boundary
              </button>
            </div>

            {/* Test 2: Manual Capture */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Test 2: Manual Error Capture</h2>
              <p className="text-sm text-slate-600 mb-3">
                This explicitly captures an error using Sentry.captureException()
              </p>
              <button
                onClick={triggerManualCapture}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Capture Exception
              </button>
            </div>

            {/* Test 3: Promise Rejection */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Test 3: Unhandled Promise Rejection</h2>
              <p className="text-sm text-slate-600 mb-3">
                This creates an unhandled promise rejection that Sentry should catch.
              </p>
              <button
                onClick={triggerPromiseRejection}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                Trigger Promise Rejection
              </button>
            </div>

            {/* Test 4: Breadcrumb */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Test 4: Add Breadcrumb</h2>
              <p className="text-sm text-slate-600 mb-3">
                Adds a breadcrumb to Sentry. Trigger an error after this to see the breadcrumb in context.
              </p>
              <button
                onClick={addBreadcrumb}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Add Breadcrumb
              </button>
            </div>

            {/* Test 5: Capture Message */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Test 5: Capture Message</h2>
              <p className="text-sm text-slate-600 mb-3">
                Sends an informational message to Sentry (not an error).
              </p>
              <button
                onClick={captureMessage}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Send Message
              </button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-slate-900 mb-2">How to Verify</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
              <li>Open your Sentry dashboard at https://sentry.io</li>
              <li>Navigate to your project → Issues</li>
              <li>Click on a test error to see details, stack trace, and breadcrumbs</li>
              <li>Errors should appear within 5-10 seconds</li>
            </ol>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Make sure <code>VITE_SENTRY_DSN</code> is set in your <code>.env.local</code> file
              and restart your dev server after adding it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

