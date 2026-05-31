-- F5a: flag de auto-agendamento (default OFF — humano confirma horário em F6)
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS autoschedule_enabled BOOLEAN NOT NULL DEFAULT false;
