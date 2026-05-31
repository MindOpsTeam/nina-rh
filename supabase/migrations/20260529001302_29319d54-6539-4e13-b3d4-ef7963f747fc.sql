
-- 1) Deal automático ao criar contato
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact
AFTER INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.create_deal_for_new_contact();

-- 2) Atualiza last_message_at da conversa e last_activity do contato
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- 3) Triggers updated_at
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'contacts',
    'conversations',
    'conversation_states',
    'nina_processing_queue',
    'message_processing_queue',
    'send_queue',
    'nina_settings',
    'tag_definitions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t, t
    );
  END LOOP;
END $$;

-- 4) Sync de estágio do deal quando o status do appointment muda
DROP TRIGGER IF EXISTS sync_deal_stage_from_appointment_trigger ON public.appointments;
CREATE TRIGGER sync_deal_stage_from_appointment_trigger
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_stage_from_appointment();
