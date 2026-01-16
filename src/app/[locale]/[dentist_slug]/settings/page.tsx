'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Settings as SettingsIcon,
  Clock,
  Save,
  Building2,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { GlassCard } from '../../../../components/ui/GlassCard'
import { GlassButton } from '../../../../components/ui/GlassButton'
import { GlassInput } from '../../../../components/ui/GlassInput'
import { useTenant } from '../../../../context/TenantContext'
import { useAuthStore } from '../../../../store/authStore'
import { adminService } from '../../../../services/adminService'
import { notifications } from '../../../../lib/notifications'
import { EmailSettings } from '../../../../components/settings/EmailSettings'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const

const TIMEZONES = [
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  // Europe
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Vienna',
  'Europe/Prague',
  'Europe/Warsaw',
  'Europe/Stockholm',
  'Europe/Copenhagen',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Lisbon',
  'Europe/Budapest',
  'Europe/Bucharest',
  'Europe/Sofia',
  'Europe/Zagreb',
  'Europe/Belgrade',
  'Europe/Moscow',
  'Europe/Kiev',
  'Europe/Istanbul',
]

interface TimeSlot {
  start: string
  end: string
}

interface DaySlots {
  enabled: boolean
  slots: TimeSlot[]
}

interface OperatingHoursSlots {
  monday: DaySlots
  tuesday: DaySlots
  wednesday: DaySlots
  thursday: DaySlots
  friday: DaySlots
  saturday: DaySlots
  sunday: DaySlots
}

interface PracticeProfile {
  practiceName: string
  address: string
  phone: string
  email: string
  timezone: string
}

interface BookingFormField {
  visible: boolean
  required: boolean
}

interface BookingFormConfig {
  dateOfBirth: BookingFormField
  homeAddress: BookingFormField
  insuranceProvider: BookingFormField
  emergencyContact: BookingFormField
  reasonForVisit: BookingFormField
}

