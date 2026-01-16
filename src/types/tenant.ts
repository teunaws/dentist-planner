import type { Appointment } from './index'

export interface ServiceDefinition {
  id: string
  name: string
  description: string
  duration: number
  price: string
  perks?: string[]
}

export interface TenantHero {
  eyebrow: string
  heading: string
  subheading: string
}

export interface TenantAvailabilityConfig {
  slots: string[]
}

export interface DayOperatingHours {
  startHour: number
  endHour: number
  enabled: boolean
}

export interface OperatingHoursPerDay {
  monday: DayOperatingHours
  tuesday: DayOperatingHours
  wednesday: DayOperatingHours
  thursday: DayOperatingHours
  friday: DayOperatingHours
  saturday: DayOperatingHours
  sunday: DayOperatingHours
}

export interface TenantScheduleConfig {
  appointments: Appointment[]
  operatingHours: {
    startHour: number
    endHour: number
  }
  operatingHoursPerDay?: OperatingHoursPerDay
  durationMap?: Record<string, number>
}

export interface BookingFormField {
  visible: boolean
  required: boolean
}

export interface BookingFormConfig {
  dateOfBirth: BookingFormField
  homeAddress: BookingFormField
  insuranceProvider: BookingFormField
  emergencyContact: BookingFormField
  reasonForVisit: BookingFormField
}

export interface EmailConfig {
  senderName?: string
  senderLocalPart?: string
  replyTo?: string
  confirmationEnabled?: boolean
  confirmationSubject?: string
  confirmationBody?: string
  reminderEnabled?: boolean
  reminderSubject?: string
  reminderBody?: string
}

export interface SMSConfig {
  confirmationEnabled?: boolean
  confirmationTemplate?: string
  reminderEnabled?: boolean
  reminderTemplate?: string
}

export interface TenantConfig {
  id: string // The database UUID (not the slug!)
  slug: string
  displayName: string
  hero: TenantHero
  services: ServiceDefinition[]
  availability: TenantAvailabilityConfig
  sampleAppointments: Appointment[]
  schedule: TenantScheduleConfig
  bookingFormConfig?: BookingFormConfig
  theme?: {
    accentFrom: string
    accentTo: string
  }
  isOnboarded: boolean // Explicitly track onboarding status
  emailConfig?: EmailConfig
  smsConfig?: SMSConfig
  providers?: Array<{
    id: string
    tenantId: string
    name: string
    color: string
    userId?: string | null
    isActive: boolean
  }> // Providers/employees for this tenant
  // Practice details
  address?: string
  timezone?: string
  phone?: string
  email?: string
  deletedAt?: string
}

