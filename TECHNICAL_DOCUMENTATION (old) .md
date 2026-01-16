# Deep-Dive Status Quo Analysis: Dentist Appointment Planner Web Application

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
- **Frontend**: React 19.2.0 SPA built with Vite 7.2.4
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **Deployment Pattern**: JAMstack (JavaScript, APIs, Markup)
- **Database**: PostgreSQL 17 (via Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Hosting**: Static frontend + Supabase cloud services

### Core Technologies & Versions

#### Frontend Dependencies
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.6",
  "@supabase/supabase-js": "^2.84.0",
  "zustand": "^5.0.8",
  "framer-motion": "^12.23.24",
  "lucide-react": "^0.554.0",
  "recharts": "^3.5.0",
  "sonner": "^2.0.7",
  "react-helmet-async": "^2.0.5",
  "@sentry/react": "^10.27.0"
}
```

#### Build Tools & Dev Dependencies
```json
{
  "vite": "^7.2.4",
  "@vitejs/plugin-react": "^5.1.1",
  "typescript": "~5.9.3",
  "tailwindcss": "^3.4.14",
  "postcss": "^8.5.6",
  "autoprefixer": "^10.4.22",
  "@playwright/test": "^1.57.0"
}
```

#### Backend/Edge Functions
- **Runtime**: Deno 2.x (Supabase Edge Functions)
- **Database**: PostgreSQL 17
- **Email Service**: Resend API
- **SMS Service**: GatewayAPI.com

### Project Directory Structure

```
dentist-appointment-planner-web/
├── src/
│   ├── components/          # React components
│   │   ├── admin/           # Admin-specific components
│   │   ├── common/          # Shared components (SEO, etc.)
│   │   ├── dentist/         # Dentist dashboard components
│   │   ├── layout/          # Layout components (AppLayout, AdminLayout, TopNav)
│   │   ├── routes/          # Route-specific components
│   │   ├── settings/        # Settings UI components
│   │   └── ui/              # Reusable UI components (GlassCard, GlassButton, etc.)
│   ├── context/             # React Context providers (TenantContext)
│   ├── data/                # Mock data and tenant configs
│   ├── hooks/               # Custom React hooks (useRevalidation)
│   ├── lib/                 # Utility libraries
│   │   ├── supabase.ts      # Supabase client singleton
│   │   ├── supabaseErrors.ts # Error handling utilities
│   │   ├── utils.ts         # General utilities (cn, withTimeout)
│   │   ├── notifications.ts # Toast notification system
│   │   └── findFirstAvailableDate.ts # Date calculation logic
│   ├── pages/               # Page components
│   │   ├── admin/           # Admin pages (AdminDashboard, AdminLoginPage)
│   │   ├── auth/            # Authentication pages (LoginPage)
│   │   ├── dentist/         # Dentist pages (DentistDashboard, AnalyticsDashboard, SettingsPage, TeamPage)
│   │   ├── home/            # Home page
│   │   ├── onboarding/      # Onboarding flow
│   │   ├── patient/         # Patient booking page
│   │   └── tenant/          # Tenant management pages
│   ├── routes/              # Routing configuration (AppRouter.tsx)
│   ├── services/            # Business logic services
│   │   ├── adminService.ts  # Admin operations (via Edge Function)
│   │   ├── analyticsService.ts # Analytics data fetching
│   │   ├── appointmentService.ts # Appointment CRUD operations
│   │   ├── authService.ts   # Authentication operations
│   │   ├── availabilityService.ts # Availability checking logic
│   │   ├── onboardingService.ts # Onboarding flow logic
│   │   └── tenantService.ts # Tenant configuration fetching
│   ├── store/               # Zustand state management
│   │   ├── authStore.ts    # Authentication state
│   │   └── adminStore.ts   # Admin authentication state
│   ├── types/               # TypeScript type definitions
│   │   ├── index.ts        # Core types (User, Appointment, Provider)
│   │   └── tenant.ts       # Tenant configuration types
│   ├── styles/              # Global CSS
│   └── main.tsx             # Application entry point
├── database/                # SQL migration files
│   ├── 01_schema.sql        # Core database schema
│   ├── 02_functions_and_triggers.sql # Database functions and triggers
│   ├── 03_rls_policies.sql  # Row Level Security policies
│   ├── 04_seed_data.sql     # Seed data
│   ├── 05_create_admin_user.sql # Admin user creation
│   ├── 05_cron_jobs.sql     # Scheduled jobs
│   ├── 06_email_config.sql # Email configuration columns
│   ├── 07_sms_columns.sql  # SMS configuration columns
│   ├── 08_remove_stripe.sql # Stripe removal migration
│   ├── 09_rate_limit.sql    # Rate limiting setup
│   ├── 10_multi_provider.sql # Multi-provider system
│   ├── 11_secure_providers.sql # Provider security updates
│   ├── 12_fix_rls_performance.sql # RLS performance fixes
│   ├── 13_add_missing_columns.sql # Missing column additions
│   ├── 14_add_booking_form_columns.sql # Booking form fields
│   ├── 15_allow_dentist_delete_blocked_time.sql # Blocked time deletion permissions
│   └── 16_add_email_enabled_columns.sql # Email toggle columns
├── supabase/
│   ├── config.toml          # Supabase local development configuration
│   └── functions/           # Edge Functions
│       ├── admin-api/       # Admin operations Edge Function
│       ├── send-confirmation/ # Email/SMS confirmation sender
│       ├── send-reminders/   # Appointment reminder sender
│       └── contact-sales/   # Contact form handler
├── tests/                    # Playwright E2E tests
├── public/                   # Static assets
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── playwright.config.ts     # Playwright test configuration
```

### Significant Entry Points

1. **`src/main.tsx`**: Application bootstrap
   - Initializes Sentry error tracking
   - Sets up React Router
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

---

## 2. Granular Feature Specification

### 2.1 Patient Booking Flow

**Trigger**: User navigates to `/:tenant/book`

**Process Flow**:
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

5. **Summary & Confirmation Stage** (`stage === 'summary'`)
   - Displays booking summary
   - User confirms booking

6. **Appointment Creation** (`appointmentService.createAppointment()`)
   - Validates all required fields
   - Finds available provider via `findAvailableProvider()`:
     - Queries `provider_services` for qualified providers
     - Checks `provider_schedules` for working hours
     - Excludes providers with existing appointments at that time
     - Selects first available provider (round-robin)
   - Inserts appointment into `appointments` table
   - Stores booking form fields in dedicated columns (`date_of_birth`, `home_address`, etc.)
   - Triggers background email/SMS confirmation (fire-and-forget via Edge Function)

**Output**: Appointment created, confirmation sent, user sees success message

**Key Files**:
- `src/pages/patient/PatientDashboard.tsx` (main booking UI)
- `src/services/appointmentService.ts` (appointment creation logic)
- `src/services/availabilityService.ts` (availability checking)
- `src/context/TenantContext.tsx` (tenant data provider)

### 2.2 Dentist Dashboard & Calendar View

**Trigger**: Authenticated dentist navigates to `/:tenant/dentist`

**Process Flow**:
1. **Authentication Check** (`DentistDashboard.tsx`)
   - `useAuthStore` checks for valid session
   - Verifies user role is 'dentist'
   - Verifies `user.tenant_id` matches current tenant
   - Redirects to login if unauthorized

2. **Calendar Data Loading**
   - Loads appointments via `tenantService.getTenantConfig()`
   - Filters appointments by selected provider (if filter active)
   - Groups appointments by date

3. **Week View Rendering**
   - Calculates week window (Monday-Sunday) with `getWeekWindow(weekOffset)`
   - For each day, renders time slots from `operatingHours.startHour` to `operatingHours.endHour`
   - Positions appointments using `toPosition()`:
     - Calculates `topPercent` based on appointment time
     - Calculates `heightPercent` based on service duration
     - Handles blocked times with duration parsing from notes

4. **Appointment Display**
   - Each appointment rendered as positioned card
   - Color-coded by provider (if multi-provider enabled)
   - Shows: patient name, time, service type, status
   - Blocked times shown with different styling

5. **Week Navigation**
   - Previous/Next week buttons update `weekOffset` state
   - Calendar re-renders with new week window

6. **Provider Filtering** (if multi-provider enabled)
   - Dropdown to filter appointments by provider
   - Updates `selectedProviderId` state
   - Filters `appointments` array before rendering

**Output**: Interactive calendar view with appointments positioned by time

**Key Files**:
- `src/pages/dentist/DentistDashboard.tsx` (main calendar UI)
- `src/components/dentist/BlockTimeModal.tsx` (block time functionality)

### 2.3 Block Time Feature

**Trigger**: Dentist clicks "Block Time" button in calendar

**Process Flow**:
1. **Modal Opens** (`BlockTimeModal.tsx`)
   - User selects date, start time, end time
   - Optional: reason for blocking

2. **Validation**
   - Checks end time is after start time
   - Checks for overlapping blocked times:
     - Queries existing blocked appointments for that date
     - Parses duration from notes (`DURATION:60` format)
     - Calculates overlap using time range intersection

3. **Block Time Creation** (`appointmentService.blockTime()`)
   - Converts military time to 12-hour format
   - Calculates duration in minutes
   - Creates appointment with:
     - `status = 'Blocked'`
     - `service_type = 'Blocked Time'`
     - `patient_name = 'Blocked'`
     - Notes: `"${reason} | END_TIME:${endTime} | DURATION:${duration}"`
   - Upserts `appointment_durations` for calendar scaling

4. **UI Update**
   - Optimistically adds blocked time to calendar
   - Refreshes tenant config to sync with database

**Output**: Blocked time appears in calendar, prevents booking at that time

**Key Files**:
- `src/components/dentist/BlockTimeModal.tsx`
- `src/services/appointmentService.ts` (`blockTime()`, `deleteBlockedTime()`)

### 2.4 Multi-Provider System

**Trigger**: Tenant has providers configured in `providers` table

**Process Flow**:
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

**Process Flow**:
1. **Background Invocation** (`appointmentService.createAppointment()`)
   - After appointment creation, invokes Edge Function (fire-and-forget):
     ```typescript
     void supabase.functions.invoke('send-confirmation', { body: {...} })
     ```
   - Does NOT await response (non-blocking)

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

### 2.6 Admin Dashboard

**Trigger**: Admin user navigates to `/admin/dashboard`

**Process Flow**:
1. **Authentication** (`ProtectedAdminRoute` in `AppRouter.tsx`)
   - `useAdminStore.initialize()` checks session
   - Verifies role is 'admin' via JWT metadata
   - Shows loading state with 8-second timeout (prevents infinite spinner)
   - Redirects to `/admin/login` if not authenticated

2. **Tenant List Loading** (`AdminDashboard.tsx`)
   - Calls `adminService.getAllTenants(page, limit)` with pagination
   - Edge Function `admin-api` queries `tenants` table with service role
   - Returns paginated list with total count

3. **Tenant Management Actions**:
   - **Create Tenant**: Opens modal, creates tenant via Edge Function
   - **Edit Tenant**: Opens modal, updates tenant configuration
   - **Delete Tenant**: Confirms, deletes tenant (CASCADE deletes related data)
   - **Generate Onboarding Code**: Creates code in `onboarding_codes` table

4. **Service Management** (`ServicesPage.tsx`)
   - Lists services for selected tenant
   - Add/Edit/Delete services
   - Updates `services` and `service_perks` tables

**Output**: Admin interface for managing all tenants and their configurations

**Key Files**:
- `src/pages/admin/AdminDashboard.tsx`
- `src/store/adminStore.ts`
- `supabase/functions/admin-api/index.ts`

### 2.7 Settings & Customization

**Trigger**: Dentist navigates to `/:tenant/dentist/settings`

**Process Flow**:
1. **Settings Page** (`SettingsPage.tsx`)
   - Loads current tenant configuration
   - Displays editable forms for:
     - Operating hours (global and per-day)
     - Email configuration (sender, templates, toggles)
     - SMS configuration (templates, toggles)
     - Booking form configuration (field visibility/requirement)
     - Practice details (address, timezone, phone, email)

2. **Operating Hours** (`EditOperatingHoursModal.tsx`)
   - Global hours: `operating_start_hour`, `operating_end_hour`
   - Per-day hours: `operating_hours_per_day` JSONB column
     - Structure: `{ monday: { startHour, endHour, enabled }, ... }`
   - Updates via `adminService.updateTenant()`

3. **Email Settings** (`EmailSettings.tsx`)
   - Sender configuration: `email_sender_name`, `email_sender_local_part`, `email_reply_to`
   - Toggle switches: `email_confirmation_enabled`, `email_reminder_enabled`
   - Template editing: `email_confirmation_subject`, `email_confirmation_body`, `email_reminder_subject`, `email_reminder_body`
   - Supports `{{variables}}` in templates

4. **SMS Settings**
   - Toggle switches: `sms_confirmation_enabled`, `sms_reminder_enabled`
   - Template editing: `sms_confirmation_template`, `sms_reminder_template`
   - Supports `{{variables}}` in templates

5. **Booking Form Configuration**
   - JSONB structure: `{ dateOfBirth: { visible, required }, homeAddress: { visible, required }, ... }`
   - Controls which fields appear in patient booking form
   - Updates `booking_form_config` column

**Output**: Tenant configuration updated, changes persist to database

**Key Files**:
- `src/pages/dentist/SettingsPage.tsx`
- `src/components/settings/EmailSettings.tsx`
- `src/components/dentist/EditOperatingHoursModal.tsx`

### 2.8 Onboarding Flow

**Trigger**: New tenant created, admin generates onboarding code

**Process Flow**:
1. **Code Generation** (Admin Dashboard)
   - Admin clicks "Generate Onboarding Code"
   - Edge Function creates entry in `onboarding_codes` table:
     - Random 8-character code (alphanumeric, excludes ambiguous chars)
     - Expires in 30 days (configurable)
     - Linked to `tenant_id`

2. **Onboarding Page** (`/onboard`)
   - User enters onboarding code
   - Validates code: checks `onboarding_codes` table for unused, non-expired code
   - If valid, shows signup form

3. **Account Creation** (`onboardingService.completeOnboarding()`)
   - User enters: email, password, name
   - Creates Supabase Auth user via `authService.signUp()`:
     - Includes metadata: `{ role: 'dentist', tenant_id: <uuid>, name: <name> }`
   - Database trigger `on_auth_user_created` creates `public.users` record
   - Calls `complete_onboarding()` database function:
     - Updates `users` table with tenant_id
     - Marks onboarding code as used
     - Sets `tenants.is_onboarded = true`

4. **Redirect**
   - Redirects to `/:tenant/dentist` dashboard

**Output**: Dentist account created, tenant marked as onboarded

**Key Files**:
- `src/pages/onboarding/OnboardingPage.tsx`
- `src/services/onboardingService.ts`
- `database/02_functions_and_triggers.sql` (`complete_onboarding()` function)

### 2.9 Analytics Dashboard

**Trigger**: Dentist navigates to `/:tenant/dentist/analytics`

**Process Flow**:
1. **Data Fetching** (`AnalyticsDashboard.tsx`)
   - Calls `analyticsService.getAnalytics(tenantId)`
   - Queries database views:
     - `patient_visit_history`: First/last visit, total visits per patient
     - `monthly_patient_stats`: New vs returning patients per month
     - `treatment_distribution`: Service type distribution

2. **Charts Rendering**
   - Uses `recharts` library
   - Displays:
     - Patient visit trends (line chart)
     - Service distribution (pie chart)
     - Monthly statistics (bar chart)

**Output**: Visual analytics dashboard with patient and service metrics

**Key Files**:
- `src/pages/dentist/AnalyticsDashboard.tsx`
- `src/services/analyticsService.ts`
- `database/01_schema.sql` (analytics views)

### 2.10 Team Management

**Trigger**: Dentist navigates to `/:tenant/dentist/team`

**Process Flow**:
1. **Provider List** (`TeamPage.tsx`)
   - Loads providers from tenant config
   - Displays: name, color, active status, linked user (if any)

2. **Provider CRUD** (via Admin API)
   - Create: Adds to `providers` table
   - Update: Updates name, color, active status
   - Delete: Soft delete (sets `is_active = false`) or hard delete
   - Assign Services: Updates `provider_services` junction table
   - Configure Schedule: Updates `provider_schedules` table

**Output**: Provider management interface

**Key Files**:
- `src/pages/dentist/TeamPage.tsx`
- `supabase/functions/admin-api/index.ts` (provider operations)

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

**`appointments`** - Patient appointments
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID,
  patient_name VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255),
  patient_phone VARCHAR(50),
  dentist_id UUID,
  dentist_name VARCHAR(255),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
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
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
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

**`sync_user_role_to_jwt()`** - Syncs role from `public.users` to JWT metadata
- Updates `auth.users.raw_user_meta_data` with role and tenant_id
- Ensures RLS policies can read role from JWT

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
  MAX(CASE WHEN service_type ILIKE '%hygiene%' OR service_type ILIKE '%checkup%' OR service_type ILIKE '%clean%' THEN date END) as last_hygiene_visit
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, patient_name, patient_email, patient_phone;
```

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

