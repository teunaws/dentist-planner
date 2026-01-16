export type UserRole = 'patient' | 'dentist' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  tenant_id?: string | null
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  dentistId: string
  dentistName: string
  providerId?: string // New: ID of assigned provider
  providerName?: string // New: Name of assigned provider
  date: string
  time: string
  type: string // Flexible to support tenant-specific service types
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Blocked' | 'Missed' | 'Cancelled'
  notes?: string
  // Booking form fields
  dateOfBirth?: string
  homeAddress?: string
  insuranceProvider?: string
  emergencyContact?: string
  reasonForVisit?: string
  duration?: number // Optional override for duration in minutes
}

export interface Patient extends User {
  phone: string
  insuranceProvider: string
  insuranceMemberId: string
  medicalHistory: string[]
  upcomingAppointments: Appointment[]
}

export interface IntakeFormValues {
  fullName: string
  medicalHistory: string
  insuranceProvider: string
  insuranceMemberId: string
}

// ============================================
// Provider/Team Management Types
// ============================================

export interface Provider {
  id: string
  tenantId: string
  name: string
  color: string // Hex color for calendar UI
  userId?: string | null // Optional: if employee has login
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProviderService {
  providerId: string
  serviceId: string
  createdAt?: string
}

export interface ProviderSchedule {
  id: string
  providerId: string
  dayOfWeek: number // 0=Sunday, 6=Saturday
  startTime: string // Time format: "HH:MM:SS" or "HH:MM"
  endTime: string // Time format: "HH:MM:SS" or "HH:MM"
  isWorking: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProviderWithDetails extends Provider {
  services: Array<{ id: string; name: string }> // Services this provider can perform
  schedules: ProviderSchedule[] // Weekly schedule
}

