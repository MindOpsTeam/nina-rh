-- Update default value for nina_settings
ALTER TABLE public.nina_settings ALTER COLUMN company_name SET DEFAULT 'Nina RH';
ALTER TABLE public.nina_settings ALTER COLUMN whatsapp_verify_token SET DEFAULT 'nina-rh-webhook';

-- Update existing settings
UPDATE public.nina_settings 
SET company_name = 'Nina RH' 
WHERE company_name = 'Viver de IA';

UPDATE public.nina_settings 
SET whatsapp_verify_token = 'nina-rh-webhook' 
WHERE whatsapp_verify_token = 'viver-de-ia-nina-webhook';