-- F6a: campos de tracking de lembretes em appointments
-- Schema do template: appointments.date DATE + appointments.time TIME (NÃO appointment_date/_time).
-- starts_at GENERATED ALWAYS AS STORED a partir de (date + time) em America/Sao_Paulo.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ
  GENERATED ALWAYS AS (((date + time) AT TIME ZONE 'America/Sao_Paulo')) STORED;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_d1_sent_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_d0_sent_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'agendamento_pendente',
    'agendado',
    'confirmado',
    'cancelado',
    'cancelado_para_remarcacao',
    'no_show',
    'compareceu',
    'remarcado',
    -- valores legados do template (mantidos pra não invalidar rows existentes)
    'scheduled'
  ));

CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON public.appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_d1 ON public.appointments(starts_at)
  WHERE reminder_d1_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_d0 ON public.appointments(starts_at)
  WHERE reminder_d0_sent_at IS NULL;
