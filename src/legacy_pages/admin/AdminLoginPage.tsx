// @ts-nocheck
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Shield, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { useAdminStore } from '../../store/adminStore'

export const AdminLoginPage = () => {
  const navigate = useNavigate()
  const { login, isLoading, error, isAuthenticated, initialized, initialize } = useAdminStore()

  // Initialize and check if already logged in
  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  // Redirect if already authenticated
  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [initialized, isAuthenticated, navigate])
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await login(credentials.email, credentials.password)
      navigate('/admin/dashboard')
    } catch {
      // Error handled by store
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <GlassCard className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-slate-600" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">System Admin</p>
            <h2 className="text-2xl font-semibold text-slate-900">Admin Portal</h2>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <GlassInput
            label="Email"
            type="email"
            value={credentials.email}
            onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
            required
          />
          <GlassInput
            label="Password"
            type="password"
            value={credentials.password}
            onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            required
          />
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <GlassButton type="submit" className="w-full" isLoading={isLoading}>
            <Lock className="mr-2 h-4 w-4" />
            Access Admin Portal
          </GlassButton>
        </form>
        <p className="text-xs text-slate-500">
          This is a protected system area. Admin access only.
        </p>
      </GlassCard>
    </div>
  )
}

