-- F6a: preferências de lembrete por contato (candidato)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS reminder_quiet_hours_start TIME DEFAULT '22:00';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS reminder_quiet_hours_end TIME DEFAULT '08:00';
