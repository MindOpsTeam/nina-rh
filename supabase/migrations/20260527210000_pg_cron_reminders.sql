-- F6b: cron jobs (hourly) que disparam o appointment-reminder-dispatcher.
-- Requer pg_cron + pg_net + dois settings de banco (setados pelo Maestro pós-merge):
--   ALTER DATABASE postgres SET app.edge_function_base_url = 'https://<project>.functions.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper RPC: lock per-appointment durante a transação atual (usado pelo dispatcher
-- pra evitar dispatch duplicado em concorrência). Retorna true se adquiriu.
CREATE OR REPLACE FUNCTION public.nina_try_lock_appointment(p_appointment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext(p_appointment_id::text)::bigint);
$$;

REVOKE ALL ON FUNCTION public.nina_try_lock_appointment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nina_try_lock_appointment(UUID) TO service_role, authenticated;

-- Desschedula jobs anteriores se existirem (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder-dispatcher-d1') THEN
    PERFORM cron.unschedule('reminder-dispatcher-d1');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder-dispatcher-d0') THEN
    PERFORM cron.unschedule('reminder-dispatcher-d0');
  END IF;
END $$;

-- D-1: a cada hora cheia
SELECT cron.schedule(
  'reminder-dispatcher-d1',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url', true) || '/appointment-reminder-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object('action', 'dispatch_d1')
  );
  $cron$
);

-- D-0: a cada hora cheia (com offset opcional, mas dispatcher já filtra por reminder_d0_hour)
SELECT cron.schedule(
  'reminder-dispatcher-d0',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url', true) || '/appointment-reminder-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object('action', 'dispatch_d0')
  );
  $cron$
);