export default function SettingsPage() {
  // const { tenant } = useParams() // Handled via context
  const { config, refresh, updateConfig } = useTenant()
  const { user } = useAuthStore()

  // State management
  const [practiceProfile, setPracticeProfile] = useState<PracticeProfile>({
    practiceName: '',
    address: '',
    phone: '',
    email: '',
    timezone: 'America/New_York',
  })
  const [operatingHoursSlots, setOperatingHoursSlots] = useState<OperatingHoursSlots>({
    monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
    tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
    wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
    thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
    friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
    saturday: { enabled: true, slots: [{ start: '09:00', end: '13:00' }] },
    sunday: { enabled: false, slots: [{ start: '09:00', end: '17:00' }] },
  })
  const [bookingFormConfig, setBookingFormConfig] = useState<BookingFormConfig>({
    dateOfBirth: { visible: false, required: false },
    homeAddress: { visible: false, required: false },
    insuranceProvider: { visible: false, required: false },
    emergencyContact: { visible: false, required: false },
    reasonForVisit: { visible: false, required: false },
  })
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'email'>('general')
  const [isSavingBookingConfig, setIsSavingBookingConfig] = useState(false)

  // Track if this is the initial load to prevent auto-saving on mount
  const isInitialLoad = useRef(true)
  const saveTimeoutRef = useRef<number | null>(null)

  // Auto-save booking form config when it changes (debounced)
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }

    // Skip if config is not loaded yet
    if (!config?.slug) {
      return
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce: wait 500ms after last change before saving
    saveTimeoutRef.current = window.setTimeout(async () => {
      console.log('[SettingsPage] Auto-saving booking form config:', JSON.stringify(bookingFormConfig, null, 2))
      setIsSavingBookingConfig(true)

      try {
        const updatedConfig = await adminService.updateTenant(config.slug, { bookingFormConfig })
        console.log('[SettingsPage] Booking form config auto-saved successfully')
        // Update the global context immediately with the returned config
        if (updatedConfig) {
          updateConfig(updatedConfig)
        }
      } catch (err) {
        console.error('[SettingsPage] Error auto-saving booking form config:', err)
        // Silently fail - don't show error to user for background saves
      } finally {
        setIsSavingBookingConfig(false)
      }
    }, 500) // 500ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [bookingFormConfig, config?.slug, updateConfig])

  useEffect(() => {
    if (config) {
      // Load practice profile
      setPracticeProfile({
        practiceName: config.displayName || '',
        address: config.address || '',
        phone: config.phone || '',
        email: config.email || '',
        timezone: config.timezone || 'America/New_York',
      })

      // Load booking form configuration
      if (config.bookingFormConfig) {
        console.log('[SettingsPage] Loading bookingFormConfig from config:', JSON.stringify(config.bookingFormConfig, null, 2))
        // Set initial load flag to prevent auto-save on mount
        isInitialLoad.current = true
        setBookingFormConfig(config.bookingFormConfig)
      } else {
        console.log('[SettingsPage] No bookingFormConfig in config, using defaults')
        isInitialLoad.current = true
      }

      // Migrate operating hours to slots format if needed
      if (config.schedule?.operatingHoursPerDay) {
        const migrated: OperatingHoursSlots = {
          monday: {
            enabled: config.schedule.operatingHoursPerDay.monday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.monday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.monday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          tuesday: {
            enabled: config.schedule.operatingHoursPerDay.tuesday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.tuesday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.tuesday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          wednesday: {
            enabled: config.schedule.operatingHoursPerDay.wednesday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.wednesday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.wednesday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          thursday: {
            enabled: config.schedule.operatingHoursPerDay.thursday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.thursday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.thursday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          friday: {
            enabled: config.schedule.operatingHoursPerDay.friday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.friday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.friday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          saturday: {
            enabled: config.schedule.operatingHoursPerDay.saturday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.saturday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.saturday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
          sunday: {
            enabled: config.schedule.operatingHoursPerDay.sunday.enabled,
            slots: [
              {
                start: `${config.schedule.operatingHoursPerDay.sunday.startHour.toString().padStart(2, '0')}:00`,
                end: `${config.schedule.operatingHoursPerDay.sunday.endHour.toString().padStart(2, '0')}:00`,
              },
            ],
          },
        }
        setOperatingHoursSlots(migrated)
      }
    }
  }, [config])

  const router = useRouter()
  // const tenant = params.dentist_slug
  const slug = config?.slug || 'lumina'

  useEffect(() => {
    if (user && user.role !== 'dentist') {
      router.replace(`/${slug}/login`)
    }
  }, [user, slug, router])

  if (!user || user.role !== 'dentist') {
    return null
  }

  const validateTimeSlots = (day: DaySlots, dayLabel: string): string | null => {
    if (!day.enabled) return null

    for (const slot of day.slots) {
      const [startHour, startMin] = slot.start.split(':').map(Number)
      const [endHour, endMin] = slot.end.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      if (startMinutes >= endMinutes) {
        return `${dayLabel}: Start time must be before end time`
      }
    }

    // Check for overlaps
    for (let i = 0; i < day.slots.length; i++) {
      for (let j = i + 1; j < day.slots.length; j++) {
        const slot1 = day.slots[i]
        const slot2 = day.slots[j]
        const [s1h, s1m] = slot1.start.split(':').map(Number)
        const [e1h, e1m] = slot1.end.split(':').map(Number)
        const [s2h, s2m] = slot2.start.split(':').map(Number)
        const [e2h, e2m] = slot2.end.split(':').map(Number)

        const s1 = s1h * 60 + s1m
        const e1 = e1h * 60 + e1m
        const s2 = s2h * 60 + s2m
        const e2 = e2h * 60 + e2m

        if ((s1 < e2 && e1 > s2) || (s2 < e1 && e2 > s1)) {
          return `${dayLabel}: Time slots cannot overlap`
        }
      }
    }

    return null
  }

  const handleSave = async () => {
    console.log('[SettingsPage] ===== handleSave CALLED =====')
    console.log('[SettingsPage] Current bookingFormConfig state:', JSON.stringify(bookingFormConfig, null, 2))
    setError(null)

    // Validate operating hours
    for (const day of DAYS) {
      const validationError = validateTimeSlots(operatingHoursSlots[day.key], day.label)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setIsSaving(true)

    try {
      if (!config?.slug) {
        throw new Error('Tenant slug not found')
      }

      // Convert slots back to operatingHoursPerDay format for backward compatibility
      const operatingHoursPerDay = {
        monday: {
          enabled: operatingHoursSlots.monday.enabled,
          startHour: operatingHoursSlots.monday.slots[0]
            ? parseInt(operatingHoursSlots.monday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.monday.slots[0]
            ? parseInt(operatingHoursSlots.monday.slots[operatingHoursSlots.monday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        tuesday: {
          enabled: operatingHoursSlots.tuesday.enabled,
          startHour: operatingHoursSlots.tuesday.slots[0]
            ? parseInt(operatingHoursSlots.tuesday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.tuesday.slots[0]
            ? parseInt(operatingHoursSlots.tuesday.slots[operatingHoursSlots.tuesday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        wednesday: {
          enabled: operatingHoursSlots.wednesday.enabled,
          startHour: operatingHoursSlots.wednesday.slots[0]
            ? parseInt(operatingHoursSlots.wednesday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.wednesday.slots[0]
            ? parseInt(operatingHoursSlots.wednesday.slots[operatingHoursSlots.wednesday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        thursday: {
          enabled: operatingHoursSlots.thursday.enabled,
          startHour: operatingHoursSlots.thursday.slots[0]
            ? parseInt(operatingHoursSlots.thursday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.thursday.slots[0]
            ? parseInt(operatingHoursSlots.thursday.slots[operatingHoursSlots.thursday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        friday: {
          enabled: operatingHoursSlots.friday.enabled,
          startHour: operatingHoursSlots.friday.slots[0]
            ? parseInt(operatingHoursSlots.friday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.friday.slots[0]
            ? parseInt(operatingHoursSlots.friday.slots[operatingHoursSlots.friday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        saturday: {
          enabled: operatingHoursSlots.saturday.enabled,
          startHour: operatingHoursSlots.saturday.slots[0]
            ? parseInt(operatingHoursSlots.saturday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.saturday.slots[0]
            ? parseInt(operatingHoursSlots.saturday.slots[operatingHoursSlots.saturday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
        sunday: {
          enabled: operatingHoursSlots.sunday.enabled,
          startHour: operatingHoursSlots.sunday.slots[0]
            ? parseInt(operatingHoursSlots.sunday.slots[0].start.split(':')[0], 10)
            : 9,
          endHour: operatingHoursSlots.sunday.slots[0]
            ? parseInt(operatingHoursSlots.sunday.slots[operatingHoursSlots.sunday.slots.length - 1].end.split(':')[0], 10)
            : 17,
        },
      }

      // Build update payload - always include practice details if they exist
      const updates: any = {}

      // Update practice name if changed
      if (practiceProfile.practiceName !== config.displayName) {
        updates.displayName = practiceProfile.practiceName
      }

      // ALWAYS include practice details (address, timezone, phone, email) if they're set
      // This ensures they get saved even if the comparison logic fails
      if (practiceProfile.address !== undefined) {
        updates.address = practiceProfile.address || null
      }
      if (practiceProfile.timezone !== undefined) {
        updates.timezone = practiceProfile.timezone
      }
      if (practiceProfile.phone !== undefined) {
        updates.phone = practiceProfile.phone || null
      }
      if (practiceProfile.email !== undefined) {
        updates.email = practiceProfile.email || null
      }

      console.log('[SettingsPage] Practice profile state:', practiceProfile)
      console.log('[SettingsPage] Current config values:', {
        address: config.address,
        timezone: config.timezone,
        phone: config.phone,
        email: config.email,
      })
      console.log('[SettingsPage] Updates to send:', updates)

      // Only send schedule if operating hours have changed
      // Compare with existing operatingHoursPerDay to avoid unnecessary updates
      const currentOperatingHours = config.schedule?.operatingHoursPerDay
      const hasOperatingHoursChanged = !currentOperatingHours ||
        JSON.stringify(currentOperatingHours) !== JSON.stringify(operatingHoursPerDay)

      if (hasOperatingHoursChanged) {
        updates.schedule = {
          operatingHoursPerDay,
        }
      }

      // ALWAYS include booking form config (it's always defined in state)
      // This ensures it gets saved even if no other fields changed
      updates.bookingFormConfig = bookingFormConfig
      console.log('[SettingsPage] ===== SAVING BOOKING FORM CONFIG =====')
      console.log('[SettingsPage] Current state (bookingFormConfig):', JSON.stringify(bookingFormConfig, null, 2))
      console.log('[SettingsPage] Current DB value (config.bookingFormConfig):', JSON.stringify(config.bookingFormConfig, null, 2))
      console.log('[SettingsPage] Full updates object:', JSON.stringify(updates, null, 2))
      console.log('[SettingsPage] Updates object keys:', Object.keys(updates))

      // Always make API call since bookingFormConfig is always included
      // Even if other fields haven't changed, we want to save the booking form config
      console.log('[SettingsPage] Calling adminService.updateTenant with updates...')
      const updatedConfig = await adminService.updateTenant(config.slug, updates)
      console.log('[SettingsPage] adminService.updateTenant completed successfully, received updated config:', updatedConfig)

      // Update the global context immediately with the returned config (optimistic update)
      // This ensures the UI reflects changes instantly without needing a full refresh
      if (updatedConfig) {
        updateConfig(updatedConfig)
        console.log('[SettingsPage] Updated global context with new config')
      }

      notifications.success('Settings saved successfully!', 'Your practice settings have been updated.')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      setError(errorMessage)
      notifications.error('Failed to save settings', errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddSlot = (dayKey: keyof OperatingHoursSlots) => {
    setOperatingHoursSlots((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: [...prev[dayKey].slots, { start: '12:00', end: '13:00' }],
      },
    }))
  }

  const handleRemoveSlot = (dayKey: keyof OperatingHoursSlots, slotIndex: number) => {
    setOperatingHoursSlots((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.filter((_, i) => i !== slotIndex),
      },
    }))
  }

  const handleUpdateSlot = (
    dayKey: keyof OperatingHoursSlots,
    slotIndex: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setOperatingHoursSlots((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.map((slot, i) =>
          i === slotIndex ? { ...slot, [field]: value } : slot,
        ),
      },
    }))
  }

  const handleCopyToWeekdays = () => {
    const mondaySlots = [...operatingHoursSlots.monday.slots]
    setOperatingHoursSlots((prev) => ({
      ...prev,
      tuesday: { ...prev.tuesday, slots: mondaySlots.map((s) => ({ ...s })) },
      wednesday: { ...prev.wednesday, slots: mondaySlots.map((s) => ({ ...s })) },
      thursday: { ...prev.thursday, slots: mondaySlots.map((s) => ({ ...s })) },
      friday: { ...prev.friday, slots: mondaySlots.map((s) => ({ ...s })) },
    }))
  }


  if (!config) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center text-slate-600">Loading settings...</GlassCard>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-slate-900" />
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'general'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              General Settings
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'email'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Email Settings
            </button>
          </div>

          {activeTab === 'general' && (
            <>
              {/* Practice Profile Section */}
              <GlassCard className="rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-slate-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Practice Details</h2>
                      <p className="text-xs text-slate-500">Manage your practice information</p>
                    </div>
                  </div>
                  {!isEditingProfile && (
                    <GlassButton variant="secondary" onClick={() => setIsEditingProfile(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </GlassButton>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Practice Name */}
                    <GlassInput
                      label="Practice Name"
                      value={practiceProfile.practiceName}
                      onChange={(e) =>
                        setPracticeProfile({ ...practiceProfile, practiceName: e.target.value })
                      }
                      placeholder="Dental Practice Name"
                    />

                    {/* Timezone */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Timezone</label>
                      <select
                        value={practiceProfile.timezone}
                        onChange={(e) =>
                          setPracticeProfile({ ...practiceProfile, timezone: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-600 mb-1 block">Address</label>
                      <textarea
                        value={practiceProfile.address}
                        onChange={(e) =>
                          setPracticeProfile({ ...practiceProfile, address: e.target.value })
                        }
                        placeholder="123 Main Street, City, State ZIP"
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Phone */}
                    <GlassInput
                      label="Phone"
                      type="tel"
                      value={practiceProfile.phone}
                      onChange={(e) =>
                        setPracticeProfile({ ...practiceProfile, phone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />

                    {/* Email */}
                    <GlassInput
                      label="Email"
                      type="email"
                      value={practiceProfile.email}
                      onChange={(e) =>
                        setPracticeProfile({ ...practiceProfile, email: e.target.value })
                      }
                      placeholder="contact@practice.com"
                    />

                    <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                      <GlassButton variant="ghost" onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </GlassButton>
                      <GlassButton
                        onClick={async () => {
                          await handleSave()
                          setIsEditingProfile(false)
                        }}
                        isLoading={isSaving}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </GlassButton>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Practice Name */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Practice Name</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                        {practiceProfile.practiceName || 'Not set'}
                      </div>
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Timezone</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                        {practiceProfile.timezone.replace('_', ' ')}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-600 mb-1 block">Address</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 min-h-[60px]">
                        {practiceProfile.address || 'Not set'}
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Phone</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                        {practiceProfile.phone || 'Not set'}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Email</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                        {practiceProfile.email || 'Not set'}
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Operating Hours Section */}
              <GlassCard className="rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Operating Hours</h2>
                      <p className="text-xs text-slate-500">Set different hours and breaks for each day</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyToWeekdays}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Monday to Weekdays
                  </button>
                </div>

                <div className="space-y-4">
                  {DAYS.map((day) => {
                    const dayData = operatingHoursSlots[day.key]
                    return (
                      <GlassCard key={day.key} className="border border-slate-200 p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={dayData.enabled}
                              onChange={(e) =>
                                setOperatingHoursSlots({
                                  ...operatingHoursSlots,
                                  [day.key]: { ...dayData, enabled: e.target.checked },
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <label className="text-sm font-semibold text-slate-900 w-24">
                              {day.label}
                            </label>
                          </div>

                          {dayData.enabled ? (
                            <div className="flex-1 space-y-2">
                              {dayData.slots.map((slot, slotIndex) => (
                                <div key={slotIndex} className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) =>
                                      handleUpdateSlot(day.key, slotIndex, 'start', e.target.value)
                                    }
                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  />
                                  <span className="text-slate-400 text-xs">-</span>
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) =>
                                      handleUpdateSlot(day.key, slotIndex, 'end', e.target.value)
                                    }
                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  />
                                  {dayData.slots.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveSlot(day.key, slotIndex)}
                                      className="p-1 text-rose-500 hover:text-rose-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => handleAddSlot(day.key)}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mt-1"
                              >
                                <span className="text-sm">+</span>
                                Add Break
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400 flex-1">Closed</div>
                          )}
                        </div>
                      </GlassCard>
                    )
                  })}
                </div>
              </GlassCard>

              {/* Booking Form Configuration Section */}
              <GlassCard className="rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="h-5 w-5 text-slate-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Booking Form Fields</h2>
                      <p className="text-xs text-slate-500">Configure which optional fields appear in the patient booking form</p>
                    </div>
                  </div>
                  {isSavingBookingConfig && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
                      <span>Saving...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Date of Birth */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-900">Date of Birth</label>
                      <p className="text-xs text-slate-500 mt-0.5">Ask patients for their date of birth</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Required</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              dateOfBirth: {
                                ...bookingFormConfig.dateOfBirth,
                                required: !bookingFormConfig.dateOfBirth.required,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.dateOfBirth.required ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.dateOfBirth.required ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Visible</span>
                        <button
                          onClick={() => {
                            const newValue = !bookingFormConfig.dateOfBirth.visible
                            const newConfig = {
                              ...bookingFormConfig,
                              dateOfBirth: {
                                ...bookingFormConfig.dateOfBirth,
                                visible: newValue,
                              },
                            }
                            console.log('[SettingsPage] Toggling dateOfBirth.visible:', {
                              from: bookingFormConfig.dateOfBirth.visible,
                              to: newValue,
                              fullConfig: newConfig,
                            })
                            setBookingFormConfig(newConfig)
                          }}
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.dateOfBirth.visible ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.dateOfBirth.visible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Home Address */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-900">Home Address</label>
                      <p className="text-xs text-slate-500 mt-0.5">Ask patients for their home address</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Required</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              homeAddress: {
                                ...bookingFormConfig.homeAddress,
                                required: !bookingFormConfig.homeAddress.required,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.homeAddress.required ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.homeAddress.required ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Visible</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              homeAddress: {
                                ...bookingFormConfig.homeAddress,
                                visible: !bookingFormConfig.homeAddress.visible,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.homeAddress.visible ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.homeAddress.visible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Insurance Provider */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-900">Insurance Provider</label>
                      <p className="text-xs text-slate-500 mt-0.5">Ask patients for their insurance information</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Required</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              insuranceProvider: {
                                ...bookingFormConfig.insuranceProvider,
                                required: !bookingFormConfig.insuranceProvider.required,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.insuranceProvider.required ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.insuranceProvider.required ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Visible</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              insuranceProvider: {
                                ...bookingFormConfig.insuranceProvider,
                                visible: !bookingFormConfig.insuranceProvider.visible,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.insuranceProvider.visible ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.insuranceProvider.visible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-900">Emergency Contact</label>
                      <p className="text-xs text-slate-500 mt-0.5">Ask patients for an emergency contact</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Required</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              emergencyContact: {
                                ...bookingFormConfig.emergencyContact,
                                required: !bookingFormConfig.emergencyContact.required,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.emergencyContact.required ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.emergencyContact.required ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Visible</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              emergencyContact: {
                                ...bookingFormConfig.emergencyContact,
                                visible: !bookingFormConfig.emergencyContact.visible,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.emergencyContact.visible ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.emergencyContact.visible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reason for Visit */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-900">Reason for Visit</label>
                      <p className="text-xs text-slate-500 mt-0.5">Ask patients to describe why they're visiting</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Required</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              reasonForVisit: {
                                ...bookingFormConfig.reasonForVisit,
                                required: !bookingFormConfig.reasonForVisit.required,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.reasonForVisit.required ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.reasonForVisit.required ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Visible</span>
                        <button
                          onClick={() =>
                            setBookingFormConfig({
                              ...bookingFormConfig,
                              reasonForVisit: {
                                ...bookingFormConfig.reasonForVisit,
                                visible: !bookingFormConfig.reasonForVisit.visible,
                              },
                            })
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${bookingFormConfig.reasonForVisit.visible ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookingFormConfig.reasonForVisit.visible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    These fields appear in the patient booking form after they select a service and time.
                    Name, Phone, and Email are always required and cannot be hidden.
                  </p>
                </div>
              </GlassCard>

              {/* Save Button for General Settings */}
              <div className="flex justify-end pt-4">
                <GlassButton
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save All Settings
                </GlassButton>
              </div>
            </>
          )}

          {activeTab === 'email' && (
            <EmailSettings
              emailConfig={config.emailConfig || {}}
              smsConfig={config.smsConfig}
              tenantName={config.displayName}
              onSave={async (emailConfig, smsConfig, isAutoSave = false) => {
                setIsSaving(true)
                setError(null)
                try {
                  if (!config?.slug) {
                    throw new Error('Tenant slug not found')
                  }
                  console.log('[SettingsPage] Saving email config:', emailConfig)
                  console.log('[SettingsPage] Saving SMS config:', smsConfig)
                  const updatedConfig = await adminService.updateTenant(config.slug, { emailConfig, smsConfig })
                  console.log('[SettingsPage] Updated config returned:', {
                    hasEmailConfig: !!updatedConfig?.emailConfig,
                    emailConfig: updatedConfig?.emailConfig,
                  })
                  // Update the global context immediately with the returned config (optimistic update)
                  if (updatedConfig) {
                    updateConfig(updatedConfig)
                  }
                  // Only show success notification for manual saves (not auto-saves)
                  if (!isAutoSave) {
                    notifications.success('Communication settings saved!', 'Your email and SMS configuration has been updated.')
                  }
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Failed to save communication settings'
                  console.error('[SettingsPage] Error saving settings:', err)
                  setError(errorMessage)
                  // Only show error notification for manual saves (not auto-saves)
                  if (!isAutoSave) {
                    notifications.error('Failed to save communication settings', errorMessage)
                  }
                } finally {
                  setIsSaving(false)
                }
              }}
              isSaving={isSaving}
            />
          )}
        </div>
      </div>
    </div>
  )
}
