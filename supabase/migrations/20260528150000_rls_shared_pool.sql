-- fix(rls): SHARED POOL model — reverte o owner-scoping (user_id = auth.uid())
-- aplicado em F3-F10.5 + PR #13.
--
-- MODELO REAL: cada empresa faz remix isolado do Lovable → banco Supabase próprio.
-- Dentro de cada empresa, VÁRIOS recrutadores logam e COMPARTILHAM o mesmo pool
-- de vagas/candidatos/entrevistas. Owner-scope quebrava a colaboração (recrutador B
-- não via dados criados por recrutador A).
--
-- SEGURO porque o isolamento é por BANCO (remix), não por linha. Authenticated = funcionário
-- daquela empresa → pode ver tudo do pool. user_id permanece nas colunas pra rastrear o criador.

-- =====================================================================
-- GRUPO A — dados compartilhados: authenticated acessa tudo (ALL)
-- =====================================================================

-- contacts
DROP POLICY IF EXISTS "contacts_owner_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_owner_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_owner_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_owner_delete" ON public.contacts;
CREATE POLICY "contacts_authenticated_all" ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- conversations
DROP POLICY IF EXISTS "conversations_owner_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_owner_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_owner_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_owner_delete" ON public.conversations;
CREATE POLICY "conversations_authenticated_all" ON public.conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- deals
DROP POLICY IF EXISTS "deals_owner_select" ON public.deals;
DROP POLICY IF EXISTS "deals_owner_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_owner_update" ON public.deals;
DROP POLICY IF EXISTS "deals_owner_delete" ON public.deals;
CREATE POLICY "deals_authenticated_all" ON public.deals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- appointments
DROP POLICY IF EXISTS "appointments_owner_select" ON public.appointments;
DROP POLICY IF EXISTS "appointments_owner_insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments_owner_update" ON public.appointments;
DROP POLICY IF EXISTS "appointments_owner_delete" ON public.appointments;
CREATE POLICY "appointments_authenticated_all" ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- messages
DROP POLICY IF EXISTS "messages_owner_select" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_update" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_delete" ON public.messages;
CREATE POLICY "messages_authenticated_all" ON public.messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- send_queue
DROP POLICY IF EXISTS "send_queue_owner_select" ON public.send_queue;
DROP POLICY IF EXISTS "send_queue_owner_insert" ON public.send_queue;
DROP POLICY IF EXISTS "send_queue_owner_update" ON public.send_queue;
DROP POLICY IF EXISTS "send_queue_owner_delete" ON public.send_queue;
CREATE POLICY "send_queue_authenticated_all" ON public.send_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vacancies
DROP POLICY IF EXISTS "vacancies_owner_select" ON public.vacancies;
DROP POLICY IF EXISTS "vacancies_owner_insert" ON public.vacancies;
DROP POLICY IF EXISTS "vacancies_owner_update" ON public.vacancies;
DROP POLICY IF EXISTS "vacancies_owner_delete" ON public.vacancies;
CREATE POLICY "vacancies_authenticated_all" ON public.vacancies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vacancy_interests
DROP POLICY IF EXISTS "vacancy_interests_owner_select" ON public.vacancy_interests;
DROP POLICY IF EXISTS "vacancy_interests_owner_insert" ON public.vacancy_interests;
DROP POLICY IF EXISTS "vacancy_interests_owner_update" ON public.vacancy_interests;
DROP POLICY IF EXISTS "vacancy_interests_owner_delete" ON public.vacancy_interests;
CREATE POLICY "vacancy_interests_authenticated_all" ON public.vacancy_interests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- resumes
DROP POLICY IF EXISTS "resumes_owner_select" ON public.resumes;
DROP POLICY IF EXISTS "resumes_owner_insert" ON public.resumes;
DROP POLICY IF EXISTS "resumes_owner_update" ON public.resumes;
DROP POLICY IF EXISTS "resumes_owner_delete" ON public.resumes;
CREATE POLICY "resumes_authenticated_all" ON public.resumes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- GRUPO B — seeds globais: SELECT tudo; write só em custom (is_seed = false)
-- =====================================================================

-- specialties_rh
DROP POLICY IF EXISTS "specialties_rh_select_seed_or_owner" ON public.specialties_rh;
DROP POLICY IF EXISTS "specialties_rh_insert_owner_custom" ON public.specialties_rh;
DROP POLICY IF EXISTS "specialties_rh_update_owner" ON public.specialties_rh;
DROP POLICY IF EXISTS "specialties_rh_delete_owner" ON public.specialties_rh;
CREATE POLICY "specialties_rh_select_all" ON public.specialties_rh
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "specialties_rh_insert_custom" ON public.specialties_rh
  FOR INSERT TO authenticated WITH CHECK (is_seed = false);
CREATE POLICY "specialties_rh_update_custom" ON public.specialties_rh
  FOR UPDATE TO authenticated USING (is_seed = false) WITH CHECK (is_seed = false);
CREATE POLICY "specialties_rh_delete_custom" ON public.specialties_rh
  FOR DELETE TO authenticated USING (is_seed = false);

-- message_templates
DROP POLICY IF EXISTS "message_templates_select_seed_or_owner" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_insert_owner" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_update_owner" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_delete_owner" ON public.message_templates;
CREATE POLICY "message_templates_select_all" ON public.message_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "message_templates_insert_custom" ON public.message_templates
  FOR INSERT TO authenticated WITH CHECK (is_seed = false);
CREATE POLICY "message_templates_update_custom" ON public.message_templates
  FOR UPDATE TO authenticated USING (is_seed = false) WITH CHECK (is_seed = false);
CREATE POLICY "message_templates_delete_custom" ON public.message_templates
  FOR DELETE TO authenticated USING (is_seed = false);

-- =====================================================================
-- GRUPO C — Storage bucket 'resumes': authenticated acessa o bucket inteiro
-- (path-prefix por auth.uid() impedia recrutador B baixar CV recebido por A)
-- =====================================================================
DROP POLICY IF EXISTS "resumes_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_delete" ON storage.objects;
CREATE POLICY "resumes_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'resumes');
CREATE POLICY "resumes_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "resumes_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'resumes');

-- GRUPO D — team_members: NÃO TOCADO. Policies atuais ("Authenticated can read" +
-- "Admins can modify" via has_role) são do template e NÃO são owner-scoped.
-- Fora do escopo deste revert (que trata só owner-scope → shared pool).
