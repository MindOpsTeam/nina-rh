-- F3a: Cria vacancy_interests (manifestações de interesse de candidato em vaga,
-- sem agendamento). Owner-scoped por user_id.

CREATE TABLE IF NOT EXISTS public.vacancy_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  motivo_parqueio TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, vacancy_id)
);

CREATE INDEX IF NOT EXISTS idx_vacancy_interests_user_id ON public.vacancy_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_interests_contact_id ON public.vacancy_interests(contact_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_interests_vacancy_id ON public.vacancy_interests(vacancy_id);

ALTER TABLE public.vacancy_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vacancy_interests_owner_select" ON public.vacancy_interests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vacancy_interests_owner_insert" ON public.vacancy_interests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vacancy_interests_owner_update" ON public.vacancy_interests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "vacancy_interests_owner_delete" ON public.vacancy_interests
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_vacancy_interests_updated_at
  BEFORE UPDATE ON public.vacancy_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.vacancy_interests;
