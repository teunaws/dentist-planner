import type { Appointment, Patient, User } from '../types'

export const mockUsers: User[] = [
  {
    id: 'patient-001',
    name: 'Maya Patel',
    email: 'patient@example.com',
    role: 'patient',
  },
  {
    id: 'dentist-001',
    name: 'Dr. Evelyn Hart',
    email: 'dentist@example.com',
    role: 'dentist',
  },
]

export const mockAppointments: Appointment[] = [
  {
    id: 'appt-001',
    patientId: 'patient-001',
    patientName: 'Maya Patel',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: new Date().toISOString(),
    time: '09:30 AM',
    type: 'Cleaning',
    status: 'Confirmed',
    notes: '6-month hygiene visit',
  },
  {
    id: 'appt-002',
    patientId: 'patient-001',
    patientName: 'Maya Patel',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    time: '02:00 PM',
    type: 'Consultation',
    status: 'Pending',
    notes: 'Discuss whitening plan',
  },
  {
    id: 'appt-003',
    patientId: 'patient-001',
    patientName: 'Noah Reed',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    time: '10:30 AM',
    type: 'Whitening',
    status: 'Confirmed',
    notes: 'Tray impressions',
  },
  {
    id: 'appt-004',
    patientId: 'patient-001',
    patientName: 'Layla Kim',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    time: '01:15 PM',
    type: 'Cleaning',
    status: 'Completed',
    notes: 'Charting follow-up',
  },
  {
    id: 'appt-005',
    patientId: 'patient-001',
    patientName: 'Evan Brooks',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    time: '03:45 PM',
    type: 'Filling',
    status: 'Confirmed',
    notes: 'Composite on #12',
  },
]

export const mockPatients: Patient[] = [
  {
    id: 'patient-001',
    name: 'Maya Patel',
    email: 'maya.patel@example.com',
    role: 'patient',
    phone: '(555) 482-1122',
    insuranceProvider: 'Delta Dental',
    insuranceMemberId: 'DEL-889123',
    medicalHistory: ['Seasonal allergies', 'Mild anemia'],
    upcomingAppointments: mockAppointments,
  },
]

