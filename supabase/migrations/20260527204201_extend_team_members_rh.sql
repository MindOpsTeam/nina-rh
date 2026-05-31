-- F5a: estende team_members com campos RH (recrutadores)

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS modalidade_operacao TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS registro_profissional TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS specialty_slugs TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS tipos_contratacao TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS unavailable_slots JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS vacancy_ids UUID[] DEFAULT '{}'::UUID[];

ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_modalidade_operacao_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_modalidade_operacao_check
  CHECK (modalidade_operacao IS NULL OR modalidade_operacao IN ('rh_interno','agencia','freelancer'));

CREATE INDEX IF NOT EXISTS idx_team_members_specialty_slugs ON public.team_members USING GIN(specialty_slugs);
CREATE INDEX IF NOT EXISTS idx_team_members_vacancy_ids ON public.team_members USING GIN(vacancy_ids);
CREATE INDEX IF NOT EXISTS idx_team_members_modalidade_operacao ON public.team_members(modalidade_operacao);
