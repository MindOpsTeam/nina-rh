-- F6a: catálogo de templates Meta HSM (seeds globais + custom por owner)

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'UTILITY',
  language TEXT NOT NULL DEFAULT 'pt_BR',
  body TEXT NOT NULL,
  variables_count INT NOT NULL DEFAULT 0,
  is_seed BOOLEAN NOT NULL DEFAULT false,
  meta_template_id TEXT,
  meta_status TEXT,
  meta_status_synced_at TIMESTAMPTZ,
  meta_rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON public.message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_name ON public.message_templates(name);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_templates_select_seed_or_owner" ON public.message_templates
  FOR SELECT USING (is_seed = true OR user_id = auth.uid());

CREATE POLICY "message_templates_insert_owner" ON public.message_templates
  FOR INSERT WITH CHECK (is_seed = false AND user_id = auth.uid());

CREATE POLICY "message_templates_update_owner" ON public.message_templates
  FOR UPDATE USING (is_seed = false AND user_id = auth.uid())
  WITH CHECK (is_seed = false AND user_id = auth.uid());

CREATE POLICY "message_templates_delete_owner" ON public.message_templates
  FOR DELETE USING (is_seed = false AND user_id = auth.uid());

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds: 2 templates RH (interview reminder D-1 + D-0)
INSERT INTO public.message_templates (name, category, language, body, variables_count, is_seed) VALUES
  ('interview_reminder_d1', 'UTILITY', 'pt_BR',
   'Olá {{1}}! Lembrete: sua pré-entrevista para a vaga de {{2}} está agendada para amanhã, {{3}} às {{4}}. Responda 1 para confirmar, 2 para remarcar, ou 3 para cancelar.',
   4, true),
  ('interview_reminder_d0', 'UTILITY', 'pt_BR',
   'Bom dia {{1}}! Sua pré-entrevista para a vaga de {{2}} é hoje às {{3}}. Confirma presença? Responda 1=sim, 2=remarcar, 3=cancelar.',
   3, true)
ON CONFLICT DO NOTHING;
