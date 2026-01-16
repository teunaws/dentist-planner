import { useState, useEffect } from 'react'
import { X, Clock } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { GlassButton } from '../ui/GlassButton'
import { GlassInput } from '../ui/GlassInput'
import { adminService } from '../../services/adminService'
import type { TenantConfig } from '../../types/tenant'

interface EditOperatingHoursModalProps {
  isOpen: boolean
  onClose: () => void
  config: TenantConfig | null
  onSuccess: () => void
}

export const EditOperatingHoursModal = ({
  isOpen,
  onClose,
  config,
  onSuccess,
}: EditOperatingHoursModalProps) => {
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (config?.schedule?.operatingHours) {
      setStartHour(config.schedule.operatingHours.startHour)
      setEndHour(config.schedule.operatingHours.endHour)
    }
  }, [config, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    if (startHour >= endHour) {
      setError('End hour must be after start hour')
      return
    }
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      setError('Hours must be between 0 and 23')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      if (!config?.slug) {
        throw new Error('Tenant slug not found')
      }

      // Update only the operating hours, preserving existing schedule data
      const currentSchedule = config.schedule
      await adminService.updateTenant(config.slug, {
        schedule: {
          ...currentSchedule,
          operatingHours: {
            startHour,
            endHour,
          },
        },
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update operating hours')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <GlassCard className="relative w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">Edit Operating Hours</h2>
          </div>
          <p className="text-sm text-slate-600">
            Set your practice's operating hours. These hours determine when appointments can be booked.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Opening Hour"
              type="number"
              min="0"
              max="23"
              value={startHour}
              onChange={(e) => setStartHour(parseInt(e.target.value, 10) || 0)}
              placeholder="9"
            />
            <GlassInput
              label="Closing Hour"
              type="number"
              min="0"
              max="23"
              value={endHour}
              onChange={(e) => setEndHour(parseInt(e.target.value, 10) || 0)}
              placeholder="17"
            />
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Preview</p>
            <p className="text-sm text-slate-600">
              Operating hours: {startHour.toString().padStart(2, '0')}:00 - {endHour.toString().padStart(2, '0')}:00
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <GlassButton variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton onClick={handleSave} isLoading={isSaving} className="flex-1">
            Save Changes
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  )
}

