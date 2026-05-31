-- FIX-F [efficiency] Agenda o GC das filas processadas.
-- Funções cleanup_processed_queues() + cleanup_processed_message_queue() existem
-- desde o template mas nunca eram disparadas → send_queue/nina_processing_queue crescem indefinidamente.
-- Cron diário às 03:00 (UTC).

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-queues-daily') THEN
    PERFORM cron.unschedule('cleanup-queues-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-queues-daily',
  '0 3 * * *',
  $cron$
  SELECT public.cleanup_processed_queues();
  SELECT public.cleanup_processed_message_queue();
  $cron$
);
