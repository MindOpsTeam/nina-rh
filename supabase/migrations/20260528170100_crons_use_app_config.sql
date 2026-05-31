-- Auto-config zero-secret: re-agenda os crons (DB→Edge) lendo credenciais de
-- private.app_config (populado pela initialize-system no onboarding) em vez de
-- GUCs app.* setados via ALTER DATABASE. Guard WHERE ... IS NOT NULL evita erro
-- quando ainda não houve signup (app_config vazio).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Desschedula os jobs antigos (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder-dispatcher-d1') THEN
    PERFORM cron.unschedule('reminder-dispatcher-d1');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder-dispatcher-d0') THEN
    PERFORM cron.unschedule('reminder-dispatcher-d0');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-templates-sync-hourly') THEN
    PERFORM cron.unschedule('whatsapp-templates-sync-hourly');
  END IF;
END $$;

-- D-1: a cada hora cheia
SELECT cron.schedule(
  'reminder-dispatcher-d1',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := private.get_app_config('edge_base_url') || '/appointment-reminder-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_app_config('service_role_key')
    ),
    body := jsonb_build_object('action', 'dispatch_d1')
  )
  WHERE private.get_app_config('edge_base_url') IS NOT NULL
    AND private.get_app_config('service_role_key') IS NOT NULL;
  $cron$
);

-- D-0: a cada hora cheia (dispatcher filtra por reminder_d0_hour)
SELECT cron.schedule(
  'reminder-dispatcher-d0',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := private.get_app_config('edge_base_url') || '/appointment-reminder-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_app_config('service_role_key')
    ),
    body := jsonb_build_object('action', 'dispatch_d0')
  )
  WHERE private.get_app_config('edge_base_url') IS NOT NULL
    AND private.get_app_config('service_role_key') IS NOT NULL;
  $cron$
);

-- whatsapp-templates-sync: minuto 15. Agora autentica via Bearer service_role
-- (elimina x-cron-secret / app.cron_shared_secret).
SELECT cron.schedule(
  'whatsapp-templates-sync-hourly',
  '15 * * * *',
  $cron$
  SELECT net.http_post(
    url := private.get_app_config('edge_base_url') || '/whatsapp-templates-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_app_config('service_role_key')
    ),
    body := jsonb_build_object('action', 'sync-status')
  )
  WHERE private.get_app_config('edge_base_url') IS NOT NULL
    AND private.get_app_config('service_role_key') IS NOT NULL;
  $cron$
);
