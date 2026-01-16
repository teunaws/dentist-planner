import { useState } from 'react'
import type { FormEvent } from 'react'
import { X, Calendar, Clock } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { GlassButton } from '../ui/GlassButton'
import { GlassInput } from '../ui/GlassInput'
import { useOptimisticBlockTime } from '../../hooks/useOptimisticBlockTime'

interface BlockTimeModalProps {
  onClose: () => void
  onSuccess: (createdAppointment?: any) => void
  tenantId: string
  defaultDate?: Date
  defaultStartTime?: string
  defaultEndTime?: string
}

// Helper to parse military time string (HH:MM) to hours and minutes
const parseMilitaryTime = (timeStr: string): { hour: number; minute: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hour: hours || 12, minute: minutes || 0 }
}

// Helper to format hours and minutes to military time string (HH:MM)
const formatMilitaryTime = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

// Generate hour options (0-23)
const hourOptions = Array.from({ length: 24 }, (_, i) => i)

// Generate minute options (0, 15, 30, 45)
const minuteOptions = [0, 10, 20, 30, 40, 50]

export const BlockTimeModal = ({
  onClose,
  onSuccess,
  tenantId,
  defaultDate,
  defaultStartTime = '12:00',
  defaultEndTime = '13:00',
}: BlockTimeModalProps) => {
  // Parse default times or use defaults
  const defaultStart = parseMilitaryTime(defaultStartTime || '12:00')
  const defaultEnd = parseMilitaryTime(defaultEndTime || '13:00')

  const [formData, setFormData] = useState({
    date: defaultDate
      ? defaultDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    startHour: defaultStart.hour,
    startMinute: defaultStart.minute,
    endHour: defaultEnd.hour,
    endMinute: defaultEnd.minute,
    reason: '',
  })

  const [error, setError] = useState<string | null>(null)

  const { mutate: blockTime, isPending: isSubmitting } = useOptimisticBlockTime({
    tenantId,
    onSuccess: (data) => {
      onSuccess(data) // Pass data up
      onClose()
    },
    onError: (err) => {
      setError(err.message)
    }
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    // Convert to military time strings
    const startTime = formatMilitaryTime(formData.startHour, formData.startMinute)
    const endTime = formatMilitaryTime(formData.endHour, formData.endMinute)

    // Convert times to minutes for validation
    const startMinutes = formData.startHour * 60 + formData.startMinute
    const endMinutes = formData.endHour * 60 + formData.endMinute

    if (endMinutes <= startMinutes) {
      setError('End time must be after start time')
      return
    }

    // Trigger Optimistic Mutation
    blockTime({
      tenantId,
      date: formData.date,
      startTime,
      endTime,
      reason: formData.reason,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <GlassCard className="relative w-full max-w-md space-y-4">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Block Time</p>
          <h2 className="text-xl font-semibold text-slate-900">Unavailable Period</h2>
          <p className="mt-1 text-xs text-slate-500">Mark time as unavailable for bookings</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              <Calendar className="mr-1.5 inline h-3.5 w-3.5" />
              Date
            </label>
            <GlassInput
              type="date"
              value={formData.date}
              onChange={(event) => setFormData({ ...formData, date: event.target.value })}
              required
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                <Clock className="mr-1.5 inline h-3.5 w-3.5" />
                Start Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.startHour}
                  onChange={(e) =>
                    setFormData({ ...formData, startHour: parseInt(e.target.value, 10) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <select
                  value={formData.startMinute}
                  onChange={(e) =>
                    setFormData({ ...formData, startMinute: parseInt(e.target.value, 10) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-500">24-hour format</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                <Clock className="mr-1.5 inline h-3.5 w-3.5" />
                End Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.endHour}
                  onChange={(e) =>
                    setFormData({ ...formData, endHour: parseInt(e.target.value, 10) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <select
                  value={formData.endMinute}
                  onChange={(e) =>
                    setFormData({ ...formData, endMinute: parseInt(e.target.value, 10) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-500">24-hour format</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Reason (Optional)</label>
            <GlassInput
              value={formData.reason}
              onChange={(event) => setFormData({ ...formData, reason: event.target.value })}
              placeholder="e.g., Lunch break, Maintenance"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" isLoading={isSubmitting} className="flex-1">
              Block Time
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
