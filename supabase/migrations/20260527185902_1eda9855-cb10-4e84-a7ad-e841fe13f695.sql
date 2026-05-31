
-- Remover trigger duplicado de auto_create_deal_on_contact
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
