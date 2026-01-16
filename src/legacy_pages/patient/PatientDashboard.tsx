import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { cn } from '../../lib/utils'
import { useTenant } from '../../context/TenantContext'
import { appointmentService } from '../../services/appointmentService'
import { supabase } from '../../lib/supabase'
import { notifications } from '../../lib/notifications'
import { SEO } from '../../components/common/SEO'
import type { Appointment } from '../../types'

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

export const PatientDashboard = () => {
  const { config, isLoading, slug, error } = useTenant()
  
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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)

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
          .single()
        if (tenant) {
          setTenantId(tenant.id)
        }
      }
    }
    void loadTenantId()
  }, [config?.id, slug, tenantId])

  // Load appointments for the current week range
  useEffect(() => {
    const loadAppointments = async () => {
      if (!tenantId || days.length === 0) return
      setIsLoadingAppointments(true)
      try {
        const weekStart = days[0]
        const weekEnd = days[days.length - 1] // Use last day instead of days[6]
        const startDate = weekStart.toISOString().split('T')[0]
        const endDate = weekEnd.toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        if (error) {
          console.error('Failed to load appointments:', error)
        } else {
          const mappedAppointments: Appointment[] =
            data?.map((a) => ({
              id: a.id,
              patientId: a.patient_id || '',
              patientName: a.patient_name,
              dentistId: a.dentist_id || '',
              dentistName: a.dentist_name || '',
              date: a.date,
              time: a.time,
              type: a.service_type,
              status: a.status as 'Confirmed' | 'Pending' | 'Completed' | 'Blocked' | 'Missed' | 'Cancelled',
              notes: a.notes || '',
            })) || []
          setAppointments(mappedAppointments)
        }
      } catch (error) {
        console.error('Failed to load appointments:', error)
      } finally {
        setIsLoadingAppointments(false)
      }
    }
    void loadAppointments()
  }, [tenantId, days])

  useEffect(() => {
    if (services.length > 0) {
      setSelectedServiceId(services[0].id)
    }
  }, [services])

  // CRITICAL: Define selectedService BEFORE any useEffect that uses it
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0]

  const formattedSelectedDay = selectedDay && selectedDay instanceof Date
    ? selectedDay.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : ''

  // Get operating hours from config
  const operatingHours = config?.schedule?.operatingHours ?? { startHour: 9, endHour: 17 }
  const operatingHoursPerDay = config?.schedule?.operatingHoursPerDay
  const START_HOUR = operatingHours.startHour
  const END_HOUR = operatingHours.endHour

  // Generate time slots for a specific day based on operating hours
  const generateTimeSlotsForDay = (day: Date): string[] => {
    const slots: string[] = []
    
    // Check if we have per-day operating hours
    if (operatingHoursPerDay) {
      const dayName = getDayName(day)
      const dayHours = (operatingHoursPerDay as any)[dayName]
      
      // If day is disabled, return empty array
      if (!dayHours || dayHours.enabled === false) {
        return []
      }
      
      // Generate slots based on startHour and endHour for this day
      const startHour = dayHours.startHour
      const endHour = dayHours.endHour
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const hours12 = hour % 12 || 12
          const period = hour < 12 ? 'AM' : 'PM'
          const timeStr = `${hours12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`
          slots.push(timeStr)
        }
      }
    } else {
      // Fallback to default operating hours
      for (let hour = START_HOUR; hour < END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const hours12 = hour % 12 || 12
          const period = hour < 12 ? 'AM' : 'PM'
          const timeStr = `${hours12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`
          slots.push(timeStr)
        }
      }
    }
    
    return slots
  }

  // Generate all 10-minute intervals between start and end hour (for backward compatibility)
  const generateTimeSlots = useMemo(() => {
    const slots: string[] = []
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        const hours12 = hour % 12 || 12
        const period = hour < 12 ? 'AM' : 'PM'
        const timeStr = `${hours12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`
        slots.push(timeStr)
      }
    }
    return slots
  }, [START_HOUR, END_HOUR])

  // Parse time string to minutes from midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const [timePart, period] = timeStr.split(' ')
    const [hours, minutes] = timePart.split(':').map(Number)
    let hours24 = hours % 12
    if (period?.toUpperCase() === 'PM') {
      hours24 += 12
    }
    return hours24 * 60 + (minutes || 0)
  }

  // Check if a date is in the past
  const isDateInPast = (date: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  // Check if a time slot has passed today
  const isTimeSlotPassed = (slot: string, day: Date): boolean => {
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(day)
    checkDate.setHours(0, 0, 0, 0)

    // If the day is today, check if the time has passed
    if (checkDate.getTime() === today.getTime()) {
      const slotMinutes = parseTimeToMinutes(slot)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      return slotMinutes < nowMinutes
    }

    return false
  }

  // Check if a time slot conflicts with existing appointments
  const isSlotAvailable = (slot: string, day: Date): boolean => {
    if (!selectedService) return false

    // Don't allow past dates
    if (isDateInPast(day)) {
      return false
    }

    // Don't allow time slots that have passed today
    if (isTimeSlotPassed(slot, day)) {
      return false
    }

    // Check if day is enabled in operatingHoursPerDay
    if (operatingHoursPerDay) {
      const dayName = getDayName(day)
      const dayHours = (operatingHoursPerDay as any)[dayName]
      if (!dayHours || dayHours.enabled === false) {
        return false // Day is closed
      }
    }

    const dayString = day.toISOString().split('T')[0]
    const slotStartMinutes = parseTimeToMinutes(slot)
    const slotEndMinutes = slotStartMinutes + selectedService.duration

    // Check if the appointment would extend past closing time
    let closingTimeMinutes: number
    if (operatingHoursPerDay) {
      const dayName = getDayName(day)
      const dayHours = (operatingHoursPerDay as any)[dayName]
      closingTimeMinutes = (dayHours?.endHour ?? END_HOUR) * 60
    } else {
      closingTimeMinutes = END_HOUR * 60
    }
    
    if (slotEndMinutes > closingTimeMinutes) {
      return false // Appointment would extend past closing time
    }

    // Check all appointments for this day
    const dayAppointments = appointments.filter((apt) => apt.date === dayString)

    for (const apt of dayAppointments) {
      const aptStartMinutes = parseTimeToMinutes(apt.time)
      
      // Get appointment duration - check if it's a blocked time first
      let aptDuration: number
      if (apt.status === 'Blocked' || apt.type === 'Blocked Time') {
        // For blocked times, get duration from notes or use a default
        // Blocked times should have duration in appointment_durations table
        aptDuration = config?.schedule?.durationMap?.[apt.type] ?? 60 // Default 60 min for blocked
      } else {
        // For regular appointments, find the service duration
        const aptService = services.find((s) => s.name === apt.type)
        aptDuration = aptService?.duration ?? config?.schedule?.durationMap?.[apt.type] ?? 60
      }
      
      const aptEndMinutes = aptStartMinutes + aptDuration

      // Check for overlap: slot overlaps if it starts before appointment ends and ends after appointment starts
      if (slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes) {
        return false // Conflict found
      }
    }

    return true // No conflicts
  }

  // Smart First Available Date Selection - ALWAYS finds first day with available slots on initial load
  // MUST be after all helper functions are defined
  useEffect(() => {
    // CRITICAL GUARD: Stop if service is not selected yet or required data is missing
    if (!config || isLoadingAppointments || !selectedService || !Array.isArray(appointments)) {
      setIsFindingFirstDate(false) // Ensure loading state is cleared
      return
    }

    // Safety check: Ensure selectedService has duration property
    if (!selectedService.duration) {
      setIsFindingFirstDate(false) // Ensure loading state is cleared
      return
    }

    // Helper to check if a day has available slots (uses same logic as isSlotAvailable)
    const dayHasAvailableSlots = (day: Date): boolean => {
      const dayTimeSlots = generateTimeSlotsForDay(day)
      const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
      if (slotsToCheck.length === 0) return false
      // Check if ANY slot passes the availability check (checks appointments, past times, etc.)
      return slotsToCheck.some((slot) => isSlotAvailable(slot, day))
    }

    // On initial load (before hasInitializedDate), ALWAYS find first available day
    // After initialization, only re-run if current day has no slots
    if (hasInitializedDate) {
      const currentDayHasSlots = selectedDay ? dayHasAvailableSlots(selectedDay) : false
      if (currentDayHasSlots) {
        return // Current day has slots, no need to change
      }
    }
    // On initial load (hasInitializedDate is false), we will always search for first available day

    setIsFindingFirstDate(true)

    // Use setTimeout to ensure appointments are fully processed
    const timeoutId = setTimeout(() => {
      try {
        let firstAvailableDay: Date | undefined = undefined
        
        // Search through ALL days in current week to find FIRST with available slots
        console.log('[Smart Date Selection] Searching through', days.length, 'days for first available slot')
        for (const day of days) {
          // Double-check: generate slots and verify at least one is available
          const dayTimeSlots = generateTimeSlotsForDay(day)
          const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
          
          if (slotsToCheck.length === 0) {
            console.log('[Smart Date Selection]', day.toDateString(), '- no time slots (day closed)')
            continue
          }
          
          // Check each slot individually to find at least one available
          const availableCount = slotsToCheck.filter((slot) => isSlotAvailable(slot, day)).length
          const hasSlots = availableCount > 0
          
          console.log('[Smart Date Selection]', day.toDateString(), '- available slots:', availableCount, 'of', slotsToCheck.length, 'total')
          
          if (hasSlots) {
            firstAvailableDay = day
            console.log('[Smart Date Selection] ✓ Found first available day:', firstAvailableDay.toDateString(), 'with', availableCount, 'available slots')
            break // Found one! Stop immediately
          }
        }
        
        // CRITICAL: ONLY set if we found a day with available slots
        if (firstAvailableDay) {
          setSelectedDay(firstAvailableDay)
          setHasInitializedDate(true)
        } else {
          // NO available days found in current week - search future weeks (up to 8 weeks ahead)
          console.warn('[Smart Date Selection] ⚠️ No available days found in current week - searching future weeks')
          
          let foundInFutureWeek = false
          // Search weeks 1-4 with full appointment checking
          for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
            const futureWeekDays = getWeekDays(weekOffset, config?.schedule?.operatingHoursPerDay)
            
            for (const day of futureWeekDays) {
              const dayTimeSlots = generateTimeSlotsForDay(day)
              const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
              
              if (slotsToCheck.length === 0) continue
              
              const availableCount = slotsToCheck.filter((slot) => isSlotAvailable(slot, day)).length
              
              if (availableCount > 0) {
                console.log('[Smart Date Selection] ✓ Found first available day in week', weekOffset, ':', day.toDateString(), 'with', availableCount, 'available slots')
                setSelectedDay(day)
                setWeekOffset(weekOffset)
                foundInFutureWeek = true
                break
              }
            }
            
            if (foundInFutureWeek) break
          }
          
          // If still not found, search weeks 5-8 (might not have appointment data, so just check if day is open)
          if (!foundInFutureWeek) {
            for (let weekOffset = 5; weekOffset <= 8; weekOffset++) {
              const futureWeekDays = getWeekDays(weekOffset, config?.schedule?.operatingHoursPerDay)
              
              for (const day of futureWeekDays) {
                const dayTimeSlots = generateTimeSlotsForDay(day)
                const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
                
                if (slotsToCheck.length === 0) continue
                
                // For far future weeks, we might not have appointment data loaded
                // So just check if day is open and not in the past
                const isPast = isDateInPast(day)
                if (!isPast) {
                  console.log('[Smart Date Selection] ✓ Found first open day in week', weekOffset, ':', day.toDateString(), '(appointments may not be loaded yet)')
                  setSelectedDay(day)
                  setWeekOffset(weekOffset)
                  foundInFutureWeek = true
                  break
                }
              }
              
              if (foundInFutureWeek) break
            }
          }
          
          // CRITICAL: NEVER set Sunday (days[0]) if it has 0 available slots
          // Only set it as absolute last resort if no other day exists in the entire system
          if (!foundInFutureWeek) {
            console.warn('[Smart Date Selection] ⚠️ No available days found in 8 weeks')
            // DO NOT set a fully booked day - leave it unselected or let UI handle it
            // The UI should show "no available times" message
            setHasInitializedDate(true)
          } else {
            setHasInitializedDate(true)
          }
        }
      } catch (error) {
        console.error('Error finding first available date:', error)
        // Fallback to first day in current week
        if (days.length > 0 && !selectedDay) {
          setSelectedDay(days[0])
        }
        setHasInitializedDate(true)
      } finally {
        setIsFindingFirstDate(false) // ALWAYS clear loading state
      }
    }, 300) // Delay to ensure appointments are fully processed

    return () => {
      clearTimeout(timeoutId)
      setIsFindingFirstDate(false) // Clear loading state if effect is cleaned up
    }
  }, [config, appointments, isLoadingAppointments, selectedService, days, hasInitializedDate])

  // Get available slots for the selected day
  const availableSlots = useMemo(() => {
    if (!selectedDay || !selectedService) return []
    // Use day-specific time slots if available, otherwise use default
    const dayTimeSlots = generateTimeSlotsForDay(selectedDay)
    const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
    return slotsToCheck.filter((slot) => isSlotAvailable(slot, selectedDay))
  }, [selectedDay, appointments, selectedService, config, services, operatingHoursPerDay])

  // Set default selected day when week changes - find first day with available slots
  // This runs when the week changes (days array changes) and finds the first available day
  useEffect(() => {
    // Skip if we're currently finding the first date or haven't initialized yet
    if (isFindingFirstDate || !hasInitializedDate) return
    
    // ABSOLUTELY MUST wait for appointments to finish loading
    if (isLoadingAppointments || !config || !selectedService || !Array.isArray(appointments) || days.length === 0) return
    
    // Helper to check if a day has ANY available slots (not booked, not past, within hours)
    const dayHasAvailableSlots = (day: Date): boolean => {
      const dayTimeSlots = generateTimeSlotsForDay(day)
      const slotsToCheck = dayTimeSlots.length > 0 ? dayTimeSlots : generateTimeSlots
      if (slotsToCheck.length === 0) return false
      // Check if ANY slot passes the availability check (includes appointment conflicts)
      return slotsToCheck.some((slot) => isSlotAvailable(slot, day))
    }

    // Check if current selected day is still in the current week and has slots
    const isSelectedDayInWeek = selectedDay ? days.some((d) => d.toDateString() === selectedDay.toDateString()) : false
    const currentDayHasSlots = selectedDay && isSelectedDayInWeek ? dayHasAvailableSlots(selectedDay) : false

    // If selected day is not in current week OR has no slots, find first available day
    if (!isSelectedDayInWeek || !currentDayHasSlots) {
      // Find FIRST day with available slots
      let firstDayWithSlots: Date | undefined = undefined
      
      for (const day of days) {
        if (dayHasAvailableSlots(day)) {
          firstDayWithSlots = day
          break // Found one! Stop immediately
        }
      }
      
      // ONLY set if we found a day with slots - NEVER set a fully booked day
      if (firstDayWithSlots) {
        setSelectedDay(firstDayWithSlots)
      } else if (!selectedDay) {
        // Only if no day is selected - fallback to first day
        // User will see "no available times" message
        setSelectedDay(days[0])
      }
      // If selectedDay exists but is fully booked and no other day has slots,
      // DON'T change it - user will see "no available times" message
    }
  }, [days, selectedDay, selectedService, appointments, isLoadingAppointments, isFindingFirstDate, hasInitializedDate, config, generateTimeSlotsForDay, generateTimeSlots, isSlotAvailable])

  // Reset selected slot when day or service changes
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
        .single()

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
        tenantId: tenant.id,
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
      if (days.length > 0) {
        const weekStart = days[0]
        const weekEnd = days[days.length - 1] // Use last day instead of days[6]
        const startDate = weekStart.toISOString().split('T')[0]
        const endDate = weekEnd.toISOString().split('T')[0]

        const { data: updatedAppointments, error: reloadError } = await supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', tenant.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        if (!reloadError && updatedAppointments) {
          const mappedAppointments: Appointment[] =
            updatedAppointments.map((a) => ({
              id: a.id,
              patientId: a.patient_id || '',
              patientName: a.patient_name,
              dentistId: a.dentist_id || '',
              dentistName: a.dentist_name || '',
              date: a.date,
              time: a.time,
              type: a.service_type,
              status: a.status as 'Confirmed' | 'Pending' | 'Completed' | 'Blocked' | 'Missed' | 'Cancelled',
              notes: a.notes || '',
            }))
          setAppointments(mappedAppointments)
        }
      }

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to save appointment. Please try again.'
      setSaveError(errorMessage)
      
      // Show error toast
      notifications.error('Failed to book appointment', errorMessage)
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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {index + 1}
              </div>
              {index < stageSequence.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    index < currentStepIndex ? 'bg-slate-900' : 'bg-slate-200'
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
                  {isLoadingAppointments ? (
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
