-- F9: trigger Kanban auto-move
-- Move deal pelo pipeline quando appointment muda de status.
-- Regras:
--   compareceu                                     → "Entrevistado"
--   agendado / confirmado / agendamento_pendente   → "Entrevista Agendada"
--   cancelado / cancelado_para_remarcacao / no_show → não move (mantém posição atual)
--
-- Guards:
--   - No-rewind: só avança (target_position > current_position)
--   - System guard: se stage atual é is_system=true, não move
--   - Match de pipeline_stages por dono (deal.user_id) com fallback pra global (user_id IS NULL)

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
  -- Sem mudança de status → nada a fazer
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Owner do contato (fonte de verdade pra escopo)
  SELECT c.user_id INTO v_user_id
  FROM public.contacts c
  WHERE c.id = NEW.contact_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deal mais recente do contato (1 contato → vários deals possíveis)
  SELECT d.id, d.stage_id INTO v_deal_id, v_current_stage_id
  FROM public.deals d
  WHERE d.contact_id = NEW.contact_id
    AND (d.user_id = v_user_id OR d.user_id IS NULL)
  ORDER BY d.created_at DESC
  LIMIT 1;
  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Stage atual: position + is_system
  SELECT ps.position, COALESCE(ps.is_system, false)
  INTO v_current_stage_position, v_current_stage_is_system
  FROM public.pipeline_stages ps
  WHERE ps.id = v_current_stage_id;

  -- System guard
  IF v_current_stage_is_system = true THEN
    RETURN NEW;
  END IF;

  -- Mapear status → título do stage destino
  IF NEW.status = 'compareceu' THEN
    v_target_title := 'entrevistado';
  ELSIF NEW.status IN ('agendado', 'confirmado', 'agendamento_pendente') THEN
    v_target_title := 'entrevista agendada';
  ELSE
    RETURN NEW;
  END IF;

  -- Resolve stage destino preferindo o do owner, fallback pra global (user_id IS NULL)
  SELECT ps.id, ps.position INTO v_target_stage_id, v_target_stage_position
  FROM public.pipeline_stages ps
  WHERE lower(ps.title) = v_target_title
    AND (ps.user_id = v_user_id OR ps.user_id IS NULL)
  ORDER BY (ps.user_id = v_user_id) DESC NULLS LAST
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- No-rewind: só avança
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
