'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Star, ChevronLeft, ChevronRight } from 'lucide-react'

import { GlassCard } from '../../../../components/ui/GlassCard'
import { cn } from '../../../../lib/utils'
import { useTenant } from '../../../../context/TenantContext'
import { appointmentService } from '../../../../services/appointmentService'
import * as availabilityService from '../../../../services/availabilityService'
import { supabase } from '../../../../lib/supabase'
import { notifications } from '../../../../lib/notifications'
import { SEO } from '../../../../components/common/SEO'


const fallbackSlots = ['08:00 AM', '09:30 AM', '11:00 AM', '01:00 PM', '02:30 PM', '04:00 PM']

// Get day name from Date (0 = Sunday, 1 = Monday, etc.)
const getDayName = (date: Date): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' => {
  const day = date.getDay()
  const dayNameMap: Record<number, 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  }
  return dayNameMap[day] || 'monday'
}

const getWeekDays = (offsetWeeks = 0, operatingHoursPerDay?: any) => {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7)

  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })

  // Filter out closed days based on operatingHoursPerDay
  let filteredDays = weekDays
  if (operatingHoursPerDay) {
    filteredDays = weekDays.filter((date) => {
      const dayName = getDayName(date)
      const dayHours = operatingHoursPerDay[dayName]
      return dayHours?.enabled !== false // Include if enabled is true or undefined
    })
  }

  // If this is the current week (offsetWeeks === 0), filter out past days
  if (offsetWeeks === 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentHour = now.getHours()

    return filteredDays.filter((date) => {
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      const isToday = checkDate.getTime() === today.getTime()

      // If it's today and past 5 PM (17:00), exclude it
      if (isToday && currentHour >= 17) {
        return false
      }

      // Otherwise, include if it's today or a future day
      return checkDate >= today
    })
  }

  // For future weeks, return filtered days
  return filteredDays
}

type Stage = 'service' | 'time' | 'details' | 'summary'

const stageSequence: Stage[] = ['service', 'time', 'details', 'summary']

