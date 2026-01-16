import { useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { GlassButton } from '../ui/GlassButton'
import { GlassInput } from '../ui/GlassInput'
import { adminService } from '../../services/adminService'
import type { TenantConfig } from '../../types/tenant'

interface EditTenantModalProps {
  tenant: TenantConfig
  onClose: () => void
  onSuccess: () => void
}

export const EditTenantModal = ({ tenant, onClose, onSuccess }: EditTenantModalProps) => {
  const [formData, setFormData] = useState({
    slug: tenant.slug,
    displayName: tenant.displayName,
    eyebrow: tenant.hero.eyebrow,
    heading: tenant.hero.heading,
    subheading: tenant.hero.subheading,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await adminService.updateTenant(tenant.slug, {
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        displayName: formData.displayName,
        hero: {
          eyebrow: formData.eyebrow,
          heading: formData.heading,
          subheading: formData.subheading,
        },
      })
      onSuccess()
    } catch (error) {
      console.error('Failed to update tenant:', error)
      alert('Failed to update tenant. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <GlassCard className="relative w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Edit Tenant</p>
          <h2 className="text-2xl font-semibold text-slate-900">{tenant.displayName}</h2>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <GlassInput
            label="URL Slug"
            value={formData.slug}
            onChange={(event) => setFormData({ ...formData, slug: event.target.value })}
            required
            helperText="Changing slug will affect the URL"
          />
          <GlassInput
            label="Display Name"
            value={formData.displayName}
            onChange={(event) => setFormData({ ...formData, displayName: event.target.value })}
            required
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Hero Content</p>
            <GlassInput
              label="Eyebrow Text"
              value={formData.eyebrow}
              onChange={(event) => setFormData({ ...formData, eyebrow: event.target.value })}
            />
            <GlassInput
              label="Heading"
              value={formData.heading}
              onChange={(event) => setFormData({ ...formData, heading: event.target.value })}
            />
            <GlassInput
              label="Subheading"
              value={formData.subheading}
              onChange={(event) => setFormData({ ...formData, subheading: event.target.value })}
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Operating Hours (Read-only)</p>
            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">Start Hour</p>
                <p className="text-lg font-semibold text-slate-900">
                  {tenant.schedule.operatingHours.startHour.toString().padStart(2, '0')}:00
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">End Hour</p>
                <p className="text-lg font-semibold text-slate-900">
                  {tenant.schedule.operatingHours.endHour.toString().padStart(2, '0')}:00
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500 mb-2">Services</p>
              <p className="text-lg font-semibold text-slate-900">{tenant.services.length} configured</p>
            </div>
          </div>

          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" isLoading={isSubmitting} className="flex-1">
              Save Changes
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}

