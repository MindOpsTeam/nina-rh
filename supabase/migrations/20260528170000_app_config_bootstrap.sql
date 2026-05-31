-- Auto-config zero-secret: store de configuração de ambiente populado no onboarding
-- pela Edge Function initialize-system, e lido pelos crons (DB→Edge) sem GUCs manuais.
-- Substitui a necessidade de setar app.edge_function_base_url / app.service_role_key
-- via ALTER DATABASE (que ninguém com Lovable Cloud consegue fazer).

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sem RLS habilitado + sem grants a anon/authenticated → só service_role/postgres acessam.
REVOKE ALL ON private.app_config FROM anon, authenticated;

-- Helper SECURITY DEFINER pros crons lerem (roda como owner, retorna value).
-- Retorna service_role_key → defesa-em-profundidade: REVOKE de PUBLIC, só service_role.
CREATE OR REPLACE FUNCTION private.get_app_config(p_key TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT value FROM private.app_config WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION private.get_app_config(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_app_config(TEXT) TO service_role;

-- RPC público SECURITY DEFINER pro initialize-system gravar via supabase-js (schema public).
-- supabase-js acessa schema public por default; a tabela fica em private (trancada).
-- search_path = private: corpo é schema-qualificado, não precisa de public.
CREATE OR REPLACE FUNCTION public.set_app_config(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = private
AS $$
  INSERT INTO private.app_config(key, value) VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.set_app_config(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_config(TEXT, TEXT) TO service_role;
