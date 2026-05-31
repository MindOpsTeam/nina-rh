-- P0-2 [SHIP-BLOCKER] Tenant isolation nas tabelas BASE do template legado.
-- Antes: policies permissivas (auth.role() = 'authenticated' ou USING true) →
-- qualquer tenant autenticado lia/escrevia dados de qualquer outro.
-- Agora: owner-scoped por user_id (direto) ou via conversation_id (subquery).
--
-- Edge Functions usam SUPABASE_SERVICE_ROLE_KEY (bypassa RLS) → não quebram.
-- Frontend usa JWT autenticado → passa a ver só os próprios dados.
--
-- Ownership confirmada por inspeção:
--   contacts, conversations, deals, appointments → coluna user_id direta
--   messages, send_queue → SEM user_id; scoping via conversations.user_id (conversation_id)

-- ========================= contacts =========================
DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all operations on contacts" ON public.contacts;

CREATE POLICY "contacts_owner_select" ON public.contacts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contacts_owner_insert" ON public.contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "contacts_owner_update" ON public.contacts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "contacts_owner_delete" ON public.contacts
  FOR DELETE USING (user_id = auth.uid());

-- ========================= conversations =========================
DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow all operations on conversations" ON public.conversations;

CREATE POLICY "conversations_owner_select" ON public.conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "conversations_owner_insert" ON public.conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "conversations_owner_update" ON public.conversations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "conversations_owner_delete" ON public.conversations
  FOR DELETE USING (user_id = auth.uid());

-- ========================= deals =========================
DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
DROP POLICY IF EXISTS "Allow all operations on deals" ON public.deals;

CREATE POLICY "deals_owner_select" ON public.deals
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "deals_owner_insert" ON public.deals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deals_owner_update" ON public.deals
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "deals_owner_delete" ON public.deals
  FOR DELETE USING (user_id = auth.uid());

-- ========================= appointments =========================
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow all operations on appointments" ON public.appointments;

CREATE POLICY "appointments_owner_select" ON public.appointments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "appointments_owner_insert" ON public.appointments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "appointments_owner_update" ON public.appointments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "appointments_owner_delete" ON public.appointments
  FOR DELETE USING (user_id = auth.uid());

-- ========================= messages (sem user_id → via conversation) =========================
DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can access messages of their conversations" ON public.messages;
DROP POLICY IF EXISTS "Allow all operations on messages" ON public.messages;

CREATE POLICY "messages_owner_select" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "messages_owner_insert" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "messages_owner_update" ON public.messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "messages_owner_delete" ON public.messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );

-- ========================= send_queue (sem user_id → via conversation) =========================
DROP POLICY IF EXISTS "Authenticated access send_queue" ON public.send_queue;
DROP POLICY IF EXISTS "Allow all operations on send_queue" ON public.send_queue;

CREATE POLICY "send_queue_owner_select" ON public.send_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "send_queue_owner_insert" ON public.send_queue
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "send_queue_owner_update" ON public.send_queue
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "send_queue_owner_delete" ON public.send_queue
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid())
  );
