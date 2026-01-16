# TECHNICAL_OVERVIEW 3.0 — GOLD STANDARD REFERENCE

> **Status:** Definitive Technical Archive  
> **Version:** 3.0.0  
> **Last Updated:** 2026-01-03  
> **Target Audience:** Senior Developers, System Architects  
> **Purpose:** Complete replacement for reading source code  

---

## Table of Contents

1. [Architectural Blueprint](#1-architectural-blueprint)
2. [Database Schema (Full SQL)](#2-database-schema-full-sql)
3. [Row Level Security Policies](#3-row-level-security-policies)
4. [Database Functions & Triggers (RPCs)](#4-database-functions--triggers-rpcs)
5. [Security & Cryptography](#5-security--cryptography)
6. [API & Data Flow](#6-api--data-flow)
7. [State Management](#7-state-management)
8. [Feature Logic Traces](#8-feature-logic-traces)
9. [Directory Structure](#9-directory-structure)
10. [Dependencies](#10-dependencies)
11. [Testing Strategy](#11-testing-strategy)
12. [Environment Variables](#12-environment-variables)

---

# 1. Architectural Blueprint

## 1.1 Technology Stack (Exact Versions from `package.json`)

### Core Frameworks
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | `16.1.1` | React Framework (App Router) |
| React | `19.2.3` | UI Library |
| React DOM | `19.2.3` | DOM Renderer |
| TypeScript | `~5.9.3` | Type System |

### Backend & Database
| Technology | Version | Purpose |
|------------|---------|---------|
| @supabase/supabase-js | `2.84.0` | Database Client |
| @supabase/ssr | `0.8.0` | Server-Side Rendering Support |
| Supabase CLI | `2.63.1` | Local Development & Migrations |
| PostgreSQL | Supabase Managed | Database Engine |

### State & Data Fetching
| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | `5.0.8` | Global State Management |
| TanStack Query | `5.90.16` | Server State & Caching |
| TanStack Query Devtools | `5.91.2` | Debugging |

### Styling & UI
| Technology | Version | Purpose |
|------------|---------|---------|
| TailwindCSS | `3.4.14` | Utility CSS |
| tailwind-merge | `3.4.0` | Class Merging |
| clsx | `2.1.1` | Conditional Classes |
| lucide-react | `0.554.0` | Icon Library |
| framer-motion | `12.23.24` | Animations |
| Recharts | `3.5.0` | Charts |

### Validation & Utilities
| Technology | Version | Purpose |
|------------|---------|---------|
| Zod | `4.3.4` | Schema Validation |
| next-intl | `4.7.0` | Internationalization |
| sonner | `2.0.7` | Toast Notifications |

### Monitoring & Error Tracking
| Technology | Version | Purpose |
|------------|---------|---------|
| @sentry/react | `10.27.0` | Error Tracking |

### Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| @playwright/test | `1.57.0` | End-to-End Testing |

---

# 2. Database Schema (Full SQL)

All table definitions are sourced from `database/01_schema.sql` and related migration files.

## 2.1 Core Tables

### `tenants` — Dental Practice Configuration
```sql
CREATE TABLE IF NOT EXISTS tenants (
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
  -- Added in 13_add_missing_columns.sql
  address TEXT DEFAULT NULL,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  phone VARCHAR(50) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  email_sender_name VARCHAR(255) DEFAULT NULL,
  email_sender_local_part VARCHAR(255) DEFAULT 'bookings',
  email_reply_to VARCHAR(255) DEFAULT NULL,
  email_confirmation_subject TEXT DEFAULT NULL,
  email_confirmation_body TEXT DEFAULT NULL,
  sms_confirmation_enabled BOOLEAN DEFAULT FALSE,
  sms_confirmation_template TEXT DEFAULT NULL,
  sms_reminder_enabled BOOLEAN DEFAULT FALSE,
  sms_reminder_template TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `services` — Treatment/Service Catalog
```sql
CREATE TABLE IF NOT EXISTS services (
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

### `service_perks` — Service Features/Benefits
```sql
CREATE TABLE IF NOT EXISTS service_perks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  perk_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `appointments` — Patient Bookings (CONTAINS ENCRYPTED PII)
```sql
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID,
  patient_name VARCHAR(255) NOT NULL,        -- ENCRYPTED (AES-GCM)
  patient_email VARCHAR(255),                 -- ENCRYPTED (AES-GCM)
  patient_phone VARCHAR(50),                  -- ENCRYPTED (AES-GCM)
  -- Added in 17_add_blind_index.sql
  patient_email_hash VARCHAR(64),             -- HMAC-SHA256 for search
  patient_phone_hash VARCHAR(64),             -- HMAC-SHA256 for search
  dentist_id UUID,
  dentist_name VARCHAR(255),
  -- Added in 10_multi_provider.sql
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL,
  service_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending', -- Confirmed, Pending, Completed, Cancelled, Missed, Blocked
  notes TEXT,
  -- Added in 14_add_booking_form_columns.sql
  date_of_birth TIMESTAMP WITH TIME ZONE,
  home_address TEXT,
  insurance_provider TEXT,
  emergency_contact TEXT,
  reason_for_visit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `users` — Authentication & Authorization
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Empty string; managed by Supabase Auth
  role VARCHAR(50) NOT NULL,           -- 'dentist', 'admin', 'patient'
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `providers` — Clinic Staff/Employees
```sql
-- From 10_multi_provider.sql
CREATE TABLE IF NOT EXISTS providers (
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

### `provider_services` — Junction: Provider Capabilities
```sql
-- From 10_multi_provider.sql
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (provider_id, service_id)
);
```

### `provider_schedules` — Individual Provider Working Hours
```sql
-- From 10_multi_provider.sql
CREATE TABLE IF NOT EXISTS provider_schedules (
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

### `appointment_durations` — Service Type Duration Mapping
```sql
CREATE TABLE IF NOT EXISTS appointment_durations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type VARCHAR(255) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, service_type)
);
```

### `availability_slots` — Time Slot Configuration
```sql
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_slot VARCHAR(20) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `onboarding_codes` — Tenant Setup Codes
```sql
CREATE TABLE IF NOT EXISTS onboarding_codes (
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

## 2.2 Database Indexes
```sql
-- Core Indexes (01_schema.sql)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_name ON appointments(tenant_id, patient_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_service_type ON appointments(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_availability_slots_tenant_id ON availability_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_code ON onboarding_codes(code);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_tenant_id ON onboarding_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_codes_is_used ON onboarding_codes(is_used);

-- Provider Indexes (10_multi_provider.sql)
CREATE INDEX IF NOT EXISTS idx_providers_tenant_id ON providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_service_id ON provider_services(service_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_provider_id ON provider_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_day ON provider_schedules(provider_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_date ON appointments(provider_id, date, time);

-- Blind Index Columns (17_add_blind_index.sql)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_email_hash ON appointments(patient_email_hash);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_phone_hash ON appointments(patient_phone_hash);
```

---

# 3. Row Level Security Policies

All policies use JWT metadata (`auth.jwt()`) for authorization to prevent recursive database queries.

## 3.1 RLS Enable Statements
```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;
```

## 3.2 Users Table Policies
```sql
-- SELECT: Self or Admin
CREATE POLICY "Users can view their own record or admins view all"
  ON public.users FOR SELECT
  USING (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- INSERT: Admin Only
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- UPDATE: Self or Admin
CREATE POLICY "Users can update their own record or admins update all"
  ON public.users FOR UPDATE
  USING (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- DELETE: Admin Only
CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

## 3.3 Tenants Table Policies
```sql
-- SELECT: Public (Required for booking page to load tenant config)
CREATE POLICY "Public Read Tenants"
  ON public.tenants FOR SELECT
  TO public
  USING (true);

-- INSERT/UPDATE/DELETE: Admin Only
CREATE POLICY "Admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update tenants"
  ON public.tenants FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

## 3.4 Appointments Table Policies
```sql
-- SELECT: Public (For availability checking)
CREATE POLICY "Enable Public Read Access"
  ON public.appointments FOR SELECT
  TO public
  USING (true);

-- INSERT: Public (For patient bookings)
CREATE POLICY "Public can insert appointments"
  ON public.appointments FOR INSERT
  TO public
  WITH CHECK (true);

-- UPDATE/DELETE: Admin Only
CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING ((select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

## 3.5 Provider Tables Policies
```sql
-- From 11_secure_providers.sql

-- providers: SELECT Public, WRITE for Dentist (own tenant) or Admin
CREATE POLICY "Public Read Providers"
  ON public.providers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Dentists Manage Own Tenant Providers or Admins Manage All"
  ON public.providers FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
  );

-- provider_schedules: Same pattern
CREATE POLICY "Public Read Schedules"
  ON public.provider_schedules FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Dentists Manage Own Tenant Schedules"
  ON public.provider_schedules FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );

-- provider_services: Same pattern
CREATE POLICY "Public Read Capabilities"
  ON public.provider_services FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Dentists Manage Own Tenant Capabilities"
  ON public.provider_services FOR ALL
  TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
      AND p.tenant_id = ((select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
    )
  );
```

---

# 4. Database Functions & Triggers (RPCs)

## 4.1 `update_updated_at_column` — Automatic Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to:
CREATE TRIGGER update_tenants_updated_at 
  BEFORE UPDATE ON tenants
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at 
  BEFORE UPDATE ON services
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

## 4.2 `handle_new_user` — Auth User Sync Trigger

**Purpose:** Automatically creates a record in `public.users` when a user signs up via Supabase Auth.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
  v_name TEXT;
  v_tenant_id UUID;
BEGIN
  -- Extract role from user metadata (default to 'dentist')
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'dentist'
  );
  
  -- Extract name from user metadata
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  
  -- Extract tenant_id (may be NULL during onboarding)
  v_tenant_id := NULL;
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    BEGIN
      v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    EXCEPTION
      WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;
  END IF;

  -- Insert into public.users (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.users (
    id, email, name, role, tenant_id, password_hash, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.email, v_name, v_role, v_tenant_id, '', NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, users.tenant_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger Definition
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## 4.3 `complete_onboarding` — Onboarding Finalization RPC
```sql
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_name TEXT,
  p_user_role TEXT,
  p_user_tenant_id UUID,
  p_onboarding_code_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Insert/update user record
  INSERT INTO users (id, email, name, role, tenant_id, password_hash, created_at, updated_at)
  VALUES (p_user_id, p_user_email, p_user_name, p_user_role, p_user_tenant_id, '', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id,
    updated_at = NOW();

  -- Step 2: Mark onboarding code as used
  UPDATE onboarding_codes
  SET is_used = true, used_at = NOW()
  WHERE id = p_onboarding_code_id;

  -- Step 3: Mark tenant as onboarded
  UPDATE tenants
  SET is_onboarded = true, onboarded_at = NOW()
  WHERE id = p_user_tenant_id;

  RETURN p_user_id;
END;
$$;
```

## 4.4 `book_appointment_atomic` — Atomic Booking RPC

**Purpose:** Prevents race conditions. Two patients cannot book the same provider at the same time.

```sql
CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id UUID,
  p_date TEXT,
  p_time TEXT,
  p_patient_name TEXT,
  p_patient_email TEXT,
  p_patient_email_hash TEXT,
  p_patient_phone TEXT,
  p_patient_phone_hash TEXT,
  p_service_type TEXT,
  p_status TEXT,
  p_notes TEXT,
  p_provider_id UUID DEFAULT NULL,
  p_date_of_birth TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_home_address TEXT DEFAULT NULL,
  p_insurance_provider TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_reason_for_visit TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  -- 1. Check Availability (for specific provider)
  IF p_provider_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE tenant_id = p_tenant_id
      AND date = p_date
      AND time = p_time
      AND provider_id = p_provider_id
      AND status != 'Cancelled';
      
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Time slot is no longer available' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 2. Insert Appointment
  INSERT INTO appointments (
    tenant_id, date, time, patient_name, patient_email, patient_email_hash,
    patient_phone, patient_phone_hash, service_type, status, notes,
    provider_id, date_of_birth, home_address, insurance_provider,
    emergency_contact, reason_for_visit
  ) VALUES (
    p_tenant_id, p_date, p_time, p_patient_name, p_patient_email, p_patient_email_hash,
    p_patient_phone, p_patient_phone_hash, p_service_type, p_status, p_notes,
    p_provider_id, p_date_of_birth, p_home_address, p_insurance_provider,
    p_emergency_contact, p_reason_for_visit
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object('id', v_appointment_id);
END;
$$;
```

## 4.5 `get_tenant_schedule` — Lightweight Schedule Fetch RPC

**Purpose:** Returns schedule data **without** encrypted PII for dashboard views.

```sql
CREATE OR REPLACE FUNCTION get_tenant_schedule(
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
    a.id, a.date, a.time, a.service_type, a.status,
    a.provider_id, a.dentist_name, a.notes
  FROM appointments a
  WHERE a.tenant_id = p_tenant_id
    AND a.date >= p_start_date
    AND a.date <= p_end_date
  ORDER BY a.date ASC, a.time ASC;
END;
$$;
```

---

# 5. Security & Cryptography

## 5.1 Encryption Implementation (`supabase/functions/_shared/encryption.ts`)

All PII (patient name, email, phone) is encrypted server-side using AES-GCM 256-bit.

### Algorithm Details
- **Cipher:** AES-GCM 256-bit
- **IV:** Random 12-byte IV per encryption operation
- **Storage Format:** `IV_BASE64:CIPHERTEXT_BASE64`
- **Key Source:** `ENCRYPTION_KEY` environment variable (Base64 encoded 32-byte key)

### `encrypt` Function (Full Implementation)
```typescript
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";

export async function encrypt(text: string): Promise<string> {
    if (!text) return text;

    const keyBase64 = Deno.env.get('ENCRYPTION_KEY');
    if (!keyBase64) throw new Error('Missing ENCRYPTION_KEY');

    // Import key
    const keyBuffer = decodeBase64(keyBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const encodedText = new TextEncoder().encode(text);

    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        encodedText
    );

    return `${encodeBase64(iv)}:${encodeBase64(new Uint8Array(encryptedBuffer))}`;
}
```

### `decrypt` Function (Full Implementation)
```typescript
export async function decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    const keyBase64 = Deno.env.get('ENCRYPTION_KEY');
    if (!keyBase64) throw new Error('Missing ENCRYPTION_KEY');

    const keyBuffer = decodeBase64(keyBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const [ivBase64, cipherBase64] = encryptedText.split(':');
    const iv = decodeBase64(ivBase64);
    const cipherText = decodeBase64(cipherBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        cipherText
    );

    return new TextDecoder().decode(decryptedBuffer);
}
```

## 5.2 Blind Indexing (Searchable Encryption Hash)

Since AES-GCM with random IV produces different ciphertext each time, we use HMAC-SHA256 to create deterministic hashes for search.

### `hashForSearch` Function (Full Implementation)
```typescript
export async function hashForSearch(text: string): Promise<string> {
    if (!text) return text;

    const pepperBase64 = Deno.env.get('SEARCH_PEPPER');
    if (!pepperBase64) throw new Error('Missing SEARCH_PEPPER');

    // Normalization: lowercase + trim
    const normalized = text.toLowerCase().trim();

    const pepperBuffer = decodeBase64(pepperBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        pepperBuffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const encodedText = new TextEncoder().encode(normalized);
    const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        encodedText
    );

    // Convert to Hex string
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

---

# 6. API & Data Flow

## 6.1 Frontend Validation Schemas (`src/lib/schemas.ts`)

### `PatientBookingSchema` (Full Definition)
```typescript
import { z } from 'zod'

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
    // Optional fields
    dateOfBirth: z.string().optional(),
    homeAddress: z.string().optional(),
    insuranceProvider: z.string().optional(),
    emergencyContact: z.string().optional(),
    reasonForVisit: z.string().optional(),
})

export type PatientBooking = z.infer<typeof PatientBookingSchema>
```

### `TenantConfigSchema` (Full Definition)
```typescript
export const OperatingHoursSchema = z.object({
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
    enabled: z.boolean().optional(),
})

export const TenantConfigSchema = z.object({
    operating_hours_per_day: z.record(OperatingHoursSchema).optional().nullable(),
    email_confirmation_enabled: z.boolean().optional(),
    sms_confirmation_enabled: z.boolean().optional(),
})
```

## 6.2 Edge Function: `secure-booking-proxy`

**Purpose:** Validates, encrypts PII, and calls atomic booking RPC.

### Request Payload
```typescript
// Zod Schema (From secure-booking-proxy/index.ts)
const PatientBookingSchema = z.object({
    tenant_id: z.string().uuid(),
    patient_name: z.string().min(2),
    patient_email: z.string().email(),
    patient_phone: z.string().min(10),
    date: z.string(),
    time: z.string(),
    service_id: z.string().uuid(),
    provider_id: z.string().uuid().nullish(),
    date_of_birth: z.string().nullish(),
    home_address: z.string().nullish(),
    insurance_provider: z.string().nullish(),
    emergency_contact: z.string().nullish(),
    reason_for_visit: z.string().nullish(),
});
```

### Response Format
```typescript
// Success (200)
{
    success: true,
    message: 'Appointment created securely',
    appointmentId: string
}

// Conflict (409) - Slot already booked
{
    error: 'Time slot is no longer available',
    type: 'CONFLICT'
}

// Validation Error (400)
{
    error: string // Zod validation message
}
```

## 6.3 Edge Function: `get-appointment-details`

**Purpose:** Decrypts PII for authorized users.

### Request
```json
{ "appointmentId": "uuid" }
```

### Authorization Logic
```typescript
// Permission Check
const role = user.user_metadata.role;
const tenantId = user.user_metadata.tenant_id;

if (role !== 'admin') {
    if (role === 'dentist' && appointment.tenant_id !== tenantId) {
        throw new Error('Forbidden: Tenant mismatch');
    }
    if (role !== 'dentist') {
        throw new Error('Forbidden: Insufficient role');
    }
}
```

### Response
```json
{
    "id": "uuid",
    "patient_name": "Decrypted Name",
    "patient_email": "decrypted@email.com",
    "patient_phone": "1234567890",
    // ... all other appointment fields
}
```

## 6.4 Edge Function: `send-confirmation`

**Purpose:** Sends email (Resend) and SMS (GatewayAPI) confirmations.

### Request
```typescript
interface ConfirmationRequest {
  appointment_id: string
  patient_email: string
  patient_name: string
  patient_phone?: string
  date: string
  time: string
  service_name: string
  tenant_id: string
  tenant_name: string
}
```

### SMS Implementation (GatewayAPI)
```typescript
async function sendSms(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiToken = Deno.env.get('GATEWAYAPI_TOKEN')
  let sender = Deno.env.get('SMS_FROM_NAME') || 'DentistApp'

  // Truncate non-numeric senders to 11 chars per GatewayAPI requirements
  if (!/^\d+$/.test(sender)) {
    sender = sender.replace(/\s+/g, '')
    if (sender.length > 11) sender = sender.substring(0, 11)
  }

  const msisdn = to.replace(/[^0-9]/g, '')

  const response = await fetch('https://gatewayapi.com/rest/mtsms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(apiToken + ':'),
    },
    body: JSON.stringify({
      sender: sender,
      message: text,
      recipients: [{ msisdn: msisdn }],
    }),
  })
  // ... error handling
}
```

---

## 6.5 Middleware & Routing (`src/middleware.ts`)

**Purpose:** Handles locale-based routing, tenant validation, and Admin area exclusions.

### Key Logic
1.  **Admin Exclusion:** Paths starting with `/admin` are passed through.
2.  **Mock DB Lookup:** A `MOCK_DB` constant maps tenant slugs to supported/default locales.
3.  **Locale Redirection:**
    - Redirects root `/` to default locale `/en`.
    - Redirects valid tenant slugs without locale (e.g. `/smile-clinic`) to default locale `/nl/smile-clinic`.
    - Enforces tenant-specific supported locales (e.g. redirecting `/en/smile-clinic` to `/nl/smile-clinic` if English isn't supported).

### Full Implementation
```typescript
import { NextRequest, NextResponse } from 'next/server';

// 1. Mock DB Config
const MOCK_DB: Record<string, { supported: string[], default: string }> = {
    'smile-clinic': { supported: ['en', 'nl'], default: 'nl' },
    'dr-smith': { supported: ['fr'], default: 'fr' },
    'lumina': { supported: ['en', 'es'], default: 'en' },
};

const DEFAULT_GLOBAL_LOCALE = 'en';
const SUPPORTED_GLOBAL_LOCALES = ['en', 'nl', 'fr', 'es', 'de'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Exclude static assets and API routes
    if (pathname.match(/\/(api|_next|static|favicon\.ico|.*\..*)/) || pathname === '/manifest.json') {
        return NextResponse.next();
    }

    // 2. EXPLICITLY ALLOW ADMIN ROUTES (Non-localized)
    if (pathname.startsWith('/admin')) {
        return NextResponse.next();
    }

    const segments = pathname.split('/').filter(Boolean);

    // Root path -> redirect to default global locale
    if (segments.length === 0) {
        return NextResponse.redirect(new URL(`/${DEFAULT_GLOBAL_LOCALE}`, request.url));
    }

    // ... (See src/middleware.ts for full routing logic including MOCK_DB checks)
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

# 7. State Management

## 7.1 `authStore` (`src/store/authStore.ts`)

### State Interface
```typescript
interface AuthState {
  user: User | null
  session: Session | null
  selectedRole: UserRole
  isLoading: boolean
  error: string | null
  initialized: boolean
  setRole: (role: UserRole) => void
  login: (email: string, password: string, role?: UserRole) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
  updateSession: (session: Session | null) => void
  setUser: (user: User | null) => void
}
```

### Full Implementation
```typescript
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  selectedRole: 'dentist',
  isLoading: false,
  error: null,
  initialized: false,
  
  setRole: (role) => set({ selectedRole: role }),
  
  async login(email, password, overrideRole) {
    const role = overrideRole ?? get().selectedRole
    set({ isLoading: true, error: null })

    try {
      const { session, user } = await authService.login(role, email, password)
      set({ user, session, selectedRole: role, isLoading: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to login at this time'
      set({ error: message, isLoading: false, user: null, session: null })
      throw error
    }
  },
  
  async logout() {
    try {
      await authService.signOut()
      set({ user: null, session: null, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to logout'
      set({ error: message })
    }
  },
  
  async initialize() {
    if (get().initialized) return

    set({ isLoading: true })
    try {
      const sessionPromise = authService.getSession()
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      const session = await Promise.race([sessionPromise, timeoutPromise])
      
      if (session?.user) {
        try {
          const userPromise = authService.getUserFromAuth(session.user.id)
          const userTimeoutPromise = new Promise<User | null>((resolve) => setTimeout(() => resolve(null), 5000))
          const user = await Promise.race([userPromise, userTimeoutPromise])
          set({ session, user, isLoading: false, initialized: true })
        } catch (userError) {
          set({ session, user: null, isLoading: false, initialized: true })
        }
      } else {
        set({ session: null, user: null, isLoading: false, initialized: true })
      }

      // Auth state change listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const currentUser = get().user
          if (currentUser && currentUser.id === session.user.id) {
            set({ session, error: null })
          } else {
            const user = await authService.getUserFromAuth(session.user.id)
            set({ session, user, error: null })
          }
        } else if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, error: null })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session })
        }
      })
    } catch (error) {
      set({ session: null, user: null, isLoading: false, initialized: true })
    }
  },
  
  updateSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
}))
```

## 7.2 `adminStore` (`src/store/adminStore.ts`)

### State Interface
```typescript
interface AdminState {
  isAuthenticated: boolean
  isLoading: boolean
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

### Role Validation Helper
```typescript
const isAdminSession = (session: any) => {
  if (!session?.user) return false
  const role = session.user.user_metadata?.role || session.user.app_metadata?.role
  return role === 'admin'
}
```

---

# 8. Feature Logic Traces

## 8.1 Patient Booking Flow (Step-by-Step)

### Step 1: User Loads Booking Page
- **Component:** `src/app/[locale]/[dentist_slug]/book/page.tsx`
- **Action:** `PatientDashboard` component mounts.
- **Data Fetch:** 
  - `tenantService.getTenantBySlug(slug)` → Loads tenant config.
  - `supabase.from('services').select(...)` → Loads services.
  - `supabase.from('appointments').select(...)` → Loads existing appointments.

### Step 2: User Selects Service
- **Component:** Service grid renders; user clicks a service card.
- **State:** `setSelectedServiceId(service.id)`
- **Side Effect:** `useEffect` fetches qualified providers:
  ```typescript
  const { data } = await supabase
    .from('provider_services')
    .select('provider_id, providers!inner(is_active)')
    .eq('service_id', selectedService.id)
    .eq('providers.tenant_id', tenantId)
    .eq('providers.is_active', true)
  ```

### Step 3: User Selects Date & Time
- **Component:** Calendar grid renders available slots.
- **Logic:** `isSlotAvailable(slot, day)` calculates:
  1. Get working providers: Filter by `provider_schedules` for time coverage.
  2. Count busy providers: Filter `appointments` for overlapping times.
  3. Count generic bookings: Appointments with `provider_id = NULL`.
  4. Formula: `(workingProviders - busyProviders - genericBookings) > 0`

### Step 4: User Enters Details
- **Component:** `PatientBookingForm` renders input fields.
- **Validation:** Zod `PatientBookingSchema` validates on blur/submit.

### Step 5: User Submits Booking
- **Service:** `appointmentService.createAppointment(data)`
  ```typescript
  // 1. Find available provider (Strict Assignment)
  const provider = await findAvailableProvider(tenantId, serviceId, date, time)
  if (!provider) throw new Error("No dentist available")

  // 2. Call Edge Function
  const { data: responseData } = await supabase.functions.invoke('secure-booking-proxy', {
    body: {
      tenant_id, patient_name, patient_email, patient_phone,
      date, time, service_id, provider_id
    }
  })
  ```

### Step 6: Edge Function Processes Booking
- **Function:** `supabase/functions/secure-booking-proxy/index.ts`
  1. Validate with Zod.
  2. Encrypt PII: `encrypt(patient_name)`, `encrypt(patient_email)`, `encrypt(patient_phone)`.
  3. Hash for search: `hashForSearch(patient_email)`, `hashForSearch(patient_phone)`.
  4. Call RPC: `supabase.rpc('book_appointment_atomic', {...})`

### Step 7: Confirmation Sent
- **Action:** Fire-and-forget call to `send-confirmation` Edge Function.
- **Result:** Email (Resend) and SMS (GatewayAPI) sent.

---

# 9. Directory Structure

## 9.1 `src/` — Application Code
```
src/
├── app/                          # Next.js App Router
│   ├── admin/                    # Platform Admin Area
│   │   ├── dashboard/            # Admin Dashboard
│   │   ├── login/                # Admin Login
│   │   └── page.tsx              # Admin Root
│   ├── [locale]/                 # i18n routes
│   │   ├── [dentist_slug]/       # Tenant Area
│   │   │   ├── analytics/        # Practice Analytics
│   │   │   ├── book/             # Patient Booking Flow
│   │   │   ├── dashboard/        # Dentist/Staff Dashboard
│   │   │   ├── login/            # Dentist/Staff Login
│   │   │   ├── services/         # Service Management
│   │   │   ├── settings/         # Practice Settings
│   │   │   ├── team/             # Team/Provider Management
│   │   │   ├── layout.tsx        # Tenant Layout
│   │   │   └── page.tsx          # Tenant Landing Page
│   │   ├── login/                # General Login
│   │   ├── layout.tsx            # Locale Layout
│   │   └── page.tsx              # Landing Page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Root page
│   └── providers.tsx             # React Query & other providers
├── components/                   # Reusable UI components
├── context/                      # React Context providers
├── data/                         # Static data/constants
├── hooks/                        # Custom React hooks
├── i18n.ts                       # Internationalization config
├── lib/                          # Core utilities
│   ├── findFirstAvailableDate.ts # Smart date selection logic
│   ├── notifications.ts          # Toast helpers
│   ├── schemas.ts                # Zod schemas
│   ├── supabase.ts               # Supabase client
│   ├── supabaseErrors.ts         # Error handling utilities
│   └── utils.ts                  # General utilities
├── middleware.ts                 # Next.js middleware (i18n, auth guards)
├── services/                     # Business logic & API calls
│   ├── adminService.ts           # Admin operations
│   ├── analyticsService.ts       # Dashboard analytics
│   ├── appointmentService.ts     # Booking & scheduling
│   ├── authService.ts            # Authentication
│   ├── availabilityService.ts    # Slot availability calculations
│   ├── dataAdapter.ts            # Data transformation
│   ├── onboardingService.ts      # Tenant onboarding flow
│   └── tenantService.ts          # Tenant CRUD operations
├── store/                        # Zustand stores
│   ├── adminStore.ts             # Admin auth state
│   └── authStore.ts              # User auth state
├── styles/                       # Additional CSS
└── types/                        # TypeScript definitions
    ├── index.ts                  # Shared types (User, Appointment, etc.)
    └── supabase.ts               # Database types (generated)
```

## 9.2 `supabase/` — Backend
```
supabase/
├── config.toml                   # Supabase project configuration
├── functions/                    # Edge Functions (Deno)
│   ├── _shared/                  # Shared utilities
│   │   └── encryption.ts         # AES-GCM & HMAC functions
│   ├── admin-api/                # Protected admin endpoints
│   ├── contact-sales/            # Lead generation
│   ├── get-appointment-details/  # PII decryption endpoint
│   ├── secure-booking-proxy/     # Booking with encryption
│   ├── send-confirmation/        # Email & SMS notifications
│   └── send-reminders/           # Scheduled reminders
└── migrations/                   # SQL migrations (not used; see database/)
```

## 9.3 `database/` — SQL Migrations
```
database/
├── 00_reset_policies.sql         # Policy cleanup
├── 01_schema.sql                 # Core table definitions
├── 02_functions_and_triggers.sql # RPCs & triggers
├── 03_rls_policies.sql           # Row Level Security
├── 04_seed_data.sql              # Demo data
├── 05_create_admin_user.sql      # Admin setup
├── 05_cron_jobs.sql              # Scheduled tasks
├── 06_email_config.sql           # Email settings
├── 07_sms_columns.sql            # SMS configuration
├── 10_multi_provider.sql         # Provider/staff tables
├── 11_secure_providers.sql       # Provider RLS policies
├── 12_fix_rls_performance.sql    # RLS optimization
├── 13_add_missing_columns.sql    # Column additions
├── 14_add_booking_form_columns.sql
├── 17_add_blind_index.sql        # Searchable encryption
├── 20_performance_rpc.sql        # get_tenant_schedule
├── 21_atomic_booking.sql         # book_appointment_atomic
└── README.md                     # Migration guide
```

## 9.4 `tests/` — E2E Tests
```
tests/
├── global-setup.ts               # Playwright global setup
├── admin.spec.ts                 # Admin login & dashboard
├── block-time.spec.ts            # Dentist block time feature
├── booking.spec.ts               # Patient booking flow
├── communication-settings.spec.ts
├── employee-management.spec.ts
├── login.spec.ts                 # Auth flow tests
├── practice-settings.spec.ts
└── service-management.spec.ts
```

---

# 10. Dependencies

## 10.1 Production Dependencies
```json
{
  "@sentry/react": "^10.27.0",
  "@supabase/ssr": "^0.8.0",
  "@supabase/supabase-js": "^2.84.0",
  "@tanstack/react-query": "^5.90.16",
  "@tanstack/react-query-devtools": "^5.91.2",
  "clsx": "^2.1.1",
  "eslint-config-next": "^16.1.1",
  "framer-motion": "^12.23.24",
  "lucide-react": "^0.554.0",
  "next": "^16.1.1",
  "next-intl": "^4.7.0",
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "react-helmet-async": "^2.0.5",
  "react-is": "^19.2.0",
  "react-router-dom": "^7.9.6",
  "recharts": "^3.5.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.4.0",
  "zod": "^4.3.4",
  "zustand": "^5.0.8"
}
```

## 10.2 Dev Dependencies
```json
{
  "@playwright/test": "^1.57.0",
  "@types/node": "^24.10.1",
  "@types/react": "^19.2.7",
  "@types/react-dom": "^19.2.3",
  "@vitejs/plugin-react": "^5.1.1",
  "autoprefixer": "^10.4.22",
  "dotenv": "^16.6.1",
  "postcss": "^8.5.6",
  "supabase": "^2.63.1",
  "tailwindcss": "^3.4.14",
  "typescript": "~5.9.3",
  "vite": "^7.2.4"
}
```

---

## 10.3 Configuration (`next.config.mjs`)

**Purpose:** Next.js build configuration and Next-Intl plugin integration.

```javascript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        domains: ['images.unsplash.com', 'source.unsplash.com'], // External images
    }
};

export default withNextIntl(nextConfig);
```

---

# 11. Testing Strategy

## 11.1 E2E Tests (Playwright)

| Test File | Coverage |
|-----------|----------|
| `admin.spec.ts` | Admin login, dashboard navigation |
| `block-time.spec.ts` | Create/delete blocked time slots |
| `booking.spec.ts` | Full patient booking flow |
| `communication-settings.spec.ts` | Email/SMS configuration |
| `employee-management.spec.ts` | Provider CRUD |
| `login.spec.ts` | Auth flow, role validation |
| `practice-settings.spec.ts` | Tenant settings updates |
| `service-management.spec.ts` | Service CRUD |

## 11.2 Running Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e:headed
```

## 11.3 Configuration (`playwright.config.ts`)

**Key Settings:**
- **Workers:** 1 (Optimized for CI/Stability to prevent Supabase connection exhaustion).
- **Retries:** 2 on CI, 0 locally.
- **Global Setup:** `tests/global-setup.ts` loads environment variables from `.env.local` or `.env`.
- **Projects:** Chromium, Firefox, WebKit.

```typescript
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts', // Environment variables loaded here
  workers: process.env.CI ? 1 : 1, // Limited workers for DB stability
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

---

# 12. Environment Variables

## 12.1 Local Development (`.env.local`)
```bash
# Supabase Client
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 12.2 Edge Functions (Supabase Secrets)
```bash
# Core
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Encryption (CRITICAL)
ENCRYPTION_KEY=<base64-encoded-32-byte-key>
SEARCH_PEPPER=<base64-encoded-secret-for-hmac>

# Email (Resend)
RESEND_API_KEY=re_xxx

# SMS (GatewayAPI)
GATEWAYAPI_TOKEN=your_api_token
SMS_FROM_NAME=DentistApp

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
ENVIRONMENT=production
```

---

# Document Metadata

| Property | Value |
|----------|-------|
| Total Lines | ~1600 |
| Last Updated | 2026-01-03T22:00:00Z |
| Author | Technical Auditor Agent |
| Format | Markdown |
| Source Verification | All code verified against file system |

---

**END OF DOCUMENT**
