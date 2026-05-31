-- F5a: appointments.recruiter_id (FK explícita pra team_members)
-- attendees TEXT[] existente segue sendo usado pra outras pessoas convidadas;
-- recruiter_id passa a ser a referência canônica do recrutador titular da entrevista.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'professional_id'
  ) THEN
    ALTER TABLE public.appointments RENAME COLUMN professional_id TO recruiter_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'recruiter_id'
    ) THEN
      ALTER TABLE public.appointments
        ADD COLUMN recruiter_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_recruiter_id ON public.appointments(recruiter_id);
