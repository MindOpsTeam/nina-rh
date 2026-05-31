import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Appointment } from '@/types';

// recruiter_id + vacancy_id columns are in F3/F5 but not all present in generated types.
const supabase = supabaseClient as any;

export interface AppointmentsRangeFilters {
  status?: string[];
  recruiter_id?: string | null;
  vacancy_id?: string | null;
}

const SELECT_FRAGMENT = `
  *,
  contact:contacts(id, name, phone_number),
  vacancy:vacancies(id, titulo, area, status),
  recruiter:team_members!recruiter_id(id, name, modalidade_operacao)
`;

const toAppointment = (row: any): Appointment => ({
  id: row.id,
  title: row.title,
  date: row.date,
  time: typeof row.time === 'string' ? row.time.substring(0, 5) : row.time,
  duration: row.duration,
  type: row.type,
  description: row.description ?? undefined,
  attendees: row.attendees ?? [],
  contact_id: row.contact_id ?? undefined,
  contact: row.contact
    ? {
        id: row.contact.id,
        name: row.contact.name,
        phone_number: row.contact.phone_number,
      }
    : undefined,
  metadata: row.metadata,
  status: row.status,
  reminder_d1_sent_at: row.reminder_d1_sent_at ?? null,
  reminder_d0_sent_at: row.reminder_d0_sent_at ?? null,
  confirmed_at: row.confirmed_at ?? null,
  cancelled_at: row.cancelled_at ?? null,
  no_show_at: row.no_show_at ?? null,
  // extra fields for calendar (non-typed)
  ...(row.recruiter_id ? { recruiter_id: row.recruiter_id } : {}),
  ...(row.vacancy_id ? { vacancy_id: row.vacancy_id } : {}),
  ...(row.recruiter ? { recruiter: row.recruiter } : {}),
  ...(row.vacancy ? { vacancy: row.vacancy } : {}),
});

export const appointmentsApi = {
  async getAppointmentsRange(
    start: Date,
    end: Date,
    filters?: AppointmentsRangeFilters,
  ): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select(SELECT_FRAGMENT)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at', { ascending: true });

    if (filters?.status?.length) q = q.in('status', filters.status);
    if (filters?.recruiter_id) q = q.eq('recruiter_id', filters.recruiter_id);
    if (filters?.vacancy_id) q = q.eq('vacancy_id', filters.vacancy_id);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(toAppointment);
  },

  async listActiveRecruiters() {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name, modalidade_operacao, unavailable_slots, status')
      .not('modalidade_operacao', 'is', null)
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      name: string;
      modalidade_operacao: string;
      unavailable_slots: any[] | null;
      status: string;
    }>;
  },

  async reschedule(
    appointmentId: string,
    newDate: string,
    newTime: string,
  ): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update({
        date: newDate,
        time: newTime,
        status: 'remarcado',
      })
      .eq('id', appointmentId)
      .select(SELECT_FRAGMENT)
      .single();
    if (error) throw error;
    return toAppointment(data);
  },

  async createFromSlot(input: {
    date: string;
    time: string;
    title: string;
    duration?: number;
    type?: string;
    contact_id?: string | null;
    recruiter_id?: string | null;
    vacancy_id?: string | null;
  }): Promise<Appointment> {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Não autenticado');
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        title: input.title,
        date: input.date,
        time: input.time,
        duration: input.duration ?? 60,
        type: input.type ?? 'demo',
        contact_id: input.contact_id ?? null,
        recruiter_id: input.recruiter_id ?? null,
        vacancy_id: input.vacancy_id ?? null,
        status: 'agendamento_pendente',
        user_id: user.id,
      })
      .select(SELECT_FRAGMENT)
      .single();
    if (error) throw error;
    return toAppointment(data);
  },
};
