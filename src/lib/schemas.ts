import { z } from 'zod'

// Validation for Patient Booking Form
export const PatientBookingSchema = z.object({
    name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
    email: z.string().email({ message: 'Invalid email address' }),
    phone: z.string()
        .regex(/^\d+$/, { message: 'Phone number must contain only digits' })
        .min(10, { message: 'Phone number must be at least 10 digits' }),
    date: z.string().refine((val: string) => {
        const date = new Date(val)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return date >= today
    }, { message: 'Date cannot be in the past' }),
    time: z.string().nonempty({ message: 'Time slot is required' }),
    serviceId: z.string().uuid({ message: 'Invalid service ID' }),
    // Optional fields that might be required based on configuration
    dateOfBirth: z.string().optional(),
    homeAddress: z.string().optional(),
    insuranceProvider: z.string().optional(),
    emergencyContact: z.string().optional(),
    reasonForVisit: z.string().optional(),
})

export type PatientBooking = z.infer<typeof PatientBookingSchema>

// Validation for Tenant Operating Hours Configuration (JSONB)
export const OperatingHoursSchema = z.object({
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
    enabled: z.boolean().optional(),
})

export const TenantConfigSchema = z.object({
    operating_hours_per_day: z.record(OperatingHoursSchema).optional().nullable(),
    email_confirmation_enabled: z.boolean().optional(),
    sms_confirmation_enabled: z.boolean().optional(),
    // Add other config validation as needed
})

export type TenantConfigValidation = z.infer<typeof TenantConfigSchema>
