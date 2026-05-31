-- F10a: hardening de message_templates pra integração Meta.
-- Colunas meta_* já existem desde F6 (commit do create_message_templates).
-- Aqui adicionamos CHECK defensivo + índices.

ALTER TABLE public.message_templates DROP CONSTRAINT IF EXISTS message_templates_meta_status_check;
ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_meta_status_check
  CHECK (meta_status IS NULL OR meta_status IN ('pending','approved','rejected','disabled'));

CREATE INDEX IF NOT EXISTS idx_message_templates_meta_status ON public.message_templates(meta_status);
CREATE INDEX IF NOT EXISTS idx_message_templates_meta_template_id ON public.message_templates(meta_template_id);
