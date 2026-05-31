-- F3a: Adiciona vacancy_id em appointments para vincular entrevista à vaga.
-- Mantém compatível com appointments existentes (NULL permitido).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS vacancy_id UUID REFERENCES public.vacancies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_vacancy_id ON public.appointments(vacancy_id);