**`treatment_distribution`** - Service type distribution
```sql
CREATE OR REPLACE VIEW treatment_distribution AS
SELECT 
  tenant_id,
  service_type as treatment_type,
  COUNT(*) as appointment_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY tenant_id) as percentage
FROM appointments
WHERE status IN ('Completed', 'Confirmed')
GROUP BY tenant_id, service_type;
```

### 3.5 ORM/Query Layer

**No ORM Used** - Direct Supabase Client Queries

The application uses Supabase JavaScript client (`@supabase/supabase-js`) for all database operations. No ORM layer (Prisma, TypeORM, etc.) is used.

**Query Pattern**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('column1, column2, related_table(*)')
  .eq('filter_column', value)
  .order('sort_column', { ascending: true })
  .single() // or .maybeSingle() for optional results
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
- `.limit()` - Result limiting

**RLS Integration**: All queries automatically respect Row Level Security policies. No manual permission checks needed in application code.

### 3.6 State Management

**Transient State Storage**:
- **In-Memory**: React component state (`useState`, `useReducer`)
- **Global State**: Zustand stores (`authStore`, `adminStore`)
- **Context**: React Context API (`TenantContext`)
- **Session Storage**: Supabase Auth tokens stored in `localStorage` (key: `sb-auth-token`)
- **No Redis/Caching**: No server-side caching layer. All data fetched on-demand.

