-- Ensure Foreign Key relationship between appointments and patients
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_patient_id_fkey
FOREIGN KEY (patient_id)
REFERENCES public.patients(id)
ON DELETE SET NULL; -- Or CASCADE, depending on preference. Soft delete prefers SET NULL or NO ACTION usually.

-- Refresh schema cache happens automatically on DDL, but sometimes needs a nudge.
NOTIFY pgrst, 'reload schema';
