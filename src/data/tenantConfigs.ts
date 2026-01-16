import type { TenantConfig } from '../types/tenant'

const today = new Date()
const addDays = (value: number) => {
  const date = new Date(today)
  date.setDate(date.getDate() + value)
  return date.toISOString()
}

const baseAppointments = [
  {
    id: 'appt-001',
    patientId: 'patient-001',
    patientName: 'Maya Patel',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: addDays(0),
    time: '09:30 AM',
    type: 'Cleaning' as const,
    status: 'Confirmed' as const,
    notes: '6-month hygiene visit',
  },
  {
    id: 'appt-002',
    patientId: 'patient-002',
    patientName: 'Noah Reed',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: addDays(1),
    time: '11:00 AM',
    type: 'Consultation' as const,
    status: 'Pending' as const,
    notes: 'Discuss whitening plan',
  },
  {
    id: 'appt-003',
    patientId: 'patient-003',
    patientName: 'Layla Kim',
    dentistId: 'dentist-001',
    dentistName: 'Dr. Evelyn Hart',
    date: addDays(2),
    time: '01:30 PM',
    type: 'Whitening' as const,
    status: 'Confirmed' as const,
    notes: 'LED boost follow-up',
  },
]

export const tenantConfigs: Record<string, TenantConfig> = {
  lumina: {
    id: 'lumina-placeholder-id',
    slug: 'lumina',
    displayName: 'Lumina Dental Studio',
    isOnboarded: true,
    hero: {
      eyebrow: 'Modern Barber-Inspired Care',
      heading: 'Book a dental session without creating an account',
      subheading: 'Choose a day, lock your slot, and we handle the rest.',
    },
    services: [
      {
        id: 'signature-clean',
        name: 'Signature Clean',
        description: 'Full hygiene session with hand-finished polish.',
        duration: 50,
        price: '$180',
        perks: ['Fluoride finish', 'Text reminders'],
      },
      {
        id: 'express-polish',
        name: 'Express Polish',
        description: 'Quick refresh between bigger visits.',
        duration: 30,
        price: '$120',
        perks: ['15-min check-in', 'Flexible timing'],
      },
      {
        id: 'whitening-studio',
        name: 'Whitening Studio',
        description: 'In-chair whitening inspired by boutique facial bars.',
        duration: 70,
        price: '$260',
        perks: ['LED boost', 'After-care kit'],
      },
    ],
    availability: {
      slots: ['08:00 AM', '09:30 AM', '11:00 AM', '01:00 PM', '02:30 PM', '04:00 PM'],
    },
    sampleAppointments: baseAppointments,
    schedule: {
      appointments: [
        ...baseAppointments,
        {
          id: 'appt-004',
          patientId: 'patient-004',
          patientName: 'Evan Brooks',
          dentistId: 'dentist-001',
          dentistName: 'Dr. Evelyn Hart',
          date: addDays(3),
          time: '03:30 PM',
          type: 'Filling',
          status: 'Confirmed',
          notes: 'Composite on #12',
        },
      ],
      operatingHours: {
        startHour: 9,
        endHour: 17,
      },
      durationMap: {
        Cleaning: 60,
        Consultation: 45,
        Whitening: 90,
        Filling: 75,
      },
    },
    theme: {
      accentFrom: '#14b8a6',
      accentTo: '#3b82f6',
    },
  },
  'soho-smiles': {
    id: 'soho-smiles-placeholder-id',
    slug: 'soho-smiles',
    displayName: 'Soho Smiles Collective',
    isOnboarded: true,
    hero: {
      eyebrow: 'Downtown Dental Loft',
      heading: 'Concierge dentistry, built for creatives.',
      subheading: 'Reserve an express chair, share your vibe, and we do the rest.',
    },
    services: [
      {
        id: 'studio-clean',
        name: 'Studio Clean',
        description: 'Curated hygiene with aromatherapy rinse.',
        duration: 55,
        price: '$210',
      },
      {
        id: 'after-hours-touchup',
        name: 'After-hours Touch-up',
        description: 'Evening polish with complimentary transport credit.',
        duration: 35,
        price: '$165',
      },
    ],
    availability: {
      slots: ['10:00 AM', '12:00 PM', '02:00 PM', '05:30 PM', '07:00 PM'],
    },
    sampleAppointments: [
      {
        id: 'ss-appt-001',
        patientId: 'ss-patient-001',
        patientName: 'Isla Monroe',
        dentistId: 'ss-dentist-001',
        dentistName: 'Dr. Alana Cho',
        date: addDays(0),
        time: '10:00 AM',
        type: 'Studio Clean',
        status: 'Confirmed',
        notes: 'Prefers citrus polish',
      },
      {
        id: 'ss-appt-002',
        patientId: 'ss-patient-002',
        patientName: 'Emerson Tate',
        dentistId: 'ss-dentist-001',
        dentistName: 'Dr. Alana Cho',
        date: addDays(1),
        time: '07:00 PM',
        type: 'After-hours Touch-up',
        status: 'Confirmed',
        notes: 'Send car at 6:15 PM',
      },
    ],
    schedule: {
      appointments: [
        {
          id: 'ss-appt-003',
          patientId: 'ss-patient-003',
          patientName: 'River Blaine',
          dentistId: 'ss-dentist-001',
          dentistName: 'Dr. Alana Cho',
          date: addDays(2),
          time: '12:00 PM',
          type: 'Studio Clean',
          status: 'Completed',
          notes: 'Prefers lo-fi playlist',
        },
        {
          id: 'ss-appt-004',
          patientId: 'ss-patient-004',
          patientName: 'Nova Ellis',
          dentistId: 'ss-dentist-002',
          dentistName: 'Dr. Park',
          date: addDays(4),
          time: '05:30 PM',
          type: 'After-hours Touch-up',
          status: 'Pending',
          notes: 'Allergic to mint rinse',
        },
      ],
      operatingHours: {
        startHour: 10,
        endHour: 20,
      },
      durationMap: {
        'Studio Clean': 55,
        'After-hours Touch-up': 40,
      },
    },
    theme: {
      accentFrom: '#f97316',
      accentTo: '#ec4899',
    },
  },
}