**State Persistence**:
- Authentication state: Persisted in `localStorage` via Supabase Auth
- Tenant configuration: Fetched on-demand, cached in React Context
- No offline support: Application requires active internet connection

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

#### Form Inputs

**Patient Booking Form** (`PatientDashboard.tsx`):
- Fields collected: `name`, `phone`, `email`, `dateOfBirth`, `homeAddress`, `insuranceProvider`, `emergencyContact`, `reasonForVisit`
- Field visibility/requirement controlled by `booking_form_config` JSONB
- Validation: Client-side validation before submission

**Dentist Settings Forms**:
- Operating hours: Number inputs for start/end hours
- Email/SMS templates: Textarea inputs with `{{variable}}` support
- Booking form config: Checkbox inputs for visibility/requirement

#### Webhooks

**None** - Application does not use webhooks. All data flows through REST API.

### 4.2 Data Validation

#### Client-Side Validation

**Manual Checks** (No validation library):
- Email format: Basic regex check
- Phone format: Strips non-numeric characters
- Required fields: Checks for non-empty strings
- Time validation: Ensures end time > start time
- Date validation: Prevents past dates for booking

**Example** (`PatientDashboard.tsx`):
```typescript
if (!details.name.trim() || !details.phone.trim() || !details.email.trim()) {
  setSaveError('Please fill in all required fields')
  return
}
```

