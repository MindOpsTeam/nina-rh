-- Migration: Habilitar Realtime para tabelas do projeto
-- Adiciona tabelas à publicação supabase_realtime para atualizações em tempo real

-- Messages: novas mensagens em conversas
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Conversations: novas conversas e atualizações de status
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Contacts: novos contatos
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- Deals: atualizações de pipeline
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;

-- Pipeline stages: configuração de estágios
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;

-- Teams: configuração de equipes
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;

-- Team functions: funções da equipe
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_functions;

-- Team members: membros da equipe
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;

-- Appointments: agendamentos
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;