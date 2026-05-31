-- FIX-G.2 [efficiency] Índices compostos pra queries owner-scoped frequentes.
-- appointments(user_id, status): dispatcher + grids filtram por owner + status.
-- deals(user_id, stage_id): Kanban agrupa por stage dentro do owner.

CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON public.appointments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_user_stage ON public.deals(user_id, stage_id);
