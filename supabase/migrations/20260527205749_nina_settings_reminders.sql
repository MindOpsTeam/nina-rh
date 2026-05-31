-- F6a: configurações de lembretes em nina_settings
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS reminder_lead_hours INT NOT NULL DEFAULT 24;
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS reminder_dispatch_hour INT NOT NULL DEFAULT 18;
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS reminder_d0_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.nina_settings ADD COLUMN IF NOT EXISTS reminder_d0_hour INT NOT NULL DEFAULT 8;