#### Server-Side Validation

**Database Constraints**:
- `UNIQUE` constraints: `tenants.slug`, `users.email`, `onboarding_codes.code`
- `NOT NULL` constraints: Required fields
- `CHECK` constraints: `provider_schedules.day_of_week` (0-6)
- Foreign key constraints: Referential integrity

**Edge Function Validation** (`admin-api/index.ts`):
- Validates JWT token
- Checks user role in `public.users` table
- Validates payload structure
- Checks tenant ownership (for dentist users)

**No Schema Validation Library**: Application does not use Zod, Joi, or similar. Validation is manual.

### 4.3 Data Transformation

#### DTOs (Data Transfer Objects)

**No Explicit DTOs** - TypeScript interfaces serve as DTOs:

**`TenantConfig`** (`src/types/tenant.ts`):
- Transforms database `tenants` row to frontend-friendly structure
- Includes nested objects: `hero`, `services`, `availability`, `schedule`, `emailConfig`, `smsConfig`
- Transformation happens in `tenantService.transformTenantToConfig()`

**`Appointment`** (`src/types/index.ts`):
- Maps database columns to frontend structure
- Transforms `provider_id` to `providerId` (camelCase)
- Includes optional booking form fields

**`User`** (`src/types/index.ts`):
- Maps `public.users` table to frontend structure
- Includes `tenant_id` (nullable)

