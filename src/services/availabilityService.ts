import { supabase } from '../lib/supabase'

/**
 * Capability-Aware Availability Service
 * 
 * This service calculates availability based on:
 * 1. Which providers can perform the requested service (capabilities)
 * 2. Which of those providers are working at the requested time
 * 3. Which of those providers have existing appointments at that time
 * 
 * A time slot is available if: UsedCapacity < QualifiedCapacity
 */

export interface LightweightAppointment {
  id: string
  date: string
  time: string
  service_type: string
  status: string
  provider_id: string | null
  providerName?: string // Mapped from dentist_name in RPC
  dentist_name?: string
  notes?: string
}

export interface AvailabilityCheckParams {
  tenantId: string
  serviceId: string // UUID of the service
  date: string // ISO date string (YYYY-MM-DD)
  time: string // Time string in format "09:30 AM" or "HH:MM AM/PM"
}

export interface TimeSlotAvailability {
  time: string
  isAvailable: boolean
  qualifiedCapacity: number // Number of providers who can perform this service and are working
  usedCapacity: number // Number of appointments already booked at this time
}

/**
 * Parse time string to minutes since midnight
 * Supports formats: "09:30 AM", "9:30 AM", "14:30"
 */
export function parseTimeToMinutes(timeStr: string): number {
  // Handle 24-hour format
  if (timeStr.includes(':') && !timeStr.includes('AM') && !timeStr.includes('PM')) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return (hours || 0) * 60 + (minutes || 0)
  }

  // Handle 12-hour format
  const [timePart, period] = timeStr.split(' ')
  const [rawHours, rawMinutes] = timePart.split(':').map(Number)
  let hours24 = rawHours % 12
  if (period?.toUpperCase() === 'PM') {
    hours24 += 12
  }
  return hours24 * 60 + (rawMinutes || 0)
}

