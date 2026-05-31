
-- Limpar triggers duplicados de updated_at
-- Manter apenas os triggers com sufixo _updated_at (sem prefixo update_)

-- contacts
DROP TRIGGER IF EXISTS set_updated_at ON public.contacts;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;

-- conversations
DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;

-- conversation_states
DROP TRIGGER IF EXISTS set_updated_at ON public.conversation_states;
DROP TRIGGER IF EXISTS update_conversation_states_updated_at ON public.conversation_states;

-- message_processing_queue
DROP TRIGGER IF EXISTS set_updated_at ON public.message_processing_queue;
DROP TRIGGER IF EXISTS update_message_processing_queue_updated_at ON public.message_processing_queue;

-- nina_processing_queue
DROP TRIGGER IF EXISTS set_updated_at ON public.nina_processing_queue;
DROP TRIGGER IF EXISTS update_nina_processing_queue_updated_at ON public.nina_processing_queue;

-- nina_settings
DROP TRIGGER IF EXISTS set_updated_at ON public.nina_settings;
DROP TRIGGER IF EXISTS update_nina_settings_updated_at ON public.nina_settings;

-- send_queue
DROP TRIGGER IF EXISTS set_updated_at ON public.send_queue;
DROP TRIGGER IF EXISTS update_send_queue_updated_at ON public.send_queue;

-- tag_definitions
DROP TRIGGER IF EXISTS set_updated_at ON public.tag_definitions;
DROP TRIGGER IF EXISTS update_tag_definitions_updated_at ON public.tag_definitions;
