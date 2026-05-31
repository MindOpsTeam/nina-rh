-- Migration: Recriar triggers essenciais do banco

-- ============================================================
-- 1. Trigger: auto_create_deal_on_contact
-- Cria um deal automaticamente quando um novo contato é inserido
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_deal_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    first_stage_id UUID;
BEGIN
    -- Encontra o primeiro estágio ativo do pipeline
    SELECT id INTO first_stage_id
    FROM public.pipeline_stages
    WHERE is_active = true
    ORDER BY position ASC
    LIMIT 1;

    -- Se não houver estágio, não cria deal
    IF first_stage_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Cria o deal vinculado ao contato
    INSERT INTO public.deals (
        contact_id,
        title,
        stage_id,
        value,
        priority,
        tags,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.name, 'Deal sem nome') || ' - ' || NEW.phone_number,
        first_stage_id,
        0,
        'medium',
        '{}',
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS auto_create_deal_on_contact_trigger ON public.contacts;

-- Cria o trigger
CREATE TRIGGER auto_create_deal_on_contact_trigger
    AFTER INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_deal_on_contact();


-- ============================================================
-- 2. Trigger: update_conversation_last_message_trigger
-- Atualiza last_message_at em conversations e last_activity em contacts
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualiza last_message_at na conversa
    UPDATE public.conversations
    SET last_message_at = NEW.sent_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Atualiza last_activity no contato relacionado
    UPDATE public.contacts
    SET last_activity = NEW.sent_at,
        updated_at = NOW()
    WHERE id = (
        SELECT contact_id FROM public.conversations WHERE id = NEW.conversation_id
    );

    RETURN NEW;
END;
$$;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;

-- Cria o trigger
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();


-- ============================================================
-- 3. Triggers updated_at para todas as tabelas relevantes
-- ============================================================

-- contacts
DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- conversations
DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- conversation_states
DROP TRIGGER IF EXISTS conversation_states_updated_at ON public.conversation_states;
CREATE TRIGGER conversation_states_updated_at
    BEFORE UPDATE ON public.conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- nina_processing_queue
DROP TRIGGER IF EXISTS nina_processing_queue_updated_at ON public.nina_processing_queue;
CREATE TRIGGER nina_processing_queue_updated_at
    BEFORE UPDATE ON public.nina_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- message_processing_queue
DROP TRIGGER IF EXISTS message_processing_queue_updated_at ON public.message_processing_queue;
CREATE TRIGGER message_processing_queue_updated_at
    BEFORE UPDATE ON public.message_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- send_queue
DROP TRIGGER IF EXISTS send_queue_updated_at ON public.send_queue;
CREATE TRIGGER send_queue_updated_at
    BEFORE UPDATE ON public.send_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- nina_settings
DROP TRIGGER IF EXISTS nina_settings_updated_at ON public.nina_settings;
CREATE TRIGGER nina_settings_updated_at
    BEFORE UPDATE ON public.nina_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- tag_definitions
DROP TRIGGER IF EXISTS tag_definitions_updated_at ON public.tag_definitions;
CREATE TRIGGER tag_definitions_updated_at
    BEFORE UPDATE ON public.tag_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();