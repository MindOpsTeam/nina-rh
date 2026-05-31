-- F6a: RPCs SECURITY DEFINER usadas pelas tools confirm/cancel/reschedule
-- do nina-orchestrator. Cada RPC atualiza o PRÓXIMO appointment futuro do contato.

CREATE OR REPLACE FUNCTION public.nina_confirm_next_appointment(p_contact_id UUID)
RETURNS TABLE(id UUID, starts_at TIMESTAMPTZ, status TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH next_apt AS (
    SELECT a.id
    FROM public.appointments a
    WHERE a.contact_id = p_contact_id
      AND a.status IN ('agendado','agendamento_pendente','scheduled')
      AND a.starts_at > now()
    ORDER BY a.starts_at ASC
    LIMIT 1
  )
  UPDATE public.appointments
  SET status = 'confirmado', confirmed_at = now()
  WHERE id = (SELECT id FROM next_apt)
  RETURNING id, starts_at, status;
$$;

CREATE OR REPLACE FUNCTION public.nina_cancel_next_appointment(p_contact_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, status TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH next_apt AS (
    SELECT a.id
    FROM public.appointments a
    WHERE a.contact_id = p_contact_id
      AND a.status IN ('agendado','agendamento_pendente','confirmado','scheduled')
      AND a.starts_at > now()
    ORDER BY a.starts_at ASC
    LIMIT 1
  )
  UPDATE public.appointments
  SET status = 'cancelado',
      cancelled_at = now(),
      cancellation_reason = p_reason
  WHERE id = (SELECT id FROM next_apt)
  RETURNING id, status;
$$;

CREATE OR REPLACE FUNCTION public.nina_request_reschedule(p_contact_id UUID)
RETURNS TABLE(id UUID, status TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH next_apt AS (
    SELECT a.id
    FROM public.appointments a
    WHERE a.contact_id = p_contact_id
      AND a.status IN ('agendado','agendamento_pendente','confirmado','scheduled')
      AND a.starts_at > now()
    ORDER BY a.starts_at ASC
    LIMIT 1
  )
  UPDATE public.appointments
  SET status = 'cancelado_para_remarcacao'
  WHERE id = (SELECT id FROM next_apt)
  RETURNING id, status;
$$;

REVOKE ALL ON FUNCTION public.nina_confirm_next_appointment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nina_cancel_next_appointment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nina_request_reschedule(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.nina_confirm_next_appointment(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.nina_cancel_next_appointment(UUID, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.nina_request_reschedule(UUID) TO service_role, authenticated;
