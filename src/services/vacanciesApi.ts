import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type {
  Vacancy,
  VacancyFilters,
  VacancyFormInput,
  VacancyStatus,
} from '@/types/vacancies';

// Vacancies tables were added in F3 but are not yet present in the generated
// supabase types. Use a permissive cast to bypass the strict relation typing.
const supabase = supabaseClient as any;

const TABLE = 'vacancies';

// FIX-G: colunas enxutas pra listagem (grid). Detalhe usa select('*').
const VACANCY_LIST_SELECT =
  'id, titulo, area, senioridade, status, faixa_salarial_min, faixa_salarial_max, modalidade_contrato, regime_trabalho, aceita_pcd, aceita_remoto, created_at, updated_at, user_id';

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
};

export interface VacancyInterest {
  id: string;
  contact_id: string;
  vacancy_id: string;
  status: string | null;
  motivo_parqueio: string | null;
  created_at: string;
  updated_at: string;
  vacancy?: Pick<Vacancy, 'id' | 'titulo' | 'area' | 'status'>;
}

export const vacanciesApi = {
  async listVacancies(filters: VacancyFilters = {}): Promise<Vacancy[]> {
    // FIX-G review: SELECT enxuto pra grid (sem descricao TEXT + requirements JSONB pesados).
    // O detalhe completo vem de getVacancy() com select('*').
    let q = supabase
      .from(TABLE)
      .select(VACANCY_LIST_SELECT)
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'todas') {
      q = q.eq('status', filters.status);
    }
    if (filters.search) {
      q = q.ilike('titulo', `%${filters.search}%`);
    }
    if (filters.modalidade && filters.modalidade.length > 0) {
      q = q.overlaps('modalidade_contrato', filters.modalidade);
    }
    if (filters.senioridade && filters.senioridade.length > 0) {
      q = q.in('senioridade', filters.senioridade);
    }
    if (filters.area && filters.area.length > 0) {
      q = q.in('area', filters.area);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Vacancy[];
  },

  async listOpenVacancies(): Promise<Vacancy[]> {
    return vacanciesApi.listVacancies({ status: 'aberta' });
  },

  async getVacancy(id: string): Promise<Vacancy | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Vacancy) ?? null;
  },

  async createVacancy(input: VacancyFormInput): Promise<Vacancy> {
    const userId = await getCurrentUserId();
    const payload = {
      user_id: userId,
      titulo: input.titulo.trim(),
      area: input.area ?? null,
      senioridade: input.senioridade ?? null,
      modalidade_contrato: input.modalidade_contrato,
      regime_trabalho: input.regime_trabalho,
      faixa_salarial_min: input.faixa_salarial_min ?? null,
      faixa_salarial_max: input.faixa_salarial_max ?? null,
      descricao: input.descricao ?? null,
      requirements: input.requirements,
      status: input.status,
      aceita_pcd: input.aceita_pcd,
      aceita_remoto: input.aceita_remoto,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Vacancy;
  },

  async updateVacancy(
    id: string,
    patch: Partial<VacancyFormInput>,
  ): Promise<Vacancy> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Vacancy;
  },

  async deleteVacancy(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async setVacancyStatus(id: string, status: VacancyStatus): Promise<Vacancy> {
    return vacanciesApi.updateVacancy(id, { status });
  },

  async listInterestsByContact(contactId: string): Promise<VacancyInterest[]> {
    const { data, error } = await supabase
      .from('vacancy_interests')
      .select('*, vacancy:vacancies(id, titulo, area, status)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as VacancyInterest[];
  },
};
