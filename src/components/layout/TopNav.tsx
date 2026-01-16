import { useRouter, usePathname, useParams } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { useTenant } from '../../context/TenantContext'
import { cn } from '../../lib/utils'

const navItems = [
  { path: '', label: 'Dashboard' }, // Empty path for root dashboard
  { path: 'analytics', label: 'Analytics' },
  { path: 'services', label: 'Services' },
  { path: 'team', label: 'Team' },
  { path: 'settings', label: 'Settings' },
]

export const TopNav = () => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const { user } = useAuthStore()
  const { config } = useTenant()

  // Get slug from params or config, fallback to 'lumina'
  // params.dentist_slug should be available if inside [dentist_slug] route
  const slug = (params?.dentist_slug as string) || config?.slug || 'lumina'

  const practiceName = config?.displayName ?? 'Practice Management'

  const isActive = (path: string) => {
    // Construct expected path segment
    const tenantPrefix = `/${params.locale || 'en'}/${slug}`
    // If path is empty (Dashboard), check if we are exactly at tenant root OR tenant/dashboard
    if (path === '') {
      return pathname === `${tenantPrefix}/dashboard` || pathname === `${tenantPrefix}`
    }
    return pathname.includes(`/${path}`)
  }

  return (
    <nav className="h-16 w-full flex-shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left Side: Logo + Tenant Name + Nav Tabs */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <img
              src="/favicon-dark.png"
              alt="Dentist Planner Logo"
              className="h-full w-full object-contain p-1.5"
            />
          </div>

          {/* Tenant Name */}
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
            <span className="truncate max-w-[200px]">{practiceName}</span>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = isActive(item.path)
              const targetPath = item.path === ''
                ? `dashboard`
                : item.path

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    router.push(`/${params.locale || 'en'}/${slug}/${targetPath}`)
                  }}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900',
                    active && 'text-slate-900 border-b-2 border-slate-900',
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Side: Profile Only */}
        <div className="flex items-center gap-2">
          {user?.name && (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-900">
                {user.name[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="hidden text-sm font-medium text-slate-700 md:inline">
                Hi, {user.name}
              </span>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
