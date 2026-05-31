
-- Criar triggers que não foram criados na migration anterior

-- 1. Trigger para auto_create_deal_on_contact
DROP TRIGGER IF EXISTS auto_create_deal_on_contact_trigger ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact_trigger
    AFTER INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_deal_on_contact();

-- 2. Trigger para update_conversation_last_message
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();

-- 3. Triggers updated_at
DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS conversation_states_updated_at ON public.conversation_states;
CREATE TRIGGER conversation_states_updated_at
    BEFORE UPDATE ON public.conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS nina_processing_queue_updated_at ON public.nina_processing_queue;
CREATE TRIGGER nina_processing_queue_updated_at
    BEFORE UPDATE ON public.nina_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS message_processing_queue_updated_at ON public.message_processing_queue;
CREATE TRIGGER message_processing_queue_updated_at
    BEFORE UPDATE ON public.message_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS send_queue_updated_at ON public.send_queue;
CREATE TRIGGER send_queue_updated_at
    BEFORE UPDATE ON public.send_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS nina_settings_updated_at ON public.nina_settings;
CREATE TRIGGER nina_settings_updated_at
    BEFORE UPDATE ON public.nina_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tag_definitions_updated_at ON public.tag_definitions;
CREATE TRIGGER tag_definitions_updated_at
    BEFORE UPDATE ON public.tag_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
