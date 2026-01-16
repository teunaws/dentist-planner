import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { GlassInput } from '../../components/ui/GlassInput'
import { useAuthStore } from '../../store/authStore'
import { useTenant } from '../../context/TenantContext'
import { authService } from '../../services/authService'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { tenant } = useParams()
  const { slug, config } = useTenant()
  const { user, initialized, login, isLoading, error } = useAuthStore()
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  })

  // Auto-clean stale sessions: If user is logged in to a different tenant, sign them out
  useEffect(() => {
    if (!initialized || !user || !config) {
      return
    }

    // If user is logged in to a different tenant (and not admin), auto-sign out
    if (user.tenant_id && user.tenant_id !== config.id && user.role !== 'admin') {
      console.log('[LoginPage] Auto-cleaning stale session: User belongs to different tenant', {
        userTenantId: user.tenant_id,
        pageTenantId: config.id,
        slug
      })
      // Silently sign out so user sees empty login form
      void authService.signOut().then(() => {
        void useAuthStore.getState().logout()
      })
    }
  }, [user, config, initialized, slug])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await login(credentials.email, credentials.password, 'dentist')
      // Navigate to tenant-specific dentist route
      const tenantSlug = slug || tenant || 'lumina'
      navigate(`/${tenantSlug}/dentist`)
    } catch {
      // handled via store error
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <ShieldCheck className="h-10 w-10 text-slate-600" />
      <GlassCard className="w-full">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Dentist Access</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500">
              Use the practice credentials to open the planning suite.
            </p>
          </div>
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
            onChange={(event) =>
              setCredentials({
                ...credentials,
                password: event.target.value,
              })
            }
            required
          />
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <GlassButton
            type="submit"
            className="mt-2"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Enter dentist portal
          </GlassButton>
        </form>
      </GlassCard>
      <p className="text-xs text-slate-500">
        Patients can book directly from the home page.
      </p>
    </section>
  )
}

