-- F10.5: tabela resumes + bucket Storage 'resumes' + RLS owner-scoped.
-- Currículos enviados pelo candidato via link signed; parse_status evolui pendente→parsing→parsed/failed.

CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  vacancy_id UUID REFERENCES public.vacancies(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,                 -- caminho no Storage (bucket 'resumes')
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  parsed_data JSONB DEFAULT '{}'::JSONB,   -- estrutura extraída pelo parse-resume
  parse_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending','parsing','parsed','failed')),
  parse_error TEXT,
  score_meta JSONB,                        -- score 0-100 + breakdown (futuro P1)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_contact_id ON public.resumes(contact_id);
CREATE INDEX IF NOT EXISTS idx_resumes_vacancy_id ON public.resumes(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_resumes_parse_status ON public.resumes(parse_status);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resumes_owner_select" ON public.resumes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "resumes_owner_insert" ON public.resumes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "resumes_owner_update" ON public.resumes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "resumes_owner_delete" ON public.resumes
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.resumes;