#### Serialization

**JSONB Columns**:
- `tenants.operating_hours_per_day`: Serialized as JSON object
- `tenants.booking_form_config`: Serialized as JSON object
- Serialization handled by Supabase client (automatic JSON.stringify/parse)

**Date/Time Handling**:
- Dates stored as `DATE` type (YYYY-MM-DD)
- Times stored as `VARCHAR` (12-hour format: "09:30 AM")
- Conversion functions: `parseTimeToMinutes()`, `minutesToTimeString()`

#### Data Sanitization

**Input Sanitization**:
- Phone numbers: Stripped to numeric only (`to.replace(/[^0-9]/g, '')`)
- Email: Basic format validation (no XSS sanitization - handled by React)
- Text fields: No HTML sanitization (stored as plain text)

**Output Sanitization**:
- React automatically escapes HTML in JSX
- Template variables replaced via string replacement (no HTML injection risk)
- Email templates use pure HTML generation (no user input in templates)

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
- `POST`: Creating data (appointments, Edge Function calls)
- `PUT`/`PATCH`: Not used (Supabase uses POST with `.update()`)
- `DELETE`: Deleting data (blocked times, tenants)

#### WebSockets

**Supabase Realtime**: Not explicitly used in codebase. Supabase client may use WebSockets for auth state changes, but application does not subscribe to realtime database changes.

#### gRPC

**Not Used** - Application does not use gRPC.

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

**Rate Limiting**: Not handled in code. Relies on Resend's rate limits.

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

**Phone Number Formatting**:
- Stripped to numeric only (MSISDN format)
- Sender name truncated to 11 characters if non-numeric

