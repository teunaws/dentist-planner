import { useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { GlassButton } from '../ui/GlassButton'
import { GlassInput } from '../ui/GlassInput'
import { adminService } from '../../services/adminService'
import type { TenantConfig } from '../../types/tenant'

interface CreateTenantModalProps {
  onClose: () => void
  onSuccess: () => void
}

export const CreateTenantModal = ({ onClose, onSuccess }: CreateTenantModalProps) => {
  const [formData, setFormData] = useState({
    slug: '',
    displayName: '',
    eyebrow: '',
    heading: '',
    subheading: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const newTenant: TenantConfig = {
        id: '', // Will be set by backend
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        displayName: formData.displayName,
        isOnboarded: false,
        hero: {
          eyebrow: formData.eyebrow,
          heading: formData.heading,
          subheading: formData.subheading,
        },
        services: [],
        availability: {
          slots: ['09:00 AM', '10:30 AM', '02:00 PM', '03:30 PM'],
        },
        sampleAppointments: [],
        schedule: {
          appointments: [],
          operatingHours: {
            startHour: 9,
            endHour: 17,
          },
          durationMap: {},
        },
      }

      await adminService.createTenant(newTenant)
      onSuccess()
    } catch (error) {
      console.error('Failed to create tenant:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tenant. Please try again.'
      alert(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <GlassCard className="relative w-full max-w-2xl space-y-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Create New Tenant</p>
          <h2 className="text-2xl font-semibold text-slate-900">Add Practice</h2>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <GlassInput
            label="URL Slug"
            value={formData.slug}
            onChange={(event) => setFormData({ ...formData, slug: event.target.value })}
            placeholder="lumina-dental"
            required
            helperText="Used in URL: /lumina-dental/book"
          />
          <GlassInput
            label="Display Name"
            value={formData.displayName}
            onChange={(event) => setFormData({ ...formData, displayName: event.target.value })}
            placeholder="Lumina Dental Studio"
            required
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Hero Content</p>
            <GlassInput
              label="Eyebrow Text"
              value={formData.eyebrow}
              onChange={(event) => setFormData({ ...formData, eyebrow: event.target.value })}
              placeholder="Modern Dental Care"
            />
            <GlassInput
              label="Heading"
              value={formData.heading}
              onChange={(event) => setFormData({ ...formData, heading: event.target.value })}
              placeholder="Book your appointment"
            />
            <GlassInput
              label="Subheading"
              value={formData.subheading}
              onChange={(event) => setFormData({ ...formData, subheading: event.target.value })}
              placeholder="Easy online booking"
            />
          </div>

          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" isLoading={isSubmitting} className="flex-1">
              Create Tenant
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}

