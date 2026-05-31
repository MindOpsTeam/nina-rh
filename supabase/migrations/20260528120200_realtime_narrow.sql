-- FIX-E [efficiency] Narrow do supabase_realtime publication.
-- Tabelas low-churn/seed que NÃO são observadas via .channel() no frontend
-- não precisam de replicação realtime.
--
-- Verificado por grep .channel()/.on('postgres_changes') em src/:
--   REMOVIDAS (sem observador): vacancies, vacancy_interests, specialties_rh, message_templates
--   MANTIDA: resumes → ResumeBlock observa parse_status (pending→parsed) em tempo real
--   MANTIDAS (observadas): messages, conversations, contacts, appointments, deals,
--                          pipeline_stages, team_members (+ teams/team_functions via modais)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vacancies') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.vacancies;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vacancy_interests') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.vacancy_interests;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='specialties_rh') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.specialties_rh;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='message_templates') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.message_templates;
  END IF;
END $$;