**Error Handling**:
- 5-second timeout
- Errors logged but don't fail appointment creation

**Rate Limiting**: Not handled in code.

#### Sentry (Error Tracking)

**Configuration**:
- DSN: Stored in environment variable (`VITE_SENTRY_DSN`)
- Initialized in `src/main.tsx` (frontend) and Edge Functions
- Features: Browser tracing, session replay, error capture

**Integration Points**:
- Frontend: React ErrorBoundary, manual `Sentry.captureException()`
- Edge Functions: `Sentry.captureException()` in catch blocks

### 5.3 Concurrency Handling

#### Async/Await Patterns

**All Database Operations**: Use `async/await`
- No callback-based code
- No Promise chains (except for timeout patterns)

**Example Pattern**:
```typescript
async function fetchData() {
  const { data, error } = await supabase
    .from('table')
    .select('*')
  
  if (error) throw error
  return data
}
```

#### Timeout Handling

**`withTimeout()` Utility** (`src/lib/utils.ts`):
- Wraps promises with timeout
- Prevents hanging on slow database queries
- Used in: `authService.getUserFromAuth()`, `tenantService.getTenantConfig()`

**Implementation**:
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

**Critical Comment in Code**:
```typescript
/**
 * Singleton Pattern: Create once, reuse everywhere
 * 
 * CRITICAL: This is a single static instance that should NEVER be recreated.
 * Creating multiple clients causes connection pool exhaustion and timeouts.
 */
```

#### Sequential Loading Pattern

**Tenant Configuration Loading** (`tenantService.getTenantConfig()`):
- Loads queries sequentially (not in parallel)
- Prevents RLS recursion deadlocks
- Prevents connection pool exhaustion

**Pattern**:
```typescript
// 1. Fetch Services (Sequential)
const services = await withTimeout(supabase.from('services').select(...), 5000, 'Fetch Services')

// 2. Fetch Slots (Sequential)
const slots = await withTimeout(supabase.from('availability_slots').select(...), 5000, 'Fetch Slots')

// 3. Fetch Appointments (Sequential)
const appointments = await withTimeout(supabase.from('appointments').select(...), 5000, 'Fetch Appointments')
```

#### Worker Queues

**Not Used** - No background job queue. All operations are synchronous or fire-and-forget.

**Fire-and-Forget Pattern**:
```typescript
// Email sending (non-blocking)
void supabase.functions.invoke('send-confirmation', { body: {...} })
  .then(({ error }) => {
    if (error) console.warn('Background notification warning:', error)
  })
  .catch((err) => console.error('Background notification failed:', err))
```

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

**Security Considerations**:
- Tokens stored in `localStorage` (vulnerable to XSS)
- No `httpOnly` cookies (not possible with Supabase client-side SDK)
- Refresh token rotation enabled (`enable_refresh_token_rotation: true`)

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
   - Refresh happens transparently

3. **Logout**:
   - `supabase.auth.signOut()` called
   - Tokens removed from `localStorage`
   - Session invalidated on server

#### OAuth

**Not Used** - Application only supports email/password authentication.

### 6.2 Authorization

#### Role-Based Access Control (RBAC)

**Roles Defined**:
- `admin`: Platform administrators (can manage all tenants)
- `dentist`: Practice owners (can manage own tenant)
- `patient`: Not used (patients book without authentication)

#### Permission Checks

**Frontend Checks**:
- `useAuthStore`: Checks `user.role` before allowing access
- `ProtectedAdminRoute`: Verifies role is 'admin'
- `DentistDashboard`: Verifies role is 'dentist' and `user.tenant_id` matches

**Backend Checks** (Edge Functions):
- `admin-api/index.ts`: Queries `public.users` table to verify role
- Admin operations: `if (userData.role !== 'admin') return 403`
- Dentist operations: `if (userData.role === 'dentist' && userData.tenant_id !== tenant.id) return 403`

#### Row Level Security (RLS)

**All Tables Have RLS Enabled**:
- `tenants`, `services`, `appointments`, `users`, `providers`, etc.

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

3. **Self-Access** (users can view/update own record):
   ```sql
   CREATE POLICY "Users can view their own record or admins view all"
     ON public.users FOR SELECT
     USING (
       (select auth.uid()) = id
       OR
       (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
     );
   ```

**Critical RLS Implementation Details**:
- JWT checks wrapped in `(select ...)` to prevent recursion
- Policies use `auth.jwt()` for role checks (not database queries)
- `auth.uid()` for self-access checks
- Public read policies use `USING (true)` (no checks)

#### Tenant Isolation

**Dentist Users**:
- Can only access their own tenant (`user.tenant_id === tenant.id`)
- Verified in Edge Functions before allowing operations
- Frontend redirects if tenant mismatch detected

