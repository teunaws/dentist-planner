 # Deep-Dive Technical Documentation v2.0: Dentist Appointment Planner Web Application

**Document Version:** 2.0.0  
**Status:** Production Ready (Phase 4 Complete)  
**Last Updated:** January 2, 2026  
**Migration Status:** Fully migrated to secure, cache-first architecture

---

## Table of Contents

1. [Architectural Overview & Tech Stack](#1-architectural-overview--tech-stack)
2. [Granular Feature Specification](#2-granular-feature-specification)
3. [Data Schema & Persistence](#3-data-schema--persistence)
4. [Data Handling & Flow](#4-data-handling--flow)
5. [Connection & Network Handling](#5-connection--network-handling)
6. [Security & Access Control](#6-security--access-control)
7. [Frontend Architecture](#7-frontend-architecture)

---

## 1. Architectural Overview & Tech Stack

### High-Level Architecture

**Type**: Single-Page Application (SPA) with Serverless Backend  
**Security Model**: Zero-Trust Storage with Application-Level Encryption

- **Frontend**: React 19.2.0 SPA built with Vite 7.2.4
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **Deployment Pattern**: JAMstack (JavaScript, APIs, Markup)
- **Database**: PostgreSQL 17 (via Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Hosting**: Static frontend + Supabase cloud services
- **Data Strategy**: Cache-First with TanStack Query (React Query v5)

### Core Technologies & Versions

#### Frontend Dependencies (Production)

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.6",
  "@supabase/supabase-js": "^2.84.0",
  "@tanstack/react-query": "^5.x",
  "zod": "^3.x",
  "zustand": "^5.0.8",
  "framer-motion": "^12.23.24",
  "lucide-react": "^0.554.0",
  "recharts": "^3.5.0",
  "sonner": "^2.0.7",
  "react-helmet-async": "^2.0.5",
  "@sentry/react": "^10.27.0"
}
```

**New in v2.0:**
- `@tanstack/react-query`: Replaces manual `useEffect` fetching. Provides automatic caching, deduplication, background refetching, and optimistic updates.
- `zod`: Runtime schema validation for forms and API responses. Ensures data integrity before encryption.

#### Build Tools & Dev Dependencies

```json
{
  "vite": "^7.2.4",
  "@vitejs/plugin-react": "^5.1.1",
  "typescript": "~5.9.3",
  "tailwindcss": "^3.4.14",
  "postcss": "^8.5.6",
  "autoprefixer": "^10.4.22",
  "@playwright/test": "^1.57.0",
  "vitest": "^4.x"
}
```

**New in v2.0:**
- `vitest`: Unit testing framework for service layer logic.

#### Backend/Edge Functions

- **Runtime**: Deno 2.x (Supabase Edge Functions)
- **Database**: PostgreSQL 17
- **Email Service**: Resend API
- **SMS Service**: GatewayAPI.com

### Project Directory Structure (v2.0)

```
dentist-appointment-planner-web/
├── src/
│   ├── components/          # React components
│   │   ├── admin/           # Admin-specific components
│   │   ├── common/          # Shared components (SEO, etc.)
│   │   ├── dentist/         # Dentist dashboard components (BlockTimeModal, etc.)
│   │   ├── layout/          # Layout components (AppLayout, AdminLayout, TopNav)
│   │   ├── routes/          # Route-specific components
│   │   ├── settings/        # Settings UI components
│   │   └── ui/              # Reusable UI components (GlassCard, GlassButton, etc.)
│   ├── context/             # React Context providers (TenantContext, QueryClientProvider)
│   ├── data/                # Mock data and tenant configs
│   ├── hooks/               # Custom React hooks [NEW IN v2.0]
│   │   ├── useOptimisticBlockTime.ts  # Optimistic mutation for blocking time
│   │   └── useRevalidation.ts         # Global cache invalidation helpers
│   ├── lib/                 # Utility libraries [EXPANDED IN v2.0]
│   │   ├── encryption.ts    # [NEW] AES-GCM encryption & HMAC-SHA256 hashing
│   │   ├── schemas.ts       # [NEW] Zod validation schemas
│   │   ├── supabase.ts      # Supabase client singleton
│   │   ├── supabaseErrors.ts # Error handling utilities
│   │   ├── utils.ts         # General utilities (cn, withTimeout)
│   │   ├── notifications.ts # Toast notification system
│   │   └── findFirstAvailableDate.ts # Date calculation logic
│   ├── pages/               # Page components
│   │   ├── admin/           # Admin pages (AdminDashboard, AdminLoginPage)
│   │   ├── auth/            # Authentication pages (LoginPage)
│   │   ├── dentist/         # Dentist pages (DentistDashboard, AnalyticsDashboard, SettingsPage, TeamPage)
│   │   ├── home/            # Home page
│   │   ├── onboarding/      # Onboarding flow
│   │   ├── patient/         # Patient booking page
│   │   └── tenant/          # Tenant management pages
│   ├── routes/              # Routing configuration (AppRouter.tsx)
│   ├── services/            # Business logic services [UPDATED IN v2.0]
│   │   ├── adminService.ts  # Admin operations (via Edge Function)
│   │   ├── analyticsService.ts # Analytics data fetching
│   │   ├── appointmentService.ts # [UPDATED] Encrypted CRUD operations
│   │   ├── authService.ts   # Authentication operations
│   │   ├── availabilityService.ts # [UPDATED] RPC-based lightweight fetching
│   │   ├── availabilityService.test.ts # [NEW] Vitest unit tests
│   │   ├── onboardingService.ts # Onboarding flow logic
│   │   └── tenantService.ts # Tenant configuration fetching
│   ├── store/               # Zustand state management
│   │   ├── authStore.ts    # Authentication state
│   │   └── adminStore.ts   # Admin authentication state
│   ├── types/               # TypeScript type definitions
│   │   ├── index.ts        # Core types (User, Appointment, Provider)
│   │   ├── tenant.ts       # Tenant configuration types
│   │   └── supabase.ts     # Auto-generated Supabase Database types
│   ├── styles/              # Global CSS
│   └── main.tsx             # Application entry point (with QueryClientProvider)
├── database/                # SQL migration files [EXPANDED IN v2.0]
│   ├── 01_schema.sql        # Core database schema
│   ├── 02_functions_and_triggers.sql # Database functions and triggers
│   ├── 03_rls_policies.sql  # Row Level Security policies
│   ├── ...
│   ├── 17_add_blind_index.sql # [NEW] Blind index columns for encrypted search
│   ├── 18_harden_rls_security.sql # [NEW] RLS policy hardening
│   ├── 19_increase_pii_column_sizes.sql # [NEW] Column size for encrypted data
│   └── 20_performance_rpc.sql # [NEW] Lightweight RPC function
├── supabase/
│   ├── config.toml          # Supabase local development configuration
│   └── functions/           # Edge Functions
│       ├── admin-api/       # Admin operations Edge Function
│       ├── send-confirmation/ # Email/SMS confirmation sender
│       ├── send-reminders/   # Appointment reminder sender
│       └── contact-sales/   # Contact form handler
├── tests/                    # Playwright E2E tests
├── public/                   # Static assets
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── playwright.config.ts     # Playwright test configuration
```

### Significant Entry Points

1. **`src/main.tsx`**: Application bootstrap
   - Initializes Sentry error tracking
   - Sets up React Router
   - **[NEW v2.0]** Wraps app in `QueryClientProvider` for TanStack Query
   - Initializes authentication state
   - Wraps app in Sentry ErrorBoundary

2. **`src/routes/AppRouter.tsx`**: Routing configuration
   - Defines all application routes
   - Implements protected route logic
   - Handles tenant-based routing (`/:tenant/*`)
   - Admin routes (`/admin/*`)
   - Public routes (`/`, `/onboard`)

3. **`supabase/functions/admin-api/index.ts`**: Admin API Edge Function
   - Handles all admin operations requiring service role
   - Validates admin permissions
   - Executes tenant CRUD operations

4. **`src/lib/encryption.ts`**: **[NEW v2.0]** Encryption utilities
   - AES-GCM encryption for PII storage
   - HMAC-SHA256 hashing for blind indexing
   - Uses Web Crypto API (browser-native)

5. **`src/lib/schemas.ts`**: **[NEW v2.0]** Zod validation schemas
   - `PatientBookingSchema`: Validates booking form input
   - `TenantConfigSchema`: Validates tenant configuration updates

### Data Strategy: Cache-First with TanStack Query

**v1.0 Approach (Legacy):**
- Manual `useEffect` for data fetching
- Local component state for caching
- No automatic revalidation
- Sequential loading to prevent connection exhaustion

**v2.0 Approach (Current):**
- TanStack Query manages all server state
- Automatic caching with configurable stale time
- Background refetching on window focus
- Optimistic updates for instant UI feedback
- Deduplication prevents duplicate requests

**Query Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
```

**Key Query Patterns:**
```typescript
// Fetching with useQuery
const { data, isLoading, error } = useQuery({
  queryKey: ['appointments', tenantId],
  queryFn: () => availabilityService.getTenantSchedule(tenantId, startDate, endDate),
})

// Mutations with optimistic updates
const mutation = useMutation({
  mutationFn: (params) => appointmentService.blockTime(params),
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['appointments'] })
    const previous = queryClient.getQueryData(['appointments'])
    queryClient.setQueryData(['appointments'], (old) => [...old, optimisticItem])
    return { previous }
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['appointments'], context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})
```

---

## 2. Granular Feature Specification

### 2.1 Patient Booking Flow (Secure Write Path)

**Trigger**: User navigates to `/:tenant/book`

**Process Flow (v2.0 with Encryption):**

1. **Tenant Configuration Load** (`src/pages/patient/PatientDashboard.tsx`)
   - `TenantContext` fetches tenant config via `tenantService.getTenantConfig(slug)`
   - Loads services, availability slots, existing appointments
   - Displays hero section with tenant branding

2. **Service Selection Stage** (`stage === 'service'`)
   - User selects a service from available services
   - Service data: `name`, `description`, `duration`, `price`, `perks`
   - Sets `selectedServiceId` state

3. **Time Selection Stage** (`stage === 'time'`)
   - Displays calendar with available dates (filtered by `operatingHoursPerDay`)
   - For each date, calculates available time slots:
     - Filters by operating hours per day
     - Checks provider availability via `availabilityService.checkTimeSlotAvailability()`
     - Excludes blocked times and existing appointments
   - User selects date and time slot
   - Sets `selectedDay` and `selectedSlot` state

4. **Details Collection Stage** (`stage === 'details'`)
   - Collects patient information based on `bookingFormConfig`:
     - Required: `name`, `phone`, `email`
     - Optional (configurable): `dateOfBirth`, `homeAddress`, `insuranceProvider`, `emergencyContact`, `reasonForVisit`
   - Form fields visibility/requirement controlled by `bookingFormConfig` JSONB column

5. **[NEW v2.0] Zod Validation** (`src/lib/schemas.ts`)
   - Before submission, form data validated against `PatientBookingSchema`:
     ```typescript
     const PatientBookingSchema = z.object({
       name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
       email: z.string().email({ message: 'Invalid email address' }),
       phone: z.string()
         .regex(/^\d+$/, { message: 'Phone number must contain only digits' })
         .min(10, { message: 'Phone number must be at least 10 digits' }),
       date: z.string().refine((val) => new Date(val) >= new Date(), { message: 'Date cannot be in the past' }),
       time: z.string().nonempty({ message: 'Time slot is required' }),
       serviceId: z.string().uuid({ message: 'Invalid service ID' }),
     })
     ```
   - Validation errors displayed inline before PII leaves the browser

6. **[NEW v2.0] Client-Side Encryption** (`src/lib/encryption.ts`)
   - Before API call, sensitive fields are encrypted:
     ```typescript
     const encryptedName = await encrypt(patientName);     // AES-GCM
     const encryptedEmail = await encrypt(patientEmail);   // AES-GCM
     const encryptedPhone = await encrypt(patientPhone);   // AES-GCM
     ```
   - Encryption produces unique ciphertext each time (random IV)
   - Output format: `IV_BASE64:CIPHERTEXT_BASE64`

7. **[NEW v2.0] Blind Index Generation** (`src/lib/encryption.ts`)
   - For searchability, deterministic hashes are generated:
     ```typescript
     const emailHash = await hashForSearch(patientEmail); // HMAC-SHA256
     const phoneHash = await hashForSearch(patientPhone); // HMAC-SHA256
     ```
   - Hashes are deterministic (same input = same hash)
   - Uses `VITE_SEARCH_PEPPER` secret key

8. **Appointment Creation** (`appointmentService.createAppointment()`)
   - Validates all required fields
   - Finds available provider via `findAvailableProvider()`:
     - Queries `provider_services` for qualified providers
     - Checks `provider_schedules` for working hours
     - Excludes providers with existing appointments at that time
     - Selects first available provider (round-robin)
   - Inserts appointment into `appointments` table with encrypted fields:
     ```typescript
     .insert({
       tenant_id: data.tenantId,
       patient_name: encryptedName,        // Encrypted
       patient_email: encryptedEmail,      // Encrypted
       patient_email_hash: emailHash,      // Blind index
       patient_phone: encryptedPhone,      // Encrypted
       patient_phone_hash: phoneHash,      // Blind index
       ...otherFields
     })
     ```
   - Triggers background email/SMS confirmation (fire-and-forget via Edge Function)

**Output**: Appointment created with encrypted PII, confirmation sent, user sees success message

**Key Files**:
- `src/pages/patient/PatientDashboard.tsx` (main booking UI)
- `src/services/appointmentService.ts` (encrypted appointment creation)
- `src/lib/encryption.ts` (encryption utilities)
- `src/lib/schemas.ts` (Zod validation)
- `src/services/availabilityService.ts` (availability checking)

### 2.2 Dentist Dashboard & Calendar View (Smart Load)

**Trigger**: Authenticated dentist navigates to `/:tenant/dentist`

**Process Flow (v2.0 with Performance Optimization):**

1. **Authentication Check** (`DentistDashboard.tsx`)
   - `useAuthStore` checks for valid session
   - Verifies user role is 'dentist'
   - Verifies `user.tenant_id` matches current tenant
   - Redirects to login if unauthorized

2. **[NEW v2.0] Smart Load via React Query & RPC**
   - Instead of fetching full appointment records, uses lightweight RPC:
     ```typescript
     const { data: appointmentData, isLoading } = useQuery({
       queryKey: ['appointments', tenantId, startDate, endDate],
       queryFn: () => availabilityService.getTenantSchedule(tenantId, startDate, endDate),
       enabled: !!tenantId,
     })
     ```
   - `getTenantSchedule()` calls PostgreSQL RPC function `get_tenant_schedule`:
     - Returns only: `id`, `date`, `time`, `status`, `service_type`, `notes`
     - Excludes: `patient_name`, `patient_email`, `patient_phone` (encrypted PII)
     - Payload size reduced by ~90%

3. **[NEW v2.0] Realtime Subscription**
   - Dashboard subscribes to Supabase Realtime for instant updates:
     ```typescript
     useEffect(() => {
       const channel = supabase.channel('appointments-changes')
         .on('postgres_changes', {
           event: '*',
           schema: 'public',
           table: 'appointments',
           filter: `tenant_id=eq.${tenantId}`,
         }, () => {
           queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
         })
         .subscribe()
       
       return () => { supabase.removeChannel(channel) }
     }, [tenantId])
     ```
   - When any user books/cancels, all connected dashboards update instantly

4. **Week View Rendering**
   - Calculates week window (Monday-Sunday) with `getWeekWindow(weekOffset)`
   - For each day, renders time slots from `operatingHours.startHour` to `operatingHours.endHour`
   - Positions appointments using `toPosition()`:
     - Calculates `topPercent` based on appointment time
     - Calculates `heightPercent` based on service duration
     - Handles blocked times with duration parsing from notes

5. **Privacy-First Display**
   - Calendar shows generic labels instead of PII:
     - Booked appointments: "Booked Patient"
     - Blocked times: "Blocked"
   - PII only loaded on-demand when dentist clicks specific appointment

**Output**: Interactive calendar view with appointments positioned by time, updates in real-time

**Key Files**:
- `src/pages/dentist/DentistDashboard.tsx` (main calendar UI with React Query)
- `src/services/availabilityService.ts` (`getTenantSchedule()` RPC wrapper)
- `database/20_performance_rpc.sql` (PostgreSQL RPC function)

### 2.3 Block Time Feature (Optimistic UI)

**Trigger**: Dentist clicks "Block Time" button in calendar

**Process Flow (v2.0 with Optimistic Updates):**

1. **Modal Opens** (`BlockTimeModal.tsx`)
   - User selects date, start time, end time
   - Optional: reason for blocking

2. **Validation**
   - Checks end time is after start time
   - Checks for overlapping blocked times:
     - Queries existing blocked appointments for that date
     - Parses duration from notes (`DURATION:60` format)
     - Calculates overlap using time range intersection

3. **[NEW v2.0] Optimistic UI Update** (`useOptimisticBlockTime.ts`)
   ```typescript
   const { mutate: blockTime, isPending } = useMutation({
     mutationFn: (params) => appointmentService.blockTime(params),
     
     onMutate: async (newBlockedTime) => {
       // 1. Cancel outgoing refetches
       await queryClient.cancelQueries({ queryKey: ['appointments', tenantId] })
       
       // 2. Snapshot previous state
       const previousAppointments = queryClient.getQueryData(['appointments', tenantId])
       
       // 3. Optimistically add to cache (appears INSTANTLY)
       queryClient.setQueryData(['appointments', tenantId], (old) => [
         ...old,
         {
           id: 'temp-' + Date.now(),
           date: newBlockedTime.date,
           time: newBlockedTime.startTime,
           service_type: 'Blocked Time',
           status: 'Blocked',
           notes: `DURATION:${duration}`,
           isOptimistic: true,
         }
       ])
       
       return { previousAppointments }
     },
     
     onError: (err, vars, context) => {
       // Rollback on failure
       queryClient.setQueryData(['appointments', tenantId], context.previousAppointments)
     },
     
     onSettled: () => {
       // Refetch authoritative data
       queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
     },
   })
   ```

4. **Block Time Creation** (`appointmentService.blockTime()`)
   - Converts military time to 12-hour format
   - Calculates duration in minutes
   - Creates appointment with:
     - `status = 'Blocked'`
     - `service_type = 'Blocked Time'`
     - `patient_name = 'Blocked'`
     - Notes: `"${reason} | END_TIME:${endTime} | DURATION:${duration}"`
   - Upserts `appointment_durations` for calendar scaling

**Output**: Blocked time appears INSTANTLY in calendar (before server confirms), prevents booking at that time

**Key Files**:
- `src/components/dentist/BlockTimeModal.tsx` (modal UI)
- `src/hooks/useOptimisticBlockTime.ts` (optimistic mutation hook)
- `src/services/appointmentService.ts` (`blockTime()`, `deleteBlockedTime()`)

### 2.4 Multi-Provider System

**Trigger**: Tenant has providers configured in `providers` table

**Process Flow:**

1. **Provider Management** (via Admin API)
   - Create providers in `providers` table
   - Assign services to providers via `provider_services` junction table
   - Configure schedules via `provider_schedules` table (per day of week)

2. **Availability Calculation** (`availabilityService.checkTimeSlotAvailability()`)
   - Gets qualified providers: `provider_services` JOIN `providers` WHERE `service_id = X` AND `is_active = true`
   - Filters by working hours: Checks `provider_schedules` for `day_of_week` and time range
   - Excludes booked providers: Queries `appointments` for existing bookings at that time
   - Calculates capacity: `qualifiedCapacity = workingProviders.length`, `usedCapacity = existingAppointments.length`
   - Returns availability: `isAvailable = usedCapacity < qualifiedCapacity`

3. **Automatic Provider Assignment** (`appointmentService.createAppointment()`)
   - Calls `findAvailableProvider()` before creating appointment
   - Selects first available qualified provider (round-robin)
   - Assigns `provider_id` to appointment
   - Falls back gracefully if no provider available (creates appointment without `provider_id`)

4. **Calendar Display** (`DentistDashboard.tsx`)
   - Loads providers from tenant config
   - Filters appointments by selected provider
   - Color-codes appointments by provider color

**Output**: Appointments automatically assigned to qualified providers, calendar shows provider assignments

**Key Files**:
- `src/services/availabilityService.ts` (availability logic)
- `src/services/appointmentService.ts` (`findAvailableProvider()`)
- `database/10_multi_provider.sql` (schema)

### 2.5 Email & SMS Notifications

**Trigger**: Appointment created with `patient_email` and `tenant_name`

**Process Flow:**

1. **Background Invocation** (`appointmentService.createAppointment()`)
   - After appointment creation, invokes Edge Function (fire-and-forget):
     ```typescript
     void supabase.functions.invoke('send-confirmation', { body: {...} })
     ```
   - Does NOT await response (non-blocking)
   - Note: Plain text email/phone passed to Edge Function (not encrypted)

2. **Edge Function Execution** (`supabase/functions/send-confirmation/index.ts`)
   - Validates required fields
   - Fetches tenant email/SMS configuration from database:
     - `email_sender_name`, `email_sender_local_part`, `email_reply_to`
     - `email_confirmation_enabled`, `email_confirmation_subject`, `email_confirmation_body`
     - `sms_confirmation_enabled`, `sms_confirmation_template`
   - Replaces template variables: `{{patient_name}}`, `{{service_name}}`, `{{date}}`, `{{time}}`, `{{tenant_name}}`

3. **Email Sending** (if `email_confirmation_enabled === true`)
   - Generates HTML email using `generateHTML()` template function
   - Sends via Resend API with timeout (5 seconds)
   - Uses tenant-configured sender name and local part
   - Falls back to defaults if tenant config missing

4. **SMS Sending** (if `sms_confirmation_enabled === true` AND `patient_phone` provided)
   - Formats phone number to MSISDN (numeric only)
   - Truncates sender name to 11 characters (GatewayAPI requirement)
   - Sends via GatewayAPI.com with timeout (5 seconds)
   - Uses tenant-configured template or default

5. **Error Handling**
   - Timeouts logged as warnings (non-critical)
   - Errors logged but don't fail appointment creation
   - Sentry captures exceptions

**Output**: Email/SMS sent to patient (or silently skipped on error)

**Key Files**:
- `supabase/functions/send-confirmation/index.ts`
- `supabase/functions/send-confirmation/email-template.ts`
- `src/services/appointmentService.ts` (invocation)

### 2.6 Search by Email (Blind Index)

**[NEW v2.0]** Search encrypted records without decrypting the entire database.

**Trigger**: Dentist searches for patient by email

**Process Flow:**

1. **User Input**: Dentist enters email address in search box

2. **Hash Generation**:
   ```typescript
   const emailHash = await hashForSearch(searchEmail)
   // Normalized (lowercase, trimmed) -> HMAC-SHA256 -> Hex string
   ```

3. **Database Query**:
   ```typescript
   const { data } = await supabase
     .from('appointments')
     .select('*')
     .eq('tenant_id', tenantId)
     .eq('patient_email_hash', emailHash)  // Query by hash, not email
   ```

4. **Decryption of Results**:
   ```typescript
   return Promise.all(data.map(async (a) => ({
     ...a,
     patientName: await decrypt(a.patient_name),
     patientEmail: await decrypt(a.patient_email),
     patientPhone: await decrypt(a.patient_phone),
   })))
   ```

**Key Properties**:
- Exact match only (no LIKE queries possible)
- Hash collision resistant (SHA-256)
- Pepper secret required to compute hash

**Key Files**:
- `src/lib/encryption.ts` (`hashForSearch()`)
- `src/services/appointmentService.ts` (`findAppointmentsByEmail()`)

### 2.7-2.10 (Unchanged from v1.0)

The following features remain unchanged in their core flows:
- **2.7 Admin Dashboard**: Tenant management via Edge Function
- **2.8 Settings & Customization**: Email/SMS templates, operating hours
- **2.9 Onboarding Flow**: Code-based dentist registration
- **2.10 Analytics Dashboard**: Patient visit statistics, service distribution

---

## 3. Data Schema & Persistence

### 3.1 Complete Database Schema

#### Core Tables

**`tenants`** - Dental practice information
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  hero_eyebrow TEXT,
  hero_heading TEXT,
  hero_subheading TEXT,
  operating_start_hour INTEGER DEFAULT 9,
  operating_end_hour INTEGER DEFAULT 17,
  operating_hours_per_day JSONB DEFAULT NULL,
  theme_accent_from VARCHAR(7),
  theme_accent_to VARCHAR(7),
  booking_form_config JSONB DEFAULT NULL,
  is_onboarded BOOLEAN DEFAULT FALSE,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  -- Email configuration
  email_sender_name VARCHAR(255),
  email_sender_local_part VARCHAR(255),
  email_reply_to VARCHAR(255),
  email_confirmation_enabled BOOLEAN DEFAULT TRUE,
  email_confirmation_subject TEXT,
  email_confirmation_body TEXT,
  email_reminder_enabled BOOLEAN DEFAULT FALSE,
  email_reminder_subject TEXT,
  email_reminder_body TEXT,
  -- SMS configuration
  sms_confirmation_enabled BOOLEAN DEFAULT FALSE,
  sms_confirmation_template TEXT,
  sms_reminder_enabled BOOLEAN DEFAULT FALSE,
  sms_reminder_template TEXT,
  -- Practice details
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`services`** - Services/packages offered
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- in minutes
  price VARCHAR(50) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`service_perks`** - Features/benefits of services
```sql
CREATE TABLE service_perks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  perk_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`availability_slots`** - Available time slots per tenant
```sql
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_slot VARCHAR(20) NOT NULL, -- e.g., "09:00 AM"
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`appointments`** - Patient appointments **[UPDATED v2.0]**
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID,
  
  -- [v2.0] PII COLUMNS - Application-Level Encrypted (AES-GCM)
  -- Storage format: "IV_BASE64:CIPHERTEXT_BASE64"
  patient_name TEXT NOT NULL,      -- Encrypted
  patient_email TEXT,               -- Encrypted
  patient_phone TEXT,               -- Encrypted (increased to TEXT for ciphertext)
  
  -- [v2.0] BLIND INDEX COLUMNS - HMAC-SHA256 Hashes
  -- Storage format: 64-character hex string
  patient_email_hash TEXT,          -- For exact-match search
  patient_phone_hash TEXT,          -- For exact-match search
  
  -- Provider & Dentist
  dentist_id UUID,
  dentist_name VARCHAR(255),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  
  -- Appointment details
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL, -- e.g., "09:30 AM"
  service_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending', -- Confirmed, Pending, Completed, Cancelled, Missed, Blocked
  notes TEXT,
  
  -- Booking form fields
  date_of_birth DATE,
  home_address TEXT,
  insurance_provider VARCHAR(255),
  emergency_contact VARCHAR(255),
  reason_for_visit TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [v2.0] Index for blind index search performance
CREATE INDEX idx_appointments_email_hash ON appointments(tenant_id, patient_email_hash);
CREATE INDEX idx_appointments_phone_hash ON appointments(tenant_id, patient_phone_hash);
```

**`appointment_durations`** - Service type to duration mapping
```sql
CREATE TABLE appointment_durations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type VARCHAR(255) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, service_type)
);
```

**`users`** - User authentication data
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Empty string, managed by Supabase Auth
  role VARCHAR(50) NOT NULL, -- 'dentist', 'admin', 'patient'
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`onboarding_codes`** - Onboarding codes for tenant setup
```sql
CREATE TABLE onboarding_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);
```

#### Multi-Provider Tables

**`providers`** - Employee/provider information
```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color for calendar UI
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`provider_services`** - Provider capabilities (junction table)
```sql
CREATE TABLE provider_services (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (provider_id, service_id)
);
```

**`provider_schedules`** - Individual provider schedules
```sql
CREATE TABLE provider_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_working BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider_id, day_of_week)
);
```

### 3.2 Database Relationships

**One-to-Many**:
- `tenants` → `services` (CASCADE DELETE)
- `tenants` → `appointments` (CASCADE DELETE)
- `tenants` → `availability_slots` (CASCADE DELETE)
- `tenants` → `providers` (CASCADE DELETE)
- `services` → `service_perks` (CASCADE DELETE)
- `providers` → `provider_schedules` (CASCADE DELETE)
- `providers` → `appointments` (SET NULL on delete)
- `users` → `tenants` (SET NULL on delete, nullable)

**Many-to-Many**:
- `providers` ↔ `services` (via `provider_services` junction table)

**Foreign Keys**:
- All foreign keys use `ON DELETE CASCADE` except:
  - `appointments.provider_id` → `ON DELETE SET NULL` (preserve appointment if provider deleted)
  - `users.tenant_id` → `ON DELETE SET NULL` (preserve user if tenant deleted)
  - `providers.user_id` → `ON DELETE SET NULL` (preserve provider if user deleted)

### 3.3 Database Functions & Triggers

**`update_updated_at_column()`** - Auto-updates `updated_at` timestamp
- Triggered on UPDATE for: `tenants`, `services`, `appointments`, `users`

**`handle_new_user()`** - Creates `public.users` record when Supabase Auth user created
- Trigger: `on_auth_user_created` AFTER INSERT ON `auth.users`
- Uses `SECURITY DEFINER` to bypass RLS
- Extracts `role`, `name`, `tenant_id` from `raw_user_meta_data`
- Handles NULL `tenant_id` (for onboarding flow)

**`complete_onboarding()`** - Completes onboarding process
- Parameters: `p_user_id`, `p_user_email`, `p_user_name`, `p_user_role`, `p_user_tenant_id`, `p_onboarding_code_id`
- Updates `users` table
- Marks onboarding code as used
- Sets `tenants.is_onboarded = true`
- Uses `SECURITY DEFINER` to bypass RLS

**[NEW v2.0] `get_tenant_schedule()`** - Lightweight appointment fetch for calendar
```sql
CREATE FUNCTION get_tenant_schedule(
  p_tenant_id UUID, 
  p_start_date DATE, 
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  date DATE,
  time VARCHAR,
  service_type VARCHAR,
  status VARCHAR,
  provider_id UUID,
  dentist_name VARCHAR,
  notes TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.date,
    a.time,
    a.service_type,
    a.status,
    a.provider_id,
    a.dentist_name,
    a.notes
  FROM appointments a
  WHERE
    a.tenant_id = p_tenant_id
    AND a.date >= p_start_date
    AND a.date <= p_end_date
  ORDER BY a.date ASC, a.time ASC;
END;
$$;

-- Critical: Does NOT return patient_name, patient_email, patient_phone
-- Reduces payload size by ~90% for calendar views
GRANT EXECUTE ON FUNCTION get_tenant_schedule(UUID, DATE, DATE) TO authenticated;
```

### 3.4 Analytics Views

**`patient_visit_history`** - Patient visit statistics
```sql
CREATE OR REPLACE VIEW patient_visit_history AS
SELECT 
  tenant_id,
  patient_name,
  patient_email,
  patient_phone,
  MIN(date) as first_visit_date,
  MAX(date) as last_visit_date,
  COUNT(*) as total_visits,
  MAX(CASE WHEN service_type ILIKE '%hygiene%' OR service_type ILIKE '%checkup%' THEN date END) as last_hygiene_visit
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, patient_name, patient_email, patient_phone;
```

**Note**: This view returns encrypted data. Application must decrypt after fetching.

**`monthly_patient_stats`** - Monthly new vs returning patients
```sql
CREATE OR REPLACE VIEW monthly_patient_stats AS
SELECT 
  tenant_id,
  DATE_TRUNC('month', date) as month,
  COUNT(DISTINCT patient_name) FILTER (WHERE is_first_visit) as new_patients,
  COUNT(DISTINCT patient_name) FILTER (WHERE NOT is_first_visit) as returning_patients
FROM (
  SELECT 
    a.tenant_id,
    a.date,
    a.patient_name,
    ROW_NUMBER() OVER (PARTITION BY a.tenant_id, a.patient_name ORDER BY a.date) = 1 as is_first_visit
  FROM appointments a
  WHERE a.status IN ('Completed', 'Confirmed')
) subq
GROUP BY tenant_id, DATE_TRUNC('month', date);
```

### 3.5 ORM/Query Layer

**No ORM Used** - Direct Supabase Client Queries with TanStack Query

The application uses Supabase JavaScript client (`@supabase/supabase-js`) for all database operations. No ORM layer (Prisma, TypeORM, etc.) is used.

**Query Pattern (v2.0 with React Query)**:
```typescript
// Read operation wrapped in useQuery
const { data, isLoading, error } = useQuery({
  queryKey: ['services', tenantId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*, service_perks(*)')
      .eq('tenant_id', tenantId)
      .order('display_order')
    if (error) throw error
    return data
  },
})

// Write operation wrapped in useMutation
const mutation = useMutation({
  mutationFn: async (newService) => {
    const { data, error } = await supabase
      .from('services')
      .insert(newService)
      .select()
      .single()
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['services'] })
  },
})
```

**Query Features Used**:
- `.select()` - Column selection with joins
- `.insert()` - Row insertion
- `.update()` - Row updates
- `.delete()` - Row deletion
- `.eq()`, `.neq()`, `.in()`, `.gt()`, `.lt()` - Filtering
- `.order()` - Sorting
- `.range()` - Pagination
- `.single()` / `.maybeSingle()` - Single row results
- `.rpc()` - PostgreSQL function calls (RPC)

**RLS Integration**: All queries automatically respect Row Level Security policies. No manual permission checks needed in application code.

---

## 4. Data Handling & Flow

### 4.1 Data Ingestion

#### REST API Endpoints (Supabase PostgREST)

**Public Endpoints** (No authentication required):
- `GET /rest/v1/tenants?slug=eq.{slug}` - Fetch tenant configuration
- `GET /rest/v1/services?tenant_id=eq.{id}` - Fetch services
- `GET /rest/v1/availability_slots?tenant_id=eq.{id}` - Fetch time slots
- `GET /rest/v1/appointments?tenant_id=eq.{id}` - Fetch appointments (for availability checking)
- `POST /rest/v1/appointments` - Create appointment (public booking)

**Authenticated Endpoints** (JWT required):
- All admin operations via Edge Function: `POST /functions/v1/admin-api`
- Edge Function validates JWT and checks role in `public.users` table

**[NEW v2.0] RPC Endpoints**:
- `POST /rest/v1/rpc/get_tenant_schedule` - Lightweight calendar data

### 4.2 Data Validation

#### [NEW v2.0] Zod Schema Validation

**`PatientBookingSchema`** (`src/lib/schemas.ts`):
```typescript
import { z } from 'zod'

export const PatientBookingSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string()
    .regex(/^\d+$/, { message: 'Phone number must contain only digits' })
    .min(10, { message: 'Phone number must be at least 10 digits' }),
  date: z.string().refine((val) => {
    const date = new Date(val)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date >= today
  }, { message: 'Date cannot be in the past' }),
  time: z.string().nonempty({ message: 'Time slot is required' }),
  serviceId: z.string().uuid({ message: 'Invalid service ID' }),
  dateOfBirth: z.string().optional(),
  homeAddress: z.string().optional(),
  insuranceProvider: z.string().optional(),
  emergencyContact: z.string().optional(),
  reasonForVisit: z.string().optional(),
})

export type PatientBooking = z.infer<typeof PatientBookingSchema>
```

**Validation Usage**:
```typescript
const result = PatientBookingSchema.safeParse(formData)
if (!result.success) {
  // Display validation errors
  setErrors(result.error.flatten().fieldErrors)
  return
}
// Proceed with encryption and submission
```

#### Server-Side Validation

**Database Constraints**:
- `UNIQUE` constraints: `tenants.slug`, `users.email`, `onboarding_codes.code`
- `NOT NULL` constraints: Required fields
- `CHECK` constraints: `provider_schedules.day_of_week` (0-6)
- Foreign key constraints: Referential integrity

### 4.3 Data Transformation

#### [NEW v2.0] Encryption/Decryption Pipeline

**Write Path (Encryption)**:
```
User Input → Zod Validation → AES-GCM Encryption → HMAC Hash → Supabase Insert
```

**Read Path (Decryption)**:
```
Supabase Select → AES-GCM Decryption → TypeScript Mapping → React Component
```

**Transformation Example** (`appointmentService.ts`):
```typescript
// Write: Encrypt before insert
const insertData = {
  tenant_id: data.tenantId,
  patient_name: await encrypt(data.patientName),
  patient_email: await encrypt(data.patientEmail || ''),
  patient_email_hash: await hashForSearch(data.patientEmail || ''),
  patient_phone: await encrypt(data.patientPhone || ''),
  patient_phone_hash: await hashForSearch(data.patientPhone || ''),
  // ...other fields
}

// Read: Decrypt after select
return Promise.all(
  appointments.map(async (a) => ({
    id: a.id,
    patientName: await decrypt(a.patient_name),
    patientEmail: await decrypt(a.patient_email),
    patientPhone: await decrypt(a.patient_phone),
    // ...other fields
  }))
)
```

#### JSONB Columns

- `tenants.operating_hours_per_day`: Serialized as JSON object
- `tenants.booking_form_config`: Serialized as JSON object
- Serialization handled by Supabase client (automatic JSON.stringify/parse)

#### Date/Time Handling

- Dates stored as `DATE` type (YYYY-MM-DD)
- Times stored as `VARCHAR` (12-hour format: "09:30 AM")
- Conversion functions: `parseTimeToMinutes()`, `convertTo12Hour()`

---

## 5. Connection & Network Handling

### 5.1 Communication Protocols

#### HTTP/HTTPS

**Primary Protocol**: HTTPS for all API calls
- Supabase API: `https://{project}.supabase.co`
- Edge Functions: `https://{project}.supabase.co/functions/v1/{function-name}`
- Resend API: `https://api.resend.com`
- GatewayAPI: `https://gatewayapi.com`

**HTTP Methods Used**:
- `GET`: Fetching data (tenants, services, appointments)
- `POST`: Creating data (appointments, Edge Function calls, RPC calls)
- `PUT`/`PATCH`: Not used (Supabase uses POST with `.update()`)
- `DELETE`: Deleting data (blocked times, tenants)

#### WebSockets

**[NEW v2.0] Supabase Realtime**: Used for live dashboard updates
- Dashboard subscribes to `postgres_changes` channel
- Events: INSERT, UPDATE, DELETE on `appointments` table
- Triggers React Query cache invalidation for instant UI sync

### 5.2 External Integrations

#### Resend API (Email Service)

**Configuration**:
- API Key: Stored in Edge Function secrets (`RESEND_API_KEY`)
- Endpoint: `https://api.resend.com/emails`
- Authentication: Bearer token in `Authorization` header

**Request Format**:
```typescript
{
  from: `${senderName} <${senderLocalPart}@resend.dev>`,
  to: patient_email,
  subject: emailSubject,
  html: htmlContent,
  reply_to?: replyTo
}
```

**Error Handling**:
- 5-second timeout via `fetchWithTimeout()`
- Errors logged but don't fail appointment creation
- Sentry captures exceptions

#### GatewayAPI.com (SMS Service)

**Configuration**:
- API Token: Stored in Edge Function secrets (`GATEWAYAPI_TOKEN`)
- Endpoint: `https://gatewayapi.com/rest/mtsms`
- Authentication: Basic Auth (token as username, empty password)

**Request Format**:
```typescript
{
  sender: senderName (max 11 chars, non-numeric),
  message: smsBody,
  recipients: [{ msisdn: phoneNumber }]
}
```

#### Sentry (Error Tracking)

**Configuration**:
- DSN: Stored in environment variable (`VITE_SENTRY_DSN`)
- Initialized in `src/main.tsx` (frontend) and Edge Functions
- Features: Browser tracing, session replay, error capture

### 5.3 Concurrency Handling

#### TanStack Query Deduplication (v2.0)

Multiple components requesting the same data will share a single request:
```typescript
// Both components share the same network request
// Component A
const { data } = useQuery({ queryKey: ['appointments', tenantId], ... })

// Component B (same query key = deduplicated)
const { data } = useQuery({ queryKey: ['appointments', tenantId], ... })
```

#### Timeout Handling

**`withTimeout()` Utility** (`src/lib/utils.ts`):
```typescript
export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`[Timeout] ${label} took longer than ${ms}ms`)), ms)
    )
  ])
}
```

#### Connection Pool Management

**Supabase Client Singleton** (`src/lib/supabase.ts`):
- Single instance created at module load
- Reused across entire application
- Prevents connection pool exhaustion

---

## 6. Security & Access Control

### 6.1 Authentication

#### Mechanism: JWT (JSON Web Tokens)

**Provider**: Supabase Auth
- Tokens issued by Supabase Auth service
- JWT contains: `user.id`, `user_metadata.role`, `user_metadata.tenant_id`
- Access token: Short-lived (default 1 hour)
- Refresh token: Long-lived (rotated on use)

#### Token Storage

**Location**: `localStorage` (browser)
- Key: `sb-auth-token`
- Storage configured in `src/lib/supabase.ts`:
  ```typescript
  auth: {
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
  }
  ```

#### Authentication Flow

1. **Login** (`authService.login()`):
   - User submits email/password
   - `supabase.auth.signInWithPassword()` called
   - Supabase returns JWT access token + refresh token
   - Application queries `public.users` table to get role/tenant_id
   - Tokens stored in `localStorage`

2. **Session Refresh**:
   - Supabase client automatically refreshes tokens when expired
   - `autoRefreshToken: true` in client config

3. **Logout**:
   - `supabase.auth.signOut()` called
   - Tokens removed from `localStorage`

### 6.2 Authorization

#### Role-Based Access Control (RBAC)

**Roles Defined**:
- `admin`: Platform administrators (can manage all tenants)
- `dentist`: Practice owners (can manage own tenant)
- `patient`: Not used (patients book without authentication)

#### Row Level Security (RLS)

**All Tables Have RLS Enabled**

**Policy Patterns**:

1. **Public Read** (for tenant configuration):
   ```sql
   CREATE POLICY "Enable Public Read Access"
     ON public.tenants FOR SELECT
     TO public
     USING (true);
   ```

2. **Admin Full Access**:
   ```sql
   CREATE POLICY "Admins can manage all tenants"
     ON public.tenants FOR ALL
     USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
     WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
   ```

3. **[NEW v2.0] Hardened JWT Check** (prevents join leaks):
   ```sql
   CREATE POLICY "Tenant isolation via JWT"
     ON public.appointments FOR ALL
     USING (
       tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
     );
   ```
   - Checks JWT metadata directly (not database lookup)
   - Prevents timing attacks through join behavior

### 6.3 [NEW v2.0] Encryption Strategy

#### Application-Level Encryption (AES-GCM)

**Why?**: Zero-trust storage model. Database provider cannot read PII.

**Implementation** (`src/lib/encryption.ts`):
```typescript
export async function encrypt(text: string): Promise<string> {
  if (!text) return text
  
  const key = await importEncryptionKey()  // VITE_ENCRYPTION_KEY
  const encodedText = new TextEncoder().encode(text)
  
  // Generate unique 12-byte IV for each encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  )
  
  // Return format: "IV:CIPHERTEXT" (both Base64 encoded)
  return `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(cipherBuffer)}`
}

export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText
  
  const [ivBase64, cipherBase64] = encryptedText.split(':')
  const iv = base64ToUint8Array(ivBase64)
  const cipherText = base64ToUint8Array(cipherBase64)
  const key = await importEncryptionKey()
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherText
  )
  
  return new TextDecoder().decode(decryptedBuffer)
}
```

**Key Properties**:
- **Algorithm**: AES-GCM (256-bit key)
- **IV**: Random 12 bytes per encryption (stored with ciphertext)
- **Non-deterministic**: Same plaintext produces different ciphertext each time
- **Key Storage**: Environment variable `VITE_ENCRYPTION_KEY` (Base64 encoded)

#### Blind Indexing (HMAC-SHA256)

**Why?**: Allow exact-match search without decrypting database.

**Implementation**:
```typescript
export async function hashForSearch(text: string): Promise<string> {
  if (!text) return text
  
  // Normalize: lowercase, trim
  const normalized = text.toLowerCase().trim()
  
  const key = await importSearchKey()  // VITE_SEARCH_PEPPER
  const encodedText = new TextEncoder().encode(normalized)
  
  const signature = await window.crypto.subtle.sign(
    'HMAC',
    key,
    encodedText
  )
  
  // Return as hex string (64 characters)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

**Key Properties**:
- **Deterministic**: Same input always produces same hash
- **Irreversible**: Cannot derive plaintext from hash
- **Key**: `VITE_SEARCH_PEPPER` (distinct from encryption key)
- **Normalization**: Lowercase + trim before hashing

### 6.4 Environment Variables (Security)

**Required Variables**:
```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# [NEW v2.0] Encryption Keys
VITE_ENCRYPTION_KEY=<32-byte Base64 key for AES-GCM>
VITE_SEARCH_PEPPER=<32-byte Base64 key for HMAC>

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

**Key Generation Example**:
```bash
# Generate 32-byte random key, Base64 encoded
openssl rand -base64 32
```

---

## 7. Frontend Architecture

### 7.1 State Management (v2.0)

**State is now split between two systems:**

#### Server State (TanStack Query)

**Managed Data**:
- Appointments
- Services
- Tenants
- Providers
- Availability

**Benefits**:
- Automatic caching (configurable stale time)
- Background refetching on window focus
- Optimistic updates with rollback
- Request deduplication
- Loading/Error states built-in

#### Client State (Zustand)

**Managed Data**:
- Authentication (`authStore`)
- Admin session (`adminStore`)

**`authStore`** (`src/store/authStore.ts`):
- State: `user`, `session`, `selectedRole`, `isLoading`, `error`, `initialized`
- Actions: `login()`, `logout()`, `initialize()`, `setRole()`, `updateSession()`, `setUser()`

### 7.2 [NEW v2.0] Custom Hooks

**`useOptimisticBlockTime`** (`src/hooks/useOptimisticBlockTime.ts`):
```typescript
interface UseOptimisticBlockTimeProps {
  tenantId: string
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useOptimisticBlockTime({ tenantId, onSuccess, onError }: UseOptimisticBlockTimeProps) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (params: BlockTimeData) => appointmentService.blockTime(params),
    
    onMutate: async (newBlock) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', tenantId] })
      const previous = queryClient.getQueryData(['appointments', tenantId])
      
      queryClient.setQueryData(['appointments', tenantId], (old: any[]) => [
        ...old,
        {
          id: `optimistic-${Date.now()}`,
          date: newBlock.date,
          time: newBlock.startTime,
          service_type: 'Blocked Time',
          status: 'Blocked',
          isOptimistic: true,
        }
      ])
      
      return { previous }
    },
    
    onError: (err, vars, context) => {
      queryClient.setQueryData(['appointments', tenantId], context?.previous)
      onError?.(err)
    },
    
    onSuccess,
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
    },
  })
}
```

### 7.3 Component Hierarchy

#### Layout Components

**`AppLayout`** (`src/components/layout/AppLayout.tsx`):
- Wraps tenant-specific routes (`/:tenant/*`)
- Provides `TenantProvider` context
- Renders `TopNav` component

**`AdminLayout`** (`src/components/layout/AdminLayout.tsx`):
- Wraps admin routes (`/admin/*`)
- Provides admin-specific navigation

#### Page Components

**Public Pages**:
- `HomePage` (`src/pages/home/HomePage.tsx`): Landing page
- `PatientDashboard` (`src/pages/patient/PatientDashboard.tsx`): Booking flow
- `OnboardingPage` (`src/pages/onboarding/OnboardingPage.tsx`): Onboarding form

**Authenticated Pages**:
- `DentistDashboard` (`src/pages/dentist/DentistDashboard.tsx`): Calendar view
- `AnalyticsDashboard` (`src/pages/dentist/AnalyticsDashboard.tsx`): Analytics charts
- `SettingsPage` (`src/pages/dentist/SettingsPage.tsx`): Settings forms
- `TeamPage` (`src/pages/dentist/TeamPage.tsx`): Provider management
- `AdminDashboard` (`src/pages/admin/AdminDashboard.tsx`): Admin tenant list

### 7.4 Testing (v2.0)

**Unit Testing** (`vitest`):
```typescript
// src/services/availabilityService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { availabilityService } from './availabilityService'

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}))

describe('availabilityService', () => {
  describe('getTenantSchedule', () => {
    it('should return empty array when RPC returns no data', async () => {
      const result = await availabilityService.getTenantSchedule('test-id', '2026-01-01', '2026-01-07')
      expect(result).toEqual([])
    })
  })
})
```

**E2E Testing** (`Playwright`):
- Full booking flow tests
- Dashboard interaction tests
- Settings configuration tests

---

## Summary

This documentation describes the **v2.0 architecture** of the Dentist Appointment Planner, which represents a complete migration from a naive MVP to a production-grade secure application.

### Key Architectural Decisions (v2.0)

1. **Application-Level Encryption**: PII is encrypted client-side before storage (AES-GCM)
2. **Blind Indexing**: Searchable encrypted data via HMAC-SHA256 hashes
3. **TanStack Query**: Server state management with caching, optimistic updates, and realtime sync
4. **RPC Functions**: Lightweight data fetching for performance-critical views
5. **Zod Validation**: Runtime schema validation before encryption
6. **RLS Hardening**: JWT-based tenant isolation prevents join leaks
7. **Vitest Testing**: Unit testing for service layer logic

### Environment Variable Requirements

```bash
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_ANON_KEY=<Supabase anonymous key>
VITE_ENCRYPTION_KEY=<32-byte Base64 AES key>
VITE_SEARCH_PEPPER=<32-byte Base64 HMAC key>
VITE_SENTRY_DSN=<Sentry error tracking DSN>
```

### Database Migration Order

```
17_add_blind_index.sql       → Add hash columns
18_harden_rls_security.sql   → Update RLS policies
19_increase_pii_column_sizes.sql → Expand column sizes for ciphertext
20_performance_rpc.sql       → Create lightweight RPC function
```

---

*End of Technical Documentation v2.0* Dont give the entire document as context just describe it in the prompt