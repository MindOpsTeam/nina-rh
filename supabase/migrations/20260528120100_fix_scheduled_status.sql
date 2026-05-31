-- M2 [BLOCKER] Status 'scheduled' legacy órfão.
-- O dispatcher F6 dispara reminder pra status 'scheduled', mas o trigger Kanban F9
-- não mapeava 'scheduled' → deal travava em "Entrevista Agendada".
-- Fix: (1) backfill 'scheduled' → 'agendado'; (2) trigger trata 'scheduled' defensivamente.
-- 'scheduled' permanece no CHECK constraint (compat com rows/integrações legadas).

-- 1) Backfill
UPDATE public.appointments SET status = 'agendado' WHERE status = 'scheduled';

-- 2) Trigger defensivo (adiciona 'scheduled' ao mapeamento "entrevista agendada")
CREATE OR REPLACE FUNCTION public.sync_deal_stage_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deal_id UUID;
  v_current_stage_id UUID;
  v_current_stage_position INT;
  v_current_stage_is_system BOOLEAN;
  v_target_stage_id UUID;
  v_target_stage_position INT;
  v_target_title TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT c.user_id INTO v_user_id
  FROM public.contacts c
  WHERE c.id = NEW.contact_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.id, d.stage_id INTO v_deal_id, v_current_stage_id
  FROM public.deals d
  WHERE d.contact_id = NEW.contact_id
    AND (d.user_id = v_user_id OR d.user_id IS NULL)
  ORDER BY d.created_at DESC
  LIMIT 1;
  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ps.position, COALESCE(ps.is_system, false)
  INTO v_current_stage_position, v_current_stage_is_system
  FROM public.pipeline_stages ps
  WHERE ps.id = v_current_stage_id;

  IF v_current_stage_is_system = true THEN
    RETURN NEW;
  END IF;

  -- Mapear status → título do stage destino
  -- ('scheduled' legado tratado como 'agendado' — defensivo)
  IF NEW.status = 'compareceu' THEN
    v_target_title := 'entrevistado';
  ELSIF NEW.status IN ('agendado', 'confirmado', 'agendamento_pendente', 'scheduled') THEN
    v_target_title := 'entrevista agendada';
  ELSE
    RETURN NEW;
  END IF;

  SELECT ps.id, ps.position INTO v_target_stage_id, v_target_stage_position
  FROM public.pipeline_stages ps
  WHERE lower(ps.title) = v_target_title
    AND (ps.user_id = v_user_id OR ps.user_id IS NULL)
  ORDER BY (ps.user_id = v_user_id) DESC NULLS LAST
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_current_stage_position IS NOT NULL
     AND v_target_stage_position <= v_current_stage_position THEN
    RETURN NEW;
  END IF;

  UPDATE public.deals
  SET stage_id = v_target_stage_id, updated_at = now()
  WHERE id = v_deal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_stage_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_deal_stage_from_appointment
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_deal_stage_from_appointment();