**Admin Users**:
- Can access all tenants
- No tenant isolation for admins

### 6.3 Encryption

#### Data at Rest

**Database Encryption**: Handled by Supabase (PostgreSQL encryption at rest)
- Application does not implement additional encryption

**Password Storage**:
- Passwords hashed by Supabase Auth (bcrypt)
- `public.users.password_hash` column is empty string (password managed by Supabase Auth)

#### Data in Transit

**HTTPS/TLS**: All API calls use HTTPS
- Supabase API: HTTPS only
- Edge Functions: HTTPS only
- External APIs (Resend, GatewayAPI): HTTPS only

**No Additional Encryption**: Application relies on TLS for data in transit.

#### PII (Personally Identifiable Information)

**Stored PII**:
- `appointments.patient_name`, `patient_email`, `patient_phone`
- `users.email`, `name`
- `tenants.address`, `phone`, `email`

**No Encryption**: PII stored as plain text in database. Encryption at rest handled by Supabase infrastructure.

### 6.4 Vulnerability Prevention

#### SQL Injection Prevention

**Parameterized Queries**: Supabase client uses parameterized queries
- All queries use `.eq()`, `.insert()`, `.update()` methods
- No raw SQL strings with user input
- Example: `supabase.from('appointments').insert({ patient_name: userInput })` (safe)

**Edge Functions**: Use Supabase client (parameterized) or REST API (parameterized)
- No raw SQL execution
- No SQL string concatenation

**Database Functions**: Use parameterized function calls
- `complete_onboarding(p_user_id UUID, ...)` - parameters, not strings

#### XSS (Cross-Site Scripting) Prevention

**React Automatic Escaping**: React escapes all JSX content by default
- `<div>{userInput}</div>` - automatically escaped
- No `dangerouslySetInnerHTML` used in user-generated content

**Template Variables**: Email/SMS templates use string replacement
- Variables replaced: `{{patient_name}}`, `{{date}}`, etc.
- No HTML injection risk (templates are plain text, HTML generated separately)

**Input Sanitization**: Limited
- Phone numbers: Stripped to numeric only
- Email: Basic format validation
- No HTML sanitization library (relies on React escaping)

#### CSRF (Cross-Site Request Forgery) Prevention

**Not Explicitly Handled**: 
- Supabase Auth tokens in `localStorage` are not automatically sent with requests
- Tokens sent explicitly in `Authorization` header
- No CSRF tokens used

**Mitigation**: Relies on SameSite cookies (if any) and CORS policies.

#### CORS Configuration

**Edge Functions**: Allow all origins
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Supabase API**: CORS handled by Supabase (configurable in dashboard)

#### Rate Limiting

**Supabase Auth Rate Limits** (configured in `supabase/config.toml`):
- Email sent: 2 per hour
- SMS sent: 30 per hour
- Sign in/sign up: 30 per 5 minutes
- Token refresh: 150 per 5 minutes

**Application-Level Rate Limiting**: Not implemented. Relies on Supabase and external API rate limits.

#### Input Validation

**Client-Side**: Basic validation (required fields, email format)
**Server-Side**: Database constraints (NOT NULL, UNIQUE, CHECK)
**No Schema Validation Library**: Manual validation only

---

## 7. Frontend Architecture

### 7.1 State Management

#### Zustand Stores

**`authStore`** (`src/store/authStore.ts`):
- State: `user`, `session`, `selectedRole`, `isLoading`, `error`, `initialized`
- Actions: `login()`, `logout()`, `initialize()`, `setRole()`, `updateSession()`, `setUser()`
- Persistence: Session persisted in `localStorage` via Supabase Auth
- Initialization: Checks existing session on app load, subscribes to auth state changes

**`adminStore`** (`src/store/adminStore.ts`):
- State: `isAuthenticated`, `isLoading`, `initialized`, `error`
- Actions: `login()`, `logout()`, `initialize()`
- Purpose: Separate store for admin authentication (simpler than main auth store)

#### React Context

**`TenantContext`** (`src/context/TenantContext.tsx`):
- Provides: `config`, `slug`, `tenantId`, `isLoading`, `error`, `refresh()`, `isOnboarded`
- Fetches tenant configuration via `tenantService.getTenantConfig()`
- Caches config in context state
- Refreshes on demand via `refresh()` function

#### Component State

**Local State** (`useState`, `useReducer`):
- Form inputs: Controlled components with local state
- UI state: Modals, dropdowns, selected items
- Optimistic updates: Local state updated before API confirmation

