import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Recruiter, RecruiterFormInput } from '@/types/recruiters';

// New RH columns on team_members aren't reflected in generated supabase types yet.
const supabase = supabaseClient as any;

const TABLE = 'team_members';

const RH_SELECT =
  'id, user_id, name, email, role, status, weight, team_id, function_id, avatar, created_at, updated_at, modalidade_operacao, registro_profissional, specialty_slugs, tipos_contratacao, bio, unavailable_slots, vacancy_ids';

function normalize(row: any): Recruiter {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    name: row.name,
    email: row.email,
    status: row.status,
    role: row.role,
    weight: row.weight ?? 1,
    team_id: row.team_id ?? null,
    function_id: row.function_id ?? null,
    avatar: row.avatar ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    modalidade_operacao: row.modalidade_operacao,
    registro_profissional: row.registro_profissional ?? null,
    specialty_slugs: Array.isArray(row.specialty_slugs) ? row.specialty_slugs : [],
    tipos_contratacao: Array.isArray(row.tipos_contratacao) ? row.tipos_contratacao : [],
    bio: row.bio ?? null,
    vacancy_ids: Array.isArray(row.vacancy_ids) ? row.vacancy_ids : [],
    unavailable_slots: Array.isArray(row.unavailable_slots) ? row.unavailable_slots : [],
  };
}

export interface RecruiterFilters {
  specialty_slug?: string;
  vacancy_id?: string;
}

export const recruitersApi = {
  async list(filters: RecruiterFilters = {}): Promise<Recruiter[]> {
    let query = supabase
      .from(TABLE)
      .select(RH_SELECT)
      .not('modalidade_operacao', 'is', null)
      .order('name', { ascending: true });

    if (filters.specialty_slug) {
      query = query.contains('specialty_slugs', [filters.specialty_slug]);
    }
    if (filters.vacancy_id) {
      query = query.contains('vacancy_ids', [filters.vacancy_id]);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalize);
  },

  async listAdministrative(): Promise<Recruiter[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(RH_SELECT)
      .is('modalidade_operacao', null)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map(normalize);
  },

  async create(input: RecruiterFormInput): Promise<Recruiter> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const payload: any = {
      user_id: user.id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: 'agent',
      status: 'active',
      modalidade_operacao: input.modalidade_operacao,
      registro_profissional: input.registro_profissional?.trim() || null,
      specialty_slugs: input.specialty_slugs || [],
      tipos_contratacao: input.tipos_contratacao || [],
      bio: input.bio?.trim() || null,
      vacancy_ids: input.vacancy_ids || [],
      unavailable_slots: input.unavailable_slots || [],
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select(RH_SELECT)
      .single();
    if (error) throw error;
    return normalize(data);
  },

  async update(id: string, input: Partial<RecruiterFormInput>): Promise<Recruiter> {
    const patch: any = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
    if (input.modalidade_operacao !== undefined) patch.modalidade_operacao = input.modalidade_operacao;
    if (input.registro_profissional !== undefined) patch.registro_profissional = input.registro_profissional?.trim() || null;
    if (input.specialty_slugs !== undefined) patch.specialty_slugs = input.specialty_slugs;
    if (input.tipos_contratacao !== undefined) patch.tipos_contratacao = input.tipos_contratacao;
    if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
    if (input.vacancy_ids !== undefined) patch.vacancy_ids = input.vacancy_ids;
    if (input.unavailable_slots !== undefined) patch.unavailable_slots = input.unavailable_slots;

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select(RH_SELECT)
      .single();
    if (error) throw error;
    return normalize(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
