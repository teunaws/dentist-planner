import type { Appointment } from '../types'
import type { OperatingHoursPerDay } from '../types/tenant'

/**
 * Get day name from Date (0 = Sunday, 1 = Monday, etc.)
 */
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

/**
 * Parse time string to minutes from midnight
 */
const parseTimeToMinutes = (timeStr: string): number => {
  const [timePart, period] = timeStr.split(' ')
  const [hours, minutes] = timePart.split(':').map(Number)
  let hours24 = hours % 12
  if (period?.toUpperCase() === 'PM') {
    hours24 += 12
  }
  return hours24 * 60 + (minutes || 0)
}

/**
 * Generate time slots for a specific day based on operating hours
 */
const generateTimeSlotsForDay = (
  day: Date,
  operatingHours: { startHour: number; endHour: number },
  operatingHoursPerDay?: OperatingHoursPerDay
): string[] => {
  const slots: string[] = []
  
  if (operatingHoursPerDay) {
    const dayName = getDayName(day)
    const dayHours = operatingHoursPerDay[dayName]
    
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
    for (let hour = operatingHours.startHour; hour < operatingHours.endHour; hour++) {
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

/**
 * Check if a date is in the past
 */
const isDateInPast = (date: Date): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate < today
}

/**
 * Check if a time slot has passed today
 */
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

interface FindFirstAvailableDateParams {
  appointments: Appointment[]
  operatingHours: { startHour: number; endHour: number }
  operatingHoursPerDay?: OperatingHoursPerDay
  serviceDuration: number
  durationMap?: Record<string, number>
  services?: Array<{ name: string; duration: number }>
  maxDaysToSearch?: number
}

/**
 * Find the first available date with at least one free slot
 * 
 * Algorithm:
 * 1. Start at today
 * 2. Loop through next N days (default 14)
 * 3. For each candidate date:
 *    - Check 1: Is business open on this day? (operatingHoursPerDay)
 *    - Check 2: If today, are there slots remaining after now()?
 *    - Check 3: Are there any slots that don't conflict with appointments?
 * 4. Return first date with available slots, or fallback to today
 */
export const findFirstAvailableDate = (params: FindFirstAvailableDateParams): Date => {
  const {
    appointments,
    operatingHours,
    operatingHoursPerDay,
    serviceDuration,
    durationMap = {},
    services = [],
    maxDaysToSearch = 14,
  } = params

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Loop through next N days
  for (let i = 0; i < maxDaysToSearch; i++) {
    const candidateDate = new Date(today)
    candidateDate.setDate(today.getDate() + i)

    // Check 1: Operating Hours - Is business open on this day?
    if (operatingHoursPerDay) {
      const dayName = getDayName(candidateDate)
      const dayHours = operatingHoursPerDay[dayName]
      if (!dayHours || dayHours.enabled === false) {
        continue // Day is closed, skip
      }
    }

    // Generate all possible slots for this day
    const allSlots = generateTimeSlotsForDay(candidateDate, operatingHours, operatingHoursPerDay)
    if (allSlots.length === 0) {
      continue // No slots available for this day
    }

    // Filter out slots that are in the past (if today)
    const futureSlots = allSlots.filter((slot) => {
      // Don't allow past dates
      if (isDateInPast(candidateDate)) {
        return false
      }
      // Don't allow time slots that have passed today
      if (isTimeSlotPassed(slot, candidateDate)) {
        return false
      }
      return true
    })

    if (futureSlots.length === 0) {
      continue // All slots are in the past
    }

    // Check 3: Capacity - Filter out slots that conflict with appointments
    const dayString = candidateDate.toISOString().split('T')[0]
    const dayAppointments = appointments.filter((apt) => apt.date === dayString)

    const availableSlots = futureSlots.filter((slot) => {
      const slotStartMinutes = parseTimeToMinutes(slot)
      const slotEndMinutes = slotStartMinutes + serviceDuration

      // Check if appointment would extend past closing time
      let closingTimeMinutes: number
      if (operatingHoursPerDay) {
        const dayName = getDayName(candidateDate)
        const dayHours = operatingHoursPerDay[dayName]
        closingTimeMinutes = (dayHours?.endHour ?? operatingHours.endHour) * 60
      } else {
        closingTimeMinutes = operatingHours.endHour * 60
      }

      if (slotEndMinutes > closingTimeMinutes) {
        return false // Appointment would extend past closing time
      }

      // Check for conflicts with existing appointments
      for (const apt of dayAppointments) {
        const aptStartMinutes = parseTimeToMinutes(apt.time)

        // Get appointment duration
        let aptDuration: number
        if (apt.status === 'Blocked' || apt.type === 'Blocked Time') {
          aptDuration = durationMap[apt.type] ?? 60 // Default 60 min for blocked
        } else {
          const aptService = services.find((s) => s.name === apt.type)
          aptDuration = aptService?.duration ?? durationMap[apt.type] ?? 60
        }

        const aptEndMinutes = aptStartMinutes + aptDuration

        // Check for overlap: slot overlaps if it starts before appointment ends and ends after appointment starts
        if (slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes) {
          return false // Conflict found
        }
      }

      return true // No conflicts
    })

    // If we found at least one available slot, return this date
    if (availableSlots.length > 0) {
      return candidateDate
    }
  }

  // Fallback to today if no available date found
  return today
}

