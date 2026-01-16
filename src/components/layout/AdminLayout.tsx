// @ts-nocheck
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'

export const AdminLayout = () => {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <Toaster position="top-right" richColors />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <main className="flex-1 px-4 pb-12 md:px-10 pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

