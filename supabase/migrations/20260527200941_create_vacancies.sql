-- F3a: Cria tabela vacancies (catálogo de vagas) com RLS owner-scoped
-- Observação: o template nina-rh NÃO tinha tabela `services` legada,
-- então criamos vacancies do zero (sem rename).

CREATE TABLE IF NOT EXISTS public.vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  area TEXT,
  senioridade TEXT,
  modalidade_contrato TEXT[] DEFAULT '{}'::TEXT[],
  regime_trabalho TEXT[] DEFAULT '{}'::TEXT[],
  faixa_salarial_min NUMERIC,
  faixa_salarial_max NUMERIC,
  descricao TEXT,
  requirements JSONB DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','pausada','fechada')),
  aceita_pcd BOOLEAN NOT NULL DEFAULT false,
  aceita_remoto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vacancies_user_id ON public.vacancies(user_id);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_area ON public.vacancies(area);

ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vacancies_owner_select" ON public.vacancies
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vacancies_owner_insert" ON public.vacancies
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vacancies_owner_update" ON public.vacancies
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "vacancies_owner_delete" ON public.vacancies
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_vacancies_updated_at
  BEFORE UPDATE ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.vacancies;