**Example** (`DentistDashboard.tsx`):
```typescript
const [localAppointments, setLocalAppointments] = useState<Appointment[]>([])
// Optimistically update before API call
setLocalAppointments([...localAppointments, newAppointment])
```

### 7.2 Component Hierarchy

#### Layout Components

**`AppLayout`** (`src/components/layout/AppLayout.tsx`):
- Wraps tenant-specific routes (`/:tenant/*`)
- Provides `TenantProvider` context
- Renders `TopNav` component

**`AdminLayout`** (`src/components/layout/AdminLayout.tsx`):
- Wraps admin routes (`/admin/*`)
- Provides admin-specific navigation

**`TopNav`** (`src/components/layout/TopNav.tsx`):
- Navigation bar for authenticated users
- Shows user name, logout button
- Tenant-specific navigation links

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

#### UI Components

**Glass Components** (Glassmorphism design):
- `GlassCard`: Card with glass effect
- `GlassButton`: Button with glass effect
- `GlassBadge`: Badge with glass effect
- `GlassInput`: Input with glass effect

**Common Components**:
- `SEO` (`src/components/common/SEO.tsx`): Meta tags management (react-helmet-async)

### 7.3 Routing Logic

#### Router Configuration

**`AppRouter`** (`src/routes/AppRouter.tsx`):
- Uses `react-router-dom` v7.9.6
- `createBrowserRouter` for route definition

**Route Structure**:
```typescript
{
  path: '/',
  element: <HomePage />
},
{
  path: '/:tenant',
  element: <TenantRoute />, // Wraps in TenantProvider
  children: [
    { path: 'book', element: <PatientDashboard /> },
    { path: 'login', element: <LoginPage /> },
    { path: 'dentist', element: <DentistDashboard /> },
    { path: 'dentist/analytics', element: <AnalyticsDashboard /> },
    { path: 'dentist/services', element: <ServicesPage /> },
    { path: 'dentist/team', element: <TeamPage /> },
    { path: 'dentist/settings', element: <SettingsPage /> },
  ]
},
{
  path: '/admin',
  element: <AdminLayout />,
  children: [
    { path: 'login', element: <AdminLoginPage /> },
    { path: 'dashboard', element: <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute> },
  ]
},
{ path: '/onboard', element: <OnboardingPage /> },
{ path: '*', element: <SmartCatchAll /> } // Catch-all route
```

#### Protected Routes

**`ProtectedAdminRoute`**:
- Checks `useAdminStore.isAuthenticated`
- Shows loading state (with 8-second timeout)
- Redirects to `/admin/login` if not authenticated

**Dentist Routes**:
- No route-level protection (handled in component)
- `DentistDashboard` checks auth and redirects if needed

#### Route Guards

**None** - Protection handled at component level, not route level.

### 7.4 Data Fetching

#### Supabase Client

**Primary Method**: Direct Supabase client queries
- `supabase.from('table').select(...)`
- Automatic RLS enforcement
- Real-time subscriptions not used

#### Service Layer Pattern

**Services** (`src/services/*.ts`):
- Encapsulate data fetching logic
- Transform database responses to TypeScript types
- Handle errors and retries
- Examples: `appointmentService`, `tenantService`, `authService`

#### Fetching Patterns

**On-Demand Fetching**:
- Data fetched when component mounts
- No prefetching or caching beyond React state

**Sequential Loading** (`tenantService.getTenantConfig()`):
- Queries executed sequentially to prevent connection pool exhaustion
- Each query has 5-second timeout

**Optimistic Updates**:
- Local state updated before API confirmation
- Example: Adding appointment to calendar before API response

#### No Data Fetching Library

**Not Used**: Application does not use SWR, TanStack Query, or similar. All fetching via Supabase client or native `fetch()`.

#### Error Handling

**Try-Catch Blocks**: All async operations wrapped in try-catch
**Error State**: Components track `error` state
**User Feedback**: Toast notifications via `sonner` library
**Sentry Integration**: Errors captured and sent to Sentry

---

## Summary

This application is a **multi-tenant dental appointment booking system** built as a React SPA with Supabase backend. Key architectural decisions:

1. **No ORM**: Direct Supabase client queries
2. **RLS for Security**: Row-level security policies enforce access control
3. **Edge Functions for Admin**: Admin operations use service role via Edge Functions
4. **Multi-Provider Support**: Providers can be assigned to appointments with schedules
5. **Fire-and-Forget Notifications**: Email/SMS sent asynchronously without blocking
6. **Sequential Loading**: Prevents connection pool exhaustion
7. **Zustand for State**: Lightweight state management
8. **No Data Fetching Library**: Direct Supabase client usage

The codebase is production-ready with error tracking, timeout handling, and comprehensive security policies.



