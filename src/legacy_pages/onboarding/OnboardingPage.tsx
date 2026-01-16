import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, CheckCircle, AlertCircle } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { onboardingService } from '../../services/onboardingService'
import { supabase } from '../../lib/supabase'

type Step = 'code' | 'credentials' | 'success'

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenantInfo, setTenantInfo] = useState<{ name: string; slug: string } | null>(null)

  const handleCodeSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    // Safety timeout - force reset after 10 seconds
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
      setError('Request timed out. Please check your connection and try again.')
    }, 10000)

    try {
      const codeDetails = await onboardingService.getCodeDetails(code.toUpperCase())

      if (!codeDetails) {
        setError('Invalid or expired onboarding code. Please check and try again.')
        return
      }

      if (codeDetails.isUsed) {
        setError('This onboarding code has already been used.')
        return
      }

      // Get tenant info
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('display_name, slug')
        .eq('id', codeDetails.tenantId)
        .single()

      if (tenantError) {
        console.error('[OnboardingPage] Error fetching tenant:', tenantError)
        setError(tenantError.message || 'Failed to fetch tenant information.')
        return
      }

      if (tenant) {
        setTenantInfo({ name: tenant.display_name, slug: tenant.slug })
        setStep('credentials')
      } else {
        setError('Tenant not found.')
      }
    } catch (err) {
      console.error('[OnboardingPage] Error in handleCodeSubmit:', err)
      setError(err instanceof Error ? err.message : 'Failed to verify code')
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    // Validation
    if (credentials.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!credentials.email || !credentials.name) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)

    // Safety timeout - force reset after 15 seconds
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
      setError('Request timed out. Please check your connection and try again.')
    }, 15000)

    try {
      await onboardingService.completeOnboarding({
        code: code.toUpperCase(),
        email: credentials.email,
        password: credentials.password,
        name: credentials.name,
      })

      setStep('success')
    } catch (err) {
      console.error('[OnboardingPage] Error in handleCredentialsSubmit:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete onboarding'
      setError(errorMessage)

      // Provide helpful error messages
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        setError('Permission error: Please contact support or check database permissions.')
      } else if (errorMessage.includes('already exists')) {
        setError('An account with this email already exists. Please use a different email or log in.')
      }
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleSuccessContinue = () => {
    if (tenantInfo) {
      navigate(`/${tenantInfo.slug}/login`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {step === 'code' && (
          <GlassCard className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
                <Key className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Welcome to Your Practice Portal</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter your onboarding code to get started
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <GlassInput
                label="Onboarding Code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABCD1234"
                required
                maxLength={8}
                className="text-center text-lg font-mono tracking-wider"
              />
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <GlassButton type="submit" className="w-full" isLoading={isLoading}>
                Continue
              </GlassButton>
            </form>

            <p className="text-center text-xs text-slate-500">
              Don't have a code? Contact your administrator.
            </p>
          </GlassCard>
        )}

        {step === 'credentials' && tenantInfo && (
          <GlassCard className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
              <p className="mt-2 text-sm text-slate-600">
                Setting up access for <span className="font-semibold">{tenantInfo.name}</span>
              </p>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <GlassInput
                label="Full Name"
                value={credentials.name}
                onChange={(event) =>
                  setCredentials({ ...credentials, name: event.target.value })
                }
                placeholder="Dr. John Smith"
                required
              />
              <GlassInput
                label="Email"
                type="email"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials({ ...credentials, email: event.target.value })
                }
                placeholder="dentist@example.com"
                required
              />
              <GlassInput
                label="Password"
                type="password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials({ ...credentials, password: event.target.value })
                }
                placeholder="Create a secure password"
                required
                helperText="Must be at least 6 characters"
              />
              <GlassInput
                label="Confirm Password"
                type="password"
                value={credentials.confirmPassword}
                onChange={(event) =>
                  setCredentials({ ...credentials, confirmPassword: event.target.value })
                }
                placeholder="Re-enter your password"
                required
              />
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex gap-3">
                <GlassButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep('code')
                    setError(null)
                  }}
                  className="flex-1"
                >
                  Back
                </GlassButton>
                <GlassButton type="submit" className="flex-1" isLoading={isLoading}>
                  Create Account
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        )}

        {step === 'success' && (
          <GlassCard className="space-y-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Account Created Successfully!</h1>
            <p className="text-sm text-slate-600">
              Your account has been set up. You can now log in to access your practice portal.
            </p>
            <GlassButton onClick={handleSuccessContinue} className="w-full">
              Continue to Login
            </GlassButton>
          </GlassCard>
        )}
      </div>
    </div>
  )
}

