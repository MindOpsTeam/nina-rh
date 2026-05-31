-- F10a: cron horário (minuto 15, offset dos reminders no minuto 0)
-- que dispara whatsapp-templates-sync action=sync-status.
-- Requer:
--   ALTER DATABASE postgres SET app.edge_function_base_url = 'https://<project>.functions.supabase.co';
--   ALTER DATABASE postgres SET app.cron_shared_secret    = '<CRON_SHARED_SECRET>';
-- (Maestro seta pós-merge.)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-templates-sync-hourly') THEN
    PERFORM cron.unschedule('whatsapp-templates-sync-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'whatsapp-templates-sync-hourly',
  '15 * * * *',
  $cron$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url', true) || '/whatsapp-templates-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_shared_secret', true)
    ),
    body := jsonb_build_object('action', 'sync-status')
  );
  $cron$
);
