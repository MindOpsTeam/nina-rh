-- F5a: catálogo de áreas de atuação RH (seeds globais + custom por owner)

CREATE TABLE IF NOT EXISTS public.specialties_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_seed BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialties_rh_category ON public.specialties_rh(category);
CREATE INDEX IF NOT EXISTS idx_specialties_rh_slug ON public.specialties_rh(slug);
CREATE INDEX IF NOT EXISTS idx_specialties_rh_user_id ON public.specialties_rh(user_id);

ALTER TABLE public.specialties_rh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specialties_rh_select_seed_or_owner" ON public.specialties_rh
  FOR SELECT USING (is_seed = true OR user_id = auth.uid());

CREATE POLICY "specialties_rh_insert_owner_custom" ON public.specialties_rh
  FOR INSERT WITH CHECK (is_seed = false AND user_id = auth.uid());

CREATE POLICY "specialties_rh_update_owner" ON public.specialties_rh
  FOR UPDATE USING (is_seed = false AND user_id = auth.uid())
  WITH CHECK (is_seed = false AND user_id = auth.uid());

CREATE POLICY "specialties_rh_delete_owner" ON public.specialties_rh
  FOR DELETE USING (is_seed = false AND user_id = auth.uid());

INSERT INTO public.specialties_rh (slug, name, category, is_seed) VALUES
  -- Tecnologia
  ('frontend',            'Frontend (React/Vue/Angular)',     'tecnologia', true),
  ('backend',             'Backend (Node/Python/Java)',       'tecnologia', true),
  ('fullstack',           'Full-Stack',                       'tecnologia', true),
  ('mobile',              'Mobile (iOS/Android/React Native)','tecnologia', true),
  ('data_eng',            'Data Engineering',                 'tecnologia', true),
  ('data_science',        'Data Science / ML',                'tecnologia', true),
  ('devops',              'DevOps / SRE',                     'tecnologia', true),
  ('qa',                  'QA / Testes',                      'tecnologia', true),
  ('seguranca',           'Segurança da Informação',          'tecnologia', true),
  ('produto',             'Product Manager',                  'tecnologia', true),
  ('ux_ui',               'UX/UI Design',                     'tecnologia', true),
  -- Comercial
  ('vendas_b2b',          'Vendas B2B / SDR',                 'comercial',  true),
  ('vendas_varejo',       'Vendas Varejo',                    'comercial',  true),
  ('account_manager',     'Account Manager / CS',             'comercial',  true),
  -- Marketing
  ('marketing_digital',   'Marketing Digital',                'marketing',  true),
  ('conteudo',            'Conteúdo / Copywriting',           'marketing',  true),
  ('performance',         'Performance / Mídia Paga',         'marketing',  true),
  -- Financeiro
  ('contabilidade',       'Contabilidade',                    'financeiro', true),
  ('controladoria',       'Controladoria / FP&A',             'financeiro', true),
  -- RH
  ('recrutamento',        'Recrutamento e Seleção',           'rh',         true),
  ('rh_business_partner', 'Business Partner',                 'rh',         true),
  ('departamento_pessoal','Departamento Pessoal',             'rh',         true),
  -- Operações
  ('logistica',           'Logística / Supply',               'operacoes',  true),
  ('atendimento',         'Atendimento ao Cliente',           'operacoes',  true),
  -- Jurídico
  ('juridico_civel',      'Jurídico Cível',                   'juridico',   true)
ON CONFLICT (slug) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.specialties_rh;