export default function PatientDashboard() {
  const { config, isLoading, slug, error } = useTenant()


  const services = config?.services ?? []
  const slotTemplate = config?.availability.slots ?? fallbackSlots
  const bookingFormConfig = config?.bookingFormConfig

  const [weekOffset, setWeekOffset] = useState(0)
  const days = useMemo(
    () => getWeekDays(weekOffset, config?.schedule?.operatingHoursPerDay),
    [weekOffset, config?.schedule?.operatingHoursPerDay],
  )

  // Prevent going to past weeks
  const canGoToPreviousWeek = weekOffset > 0
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [isFindingFirstDate, setIsFindingFirstDate] = useState(false)
  const [hasInitializedDate, setHasInitializedDate] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [, setConfirmation] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('service')
  const [details, setDetails] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    homeAddress: '',
    insuranceProvider: '',
    emergencyContact: '',
    reasonForVisit: '',
  })
  const [summary, setSummary] = useState<{
    service: string
    slot: string
    day: string
    contact: typeof details
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // New Availability State
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string[]>>({})
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  // Removed legacy state: appointments, qualifiedProviderIds, providerSchedules



  // Load tenant ID from config if available, otherwise fetch from database
  useEffect(() => {
    // Use config.id if available (preferred - no extra query needed)
    if (config?.id) {
      setTenantId(config.id)
      return
    }

    // Fallback: fetch from database if config not loaded yet
    const loadTenantId = async () => {
      if (slug && !tenantId) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', slug)
          .single() as { data: any, error: any }
        if (tenant) {
          setTenantId((tenant as any).id)
        }
      }
    }
    void loadTenantId()
  }, [config?.id, slug, tenantId])



  useEffect(() => {
    if (services.length > 0) {
      setSelectedServiceId(services[0].id)
    }
  }, [services])

  // CRITICAL: Define selectedService BEFORE any useEffect that uses it
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0]


  // Load availability for the current week using RPC
  useEffect(() => {
    const loadAvailability = async () => {
      if (!tenantId || days.length === 0 || !selectedService?.duration) return
      setIsLoadingAvailability(true)
      try {
        const batchMap: Record<string, string[]> = {}
        // Process days in parallel
        await Promise.all(days.map(async (day) => {
          const dateStr = day.toISOString().split('T')[0]
          try {
            const slots = await availabilityService.getAvailableSlots(
              tenantId,
              dateStr,
              selectedService.duration
            )
            // Deduplicate slots (multiple providers might be available at the same time)
            batchMap[dateStr] = Array.from(new Set(slots.map(s => s.time)))
              .sort((a, b) => availabilityService.parseTimeToMinutes(a) - availabilityService.parseTimeToMinutes(b))
          } catch (e) {
            console.error('Err loading slots', dateStr, e)
            batchMap[dateStr] = []
          }
        }))
        setAvailabilityMap(batchMap)
      } catch (error) {
        console.error('Failed to load availability:', error)
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    // Reset map when days change to avoid showing stale data while loading
    setAvailabilityMap({})
    loadAvailability()
  }, [tenantId, days, selectedService?.duration])


  const formattedSelectedDay = selectedDay && selectedDay instanceof Date
    ? selectedDay.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    : ''

  // Smart Date Selection: Select first available day in the view
  // Runs when availabilityMap updates or days change
  useEffect(() => {
    // If we have a selected day and it has slots, stay there?
    // Or if we just loaded new week, find first day.
    if (isLoadingAvailability) {
      setIsFindingFirstDate(true)
      return
    }

    // Check if current selection is valid for this week
    const isSelectedInWeek = selectedDay && days.some(d => d.toDateString() === selectedDay.toDateString())
    const currentDayStr = selectedDay?.toISOString().split('T')[0]
    const currentDayHasSlots = currentDayStr && availabilityMap[currentDayStr]?.length > 0

    if (isSelectedInWeek) {
      setIsFindingFirstDate(false)
      setHasInitializedDate(true)
      return
    }

    // Find first day with slots
    const firstDayWithSlots = days.find(day => {
      const dStr = day.toISOString().split('T')[0]
      return (availabilityMap[dStr]?.length || 0) > 0
    })

    if (firstDayWithSlots) {
      setSelectedDay(firstDayWithSlots)
    } else if (!isSelectedInWeek && days.length > 0) {
      // Fallback to first day of week if nothing available
      setSelectedDay(days[0])
    }

    setIsFindingFirstDate(false)
    setHasInitializedDate(true)

  }, [availabilityMap, days, isLoadingAvailability, hasInitializedDate, selectedDay])

  // Get available slots for the selected day
  const availableSlots = useMemo(() => {
    if (!selectedDay) return []
    const dateStr = selectedDay.toISOString().split('T')[0]
    return availabilityMap[dateStr] || []
  }, [selectedDay, availabilityMap])

  // Reset selected slot when day changes
  useEffect(() => {
    if (selectedDay && availableSlots.length > 0 && !availableSlots.includes(selectedSlot)) {
      setSelectedSlot(availableSlots[0])
    } else if (selectedDay && availableSlots.length > 0 && !selectedSlot) {
      setSelectedSlot(availableSlots[0])
    }
  }, [selectedDay, availableSlots, selectedSlot])

  const handleWeekChange = (direction: 'prev' | 'next') => {
    setWeekOffset((prev) => prev + (direction === 'next' ? 1 : -1))
  }

  const weekLabel = days.length > 0
    ? `${days[0].toLocaleDateString()} – ${days[days.length - 1].toLocaleDateString()}`
    : 'No available days'

  const handleReserve = async () => {
    if (!selectedService || !config) return

    setIsSaving(true)
    setSaveError(null)

    try {
      // Get tenant ID from database
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single() as { data: any, error: any }

      if (tenantError || !tenant) {
        throw new Error('Failed to find tenant')
      }

      // Convert selected day to ISO date string (YYYY-MM-DD)
      if (!selectedDay) {
        throw new Error('Please select a date')
      }
      const dateString = selectedDay.toISOString().split('T')[0]

      // Create appointment in Supabase
      await appointmentService.createAppointment({
        tenantId: (tenant as any).id,
        tenantName: config.displayName, // Pass tenant name for email confirmation
        patientName: details.name,
        patientEmail: details.email,
        patientPhone: details.phone,
        date: dateString,
        time: selectedSlot,
        serviceType: selectedService.name,
        status: 'Confirmed',
        notes: `Booked online via patient portal`,
        // Include optional booking form fields if they were filled
        dateOfBirth: details.dateOfBirth || undefined,
        homeAddress: details.homeAddress || undefined,
        insuranceProvider: details.insuranceProvider || undefined,
        emergencyContact: details.emergencyContact || undefined,
        reasonForVisit: details.reasonForVisit || undefined,
      })

      // Reload appointments to reflect the new booking in availability
      // Reload availability to reflect the new booking
      const reloadAvailability = async () => {
        if (!tenantId || days.length === 0 || !selectedService?.duration) return

        const newMap: Record<string, string[]> = {}
        // Re-fetch for current week
        await Promise.all(days.map(async (day) => {
          const dateStr = day.toISOString().split('T')[0]
          try {
            const slots = await availabilityService.getAvailableSlots(
              tenantId,
              dateStr,
              selectedService.duration
            )
            newMap[dateStr] = slots.map(s => s.time)
          } catch (e) {
            console.error('Failed to reload slot for', dateStr, e)
          }
        }))

        setAvailabilityMap(prev => ({ ...prev, ...newMap }))
      }

      await reloadAvailability()

      const bookingSummary = {
        service: selectedService.name,
        slot: selectedSlot,
        day: formattedSelectedDay,
        contact: details,
      }
      setSummary(bookingSummary)
      setConfirmation(
        `Confirmed ${bookingSummary.service} for ${bookingSummary.contact.name || 'Guest'} at ${bookingSummary.slot} on ${bookingSummary.day}.`,
      )
      setStage('summary')
      setDetails({
        name: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        homeAddress: '',
        insuranceProvider: '',
        emergencyContact: '',
        reasonForVisit: '',
      })

      // Show success toast
      notifications.success('Appointment booked successfully!', `Your ${selectedService.name} appointment is confirmed for ${formattedSelectedDay} at ${selectedSlot}.`)
    } catch (error) {
      console.error("Booking Error:", error);
      let errorMessage = error instanceof Error ? error.message : 'Failed to save appointment. Please try again.'

      // Enhance user-facing error messages
      if (errorMessage.includes('Time slot is no longer available')) {
        errorMessage = 'This time slot was just taken by another patient. Please select a different time.';
      } else if (errorMessage.includes('Edge Function returned a non-2xx status code')) {
        // This is often a Rate Limit (429) or Server Error (500)
        // Since we just added Rate Limiting, it's highly likely to be that if the user is spamming.
        errorMessage = 'Procesing Error: You might be doing that too fast. Please wait a moment and try again.';
      } else if (errorMessage.includes('Too Many Requests')) {
        errorMessage = 'You are booking too frequently. Please try again in 15 minutes.';
      }

      setSaveError(errorMessage)

      // Show error toast
      notifications.error('Booking Failed', errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const goBack = () => {
    const index = stageSequence.indexOf(stage)
    if (index > 0) {
      setStage(stageSequence[index - 1])
    }
  }

  // Get current step index for progress indicator
  const currentStepIndex = stageSequence.indexOf(stage)
  // const totalSteps = stageSequence.length // Unused

  // Helper to check if a field should be shown
  const shouldShowField = (fieldKey: keyof NonNullable<typeof bookingFormConfig>) => {
    if (!bookingFormConfig) return false
    return bookingFormConfig[fieldKey]?.visible ?? false
  }

  // Helper to check if a field is required
  const isFieldRequired = (fieldKey: keyof NonNullable<typeof bookingFormConfig>) => {
    if (!bookingFormConfig) return false
    return bookingFormConfig[fieldKey]?.required ?? false
  }

  const bookingReady =
    !isLoading && services.length > 0 && slotTemplate.length > 0 && Boolean(selectedService)

  // Show error if tenant not found
  if (error && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Practice Not Found</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <p className="text-xs text-slate-500">Please check the URL and try again.</p>
        </GlassCard>
      </div>
    )
  }

  // Show loading state
  if (isLoading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md text-center">
          <p className="text-sm text-slate-600">Loading practice information...</p>
        </GlassCard>
      </div>
    )
  }

  if (!bookingReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-sm text-slate-600">
          Preparing this practice…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <SEO
        title={`Book Online - ${config.displayName}`}
        description={config.hero.subheading || `Schedule your appointment with ${config.displayName}. Book online in just a few clicks.`}
        keywords={`${config.displayName}, dental appointment, book dentist, ${config.displayName} booking`}
      />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Book Your Visit</h1>
          <p className="text-slate-500">Select a service and time that works best for you.</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {stageSequence.map((s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${index <= currentStepIndex
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-500'
                  }`}
              >
                {index + 1}
              </div>
              {index < stageSequence.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${index < currentStepIndex ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {stage === 'service' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Select a Service</h2>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {services.map((service) => {
                  const isActive = selectedService?.id === service.id
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
                      className={cn(
                        'w-full flex items-start justify-between rounded-xl border p-4 text-left transition-all',
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn('text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
                            {service.name}
                          </p>
                          {isActive && <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                        </div>
                        <p className={cn('text-xs mb-2', isActive ? 'text-slate-200' : 'text-slate-600')}>
                          {service.description}
                        </p>
                        <div className={cn('flex items-center gap-3 text-xs', isActive ? 'text-slate-300' : 'text-slate-700')}>
                          <span>{service.duration} mins</span>
                          <span>{service.price}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setStage('time')}
                disabled={!selectedService}
                className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Time Selection
              </button>
            </div>
          )}

          {stage === 'time' && selectedService && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <h2 className="text-xl font-semibold text-slate-900">Select Date & Time</h2>
                <div className="w-20"></div>
              </div>

              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                  <Calendar className="h-4 w-4" />
                  <span>{weekLabel}</span>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                  {canGoToPreviousWeek && (
                    <button
                      type="button"
                      onClick={() => handleWeekChange('prev')}
                      className="rounded-lg px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleWeekChange('next')}
                    className="rounded-lg px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Days Selection */}
              <div className="mb-6">
                {isFindingFirstDate ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
                      <p className="text-sm text-slate-500">Finding available dates...</p>
                    </div>
                  </div>
                ) : days.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => {
                      const isActive = selectedDay?.toDateString() === day.toDateString()
                      return (
                        <button
                          key={day.toDateString()}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            'flex flex-col rounded-xl border px-4 py-3 text-left transition-all',
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                              : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          <span className={cn('text-xs', isActive ? 'text-slate-300' : 'text-slate-500')}>
                            {day.toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                          <span className="text-xl font-semibold">
                            {day.toLocaleDateString(undefined, { day: '2-digit' })}
                          </span>
                          <span className={cn('text-xs', isActive ? 'text-slate-300' : 'text-slate-500')}>
                            {day.toLocaleDateString(undefined, { month: 'short' })}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No available days in this week. Please select the next week.</p>
                )}
              </div>

              {/* Available Time Slots */}
              {selectedDay && (
                <div className="mb-6">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Available times for {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {isLoadingAvailability ? (
                    <p className="text-sm text-slate-500">Loading availability...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-slate-500">No available times for this day. Please select another day.</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                        {availableSlots.map((slot) => {
                          const isActive = selectedSlot === slot
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                'rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all',
                                isActive
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50',
                              )}
                            >
                              {slot}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setStage('details')}
                disabled={!selectedDay || !selectedSlot || availableSlots.length === 0}
                className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Details
              </button>
            </div>
          )}

          {stage === 'details' && selectedService && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <h2 className="text-xl font-semibold text-slate-900">Patient Information</h2>
                <div className="w-20"></div>
              </div>

              {/* Appointment Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
                <p className="text-sm font-semibold text-slate-900">{selectedService.name}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedSlot} • {formattedSelectedDay}
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Always required fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={details.name}
                      onChange={(e) => setDetails((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={details.phone}
                      onChange={(e) => setDetails((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={details.email}
                    onChange={(e) => setDetails((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                    required
                  />
                </div>

                {/* Conditional fields based on bookingFormConfig */}
                {shouldShowField('dateOfBirth') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date of Birth {isFieldRequired('dateOfBirth') && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="date"
                      value={details.dateOfBirth}
                      onChange={(e) => setDetails((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                      required={isFieldRequired('dateOfBirth')}
                    />
                  </div>
                )}

                {shouldShowField('homeAddress') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Home Address {isFieldRequired('homeAddress') && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      value={details.homeAddress}
                      onChange={(e) => setDetails((prev) => ({ ...prev, homeAddress: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition resize-none"
                      required={isFieldRequired('homeAddress')}
                    />
                  </div>
                )}

                {shouldShowField('insuranceProvider') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Insurance Provider {isFieldRequired('insuranceProvider') && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={details.insuranceProvider}
                      onChange={(e) => setDetails((prev) => ({ ...prev, insuranceProvider: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                      required={isFieldRequired('insuranceProvider')}
                    />
                  </div>
                )}

                {shouldShowField('emergencyContact') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Emergency Contact {isFieldRequired('emergencyContact') && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={details.emergencyContact}
                      onChange={(e) => setDetails((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition"
                      placeholder="Name and phone number"
                      required={isFieldRequired('emergencyContact')}
                    />
                  </div>
                )}

                {shouldShowField('reasonForVisit') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason for Visit / Notes {isFieldRequired('reasonForVisit') && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      value={details.reasonForVisit}
                      onChange={(e) => setDetails((prev) => ({ ...prev, reasonForVisit: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition resize-none"
                      placeholder="Please describe the reason for your visit..."
                      required={isFieldRequired('reasonForVisit')}
                    />
                  </div>
                )}

                {saveError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {saveError}
                  </div>
                )}
              </div>

              <button
                onClick={handleReserve}
                disabled={
                  !details.name ||
                  !details.phone ||
                  !details.email ||
                  isSaving ||
                  (shouldShowField('dateOfBirth') && isFieldRequired('dateOfBirth') && !details.dateOfBirth) ||
                  (shouldShowField('homeAddress') && isFieldRequired('homeAddress') && !details.homeAddress) ||
                  (shouldShowField('insuranceProvider') && isFieldRequired('insuranceProvider') && !details.insuranceProvider) ||
                  (shouldShowField('emergencyContact') && isFieldRequired('emergencyContact') && !details.emergencyContact) ||
                  (shouldShowField('reasonForVisit') && isFieldRequired('reasonForVisit') && !details.reasonForVisit)
                }
                className="w-full mt-6 bg-slate-900 text-white rounded-lg px-4 py-3 font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </div>
          )}

          {stage === 'summary' && summary && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              {/* Success Icon */}
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mb-2">Appointment Confirmed!</h2>
              <p className="text-slate-500 mb-6">Your appointment has been successfully booked.</p>

              {/* Summary Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-left mb-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Service</p>
                    <p className="text-sm font-semibold text-slate-900">{summary.service}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Date & Time</p>
                    <p className="text-sm text-slate-900">
                      {summary.day} at {summary.slot}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Patient</p>
                    <p className="text-sm text-slate-900">{summary.contact.name}</p>
                    <p className="text-sm text-slate-600">{summary.contact.phone}</p>
                    <p className="text-sm text-slate-600">{summary.contact.email}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setStage('service')
                  setSummary(null)
                  setConfirmation(null)
                  setSelectedServiceId(null)
                  setSelectedDay(null)
                  setSelectedSlot('')
                  setDetails({
                    name: '',
                    phone: '',
                    email: '',
                    dateOfBirth: '',
                    homeAddress: '',
                    insuranceProvider: '',
                    emergencyContact: '',
                    reasonForVisit: '',
                  })
                }}
                className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 font-medium hover:bg-slate-800 transition-colors"
              >
                Book Another Visit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