/**
 * Convert minutes since midnight to time string
 */
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`
}

/**
 * Get day of week from date (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(date: string): number {
  const d = new Date(date)
  return d.getDay()
}

/**
 * Check if a provider is working at a specific time on a specific day
 */
async function isProviderWorkingAtTime(
  providerId: string,
  dayOfWeek: number,
  timeMinutes: number
): Promise<boolean> {
  const { data: schedule, error } = await supabase
    .from('provider_schedules')
    .select('start_time, end_time, is_working')
    .eq('provider_id', providerId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working', true)
    .eq('is_working', true)
    .single() as { data: any, error: any }

  if (error || !schedule || !schedule.is_working) {
    return false
  }

  // Parse schedule times
  const startMinutes = parseTimeToMinutes(schedule.start_time)
  const endMinutes = parseTimeToMinutes(schedule.end_time)

  // Check if time falls within working hours
  return timeMinutes >= startMinutes && timeMinutes < endMinutes
}

/**
 * Get all providers qualified to perform a service
 */
async function getQualifiedProviders(tenantId: string, serviceId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('provider_services')
    .select('provider_id, providers!inner(id, is_active, tenant_id)')
    .eq('service_id', serviceId)
    .eq('providers.tenant_id', tenantId)
    .eq('providers.is_active', true) as { data: any[], error: any }

  if (error || !data) {
    console.warn('[availabilityService] Error fetching qualified providers:', error)
    return []
  }

  return data.map((item) => item.provider_id)
}

/**
 * Check availability for a specific time slot
 */
export async function checkTimeSlotAvailability(
  params: AvailabilityCheckParams
): Promise<TimeSlotAvailability> {
  const { tenantId, serviceId, date, time } = params

  // Get all providers qualified to perform this service
  const qualifiedProviderIds = await getQualifiedProviders(tenantId, serviceId)

  if (qualifiedProviderIds.length === 0) {
    // No qualified providers = not available
    return {
      time,
      isAvailable: false,
      qualifiedCapacity: 0,
      usedCapacity: 0,
    }
  }

  const dayOfWeek = getDayOfWeek(date)
  const timeMinutes = parseTimeToMinutes(time)

  // Check which qualified providers are working at this time
  const workingProviderChecks = await Promise.all(
    qualifiedProviderIds.map((providerId) =>
      isProviderWorkingAtTime(providerId, dayOfWeek, timeMinutes)
    )
  )

  const workingProviderIds = qualifiedProviderIds.filter(
    (_, index) => workingProviderChecks[index]
  )

  const qualifiedCapacity = workingProviderIds.length

  if (qualifiedCapacity === 0) {
    // No providers working at this time = not available
    return {
      time,
      isAvailable: false,
      qualifiedCapacity: 0,
      usedCapacity: 0,
    }
  }

  // Get existing appointments for these providers at this time
  // We need to check for appointments that overlap with the requested time
  // For simplicity, we'll check exact time matches (can be enhanced to check overlaps)
  const { data: existingAppointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id, provider_id, time, service_type')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .in('provider_id', workingProviderIds)
    .neq('status', 'Cancelled') as { data: any[], error: any } // Exclude cancelled appointments

  if (appointmentsError) {
    console.warn('[availabilityService] Error fetching appointments:', appointmentsError)
  }

  // Count appointments at the exact time (or overlapping)
  // For now, we'll do exact match. In production, you'd check for overlaps based on service duration
  const usedCapacity = existingAppointments?.filter((apt) => {
    const aptTimeMinutes = parseTimeToMinutes(apt.time)
    // Exact match for now (can be enhanced to check duration overlaps)
    return aptTimeMinutes === timeMinutes
  }).length || 0

  const isAvailable = usedCapacity < qualifiedCapacity

  return {
    time,
    isAvailable,
    qualifiedCapacity,
    usedCapacity,
  }
}

/**
 * Check availability for multiple time slots
 */
export async function checkMultipleTimeSlots(
  tenantId: string,
  serviceId: string,
  date: string,
  timeSlots: string[]
): Promise<TimeSlotAvailability[]> {
  const checks = await Promise.all(
    timeSlots.map((time) =>
      checkTimeSlotAvailability({
        tenantId,
        serviceId,
        date,
        time,
      })
    )
  )

  return checks
}

/**
 * Get available time slots for a service on a specific date
 * This is a convenience function that filters available slots
 */
export async function getAvailableTimeSlots(
  tenantId: string,
  serviceId: string,
  date: string,
  allTimeSlots: string[]
): Promise<string[]> {
  const availability = await checkMultipleTimeSlots(tenantId, serviceId, date, allTimeSlots)
  return availability.filter((slot) => slot.isAvailable).map((slot) => slot.time)
}

/**
 * Fallback: Check if any provider exists for a tenant
 * Used when provider system is not fully set up
 */
export async function hasProviders(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)

  if (error) {
    console.warn('[availabilityService] Error checking providers:', error)
    return false
  }

  return (data?.length || 0) > 0
}

/**
 * Get lightweight schedule data for a tenant (using RPC for performance)
 * Excludes encrypted PII (patient name, email, phone)
 */
export async function getTenantSchedule(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<LightweightAppointment[]> {
  console.log('[availabilityService] RPC Call:', { tenantId, startDate, endDate })
  const { data, error } = await (supabase.rpc as any)('get_tenant_schedule', {
    p_tenant_id: tenantId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) {
    console.error('[availabilityService] RPC Error:', error)
    throw error
  }

  console.log('[availabilityService] RPC Raw Response:', data)

  // Map RPC result to LightweightAppointment
  return (data as any[] || []).map((apt: any) => ({
    id: apt.id,
    date: apt.date,
    time: apt.time,
    service_type: apt.service_type,
    status: apt.status,
    provider_id: apt.provider_id,
    providerName: apt.dentist_name, // Map dentist_name to providerName for UI consistency
    dentist_name: apt.dentist_name,
    notes: apt.notes
  }))
}

/**
 * Get available slots using Server-Side RPC
 * This replaces the client-side calculation
 */
export async function getAvailableSlots(
  tenantId: string,
  date: string,
  serviceDuration: number
): Promise<{ time: string, providerId: string }[]> {
  const { data, error } = await (supabase.rpc as any)('get_available_slots', {
    p_tenant_id: tenantId,
    p_date: date,
    p_service_duration: serviceDuration
  })

  if (error) {
    console.error('[availabilityService] RPC Error:', error)
    throw error
  }

  // Map and format the results
  return (data as any[] || []).map((slot: any) => ({
    time: minutesToTimeString(parseTimeToMinutes(slot.slot_time)),
    providerId: slot.provider_id
  }))
}

