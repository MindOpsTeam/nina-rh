import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { dateFnsLocalizer } from 'react-big-calendar';
import type { Appointment, AppointmentStatus } from '../../types';

export const calendarLocales = { 'pt-BR': ptBR };

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales: calendarLocales,
});

export const CALENDAR_MESSAGES = {
  date: 'Data',
  time: 'Horário',
  event: 'Evento',
  allDay: 'Dia todo',
  week: 'Semana',
  work_week: 'Semana útil',
  day: 'Dia',
  month: 'Mês',
  previous: 'Anterior',
  next: 'Próximo',
  yesterday: 'Ontem',
  tomorrow: 'Amanhã',
  today: 'Hoje',
  agenda: 'Agenda',
  noEventsInRange: 'Nenhum agendamento neste período.',
  showMore: (total: number) => `+${total} mais`,
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  agendamento_pendente: '#F59E0B',
  agendado: '#3B82F6',
  scheduled: '#3B82F6',
  confirmado: '#10B981',
  cancelado: '#EF4444',
  cancelado_para_remarcacao: '#EF4444',
  no_show: '#6B7280',
  compareceu: '#059669',
  remarcado: '#8B5CF6',
};

export const statusColor = (status?: AppointmentStatus | null): string =>
  STATUS_COLORS[status ?? 'agendado'] ?? '#3B82F6';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId?: string | null;
  isBackground?: false;
  appointment: Appointment;
}

export interface BackgroundEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId?: string | null;
  isBackground: true;
  reason?: string;
  memberName?: string;
}

export type AnyCalendarEvent = CalendarEvent | BackgroundEvent;

export function appointmentToEvent(a: Appointment): CalendarEvent {
  const start = new Date(`${a.date}T${a.time}`);
  const end = new Date(start.getTime() + (a.duration ?? 60) * 60_000);
  const recruiterId = (a as any).recruiter_id ?? (a as any).recruiter?.id ?? null;
  return {
    id: a.id,
    title: a.title,
    start,
    end,
    resourceId: recruiterId,
    appointment: a,
  };
}

export interface BusinessHours {
  start: string;
  end: string;
  days: number[];
  timezone?: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: '08:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5],
};

type UnavailableSlot =
  | { type: 'full_day'; date: string; reason?: string }
  | { type: 'range'; start: string; end: string; reason?: string }
  | {
      type: 'daily';
      weekdays: number[];
      start_time: string;
      end_time: string;
      reason?: string;
    };

export interface TeamMemberLike {
  id: string;
  name: string;
  unavailable_slots?: UnavailableSlot[] | null;
}

const parseHM = (hm: string): [number, number] => {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return [h || 0, m || 0];
};

const eachDay = (start: Date, end: Date): Date[] => {
  const out: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur.getTime() <= last.getTime()) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

export function expandUnavailableToEvents(
  member: TeamMemberLike,
  viewStart: Date,
  viewEnd: Date,
): BackgroundEvent[] {
  const events: BackgroundEvent[] = [];
  const slots = Array.isArray(member.unavailable_slots)
    ? member.unavailable_slots
    : [];

  slots.forEach((slot, idx) => {
    if (!slot || typeof slot !== 'object') return;

    if (slot.type === 'full_day' && slot.date) {
      const start = new Date(`${slot.date}T00:00:00`);
      const end = new Date(`${slot.date}T23:59:59`);
      if (end < viewStart || start > viewEnd) return;
      events.push({
        id: `bg-${member.id}-fd-${idx}`,
        title: `${member.name}${slot.reason ? ` — ${slot.reason}` : ' — folga'}`,
        start,
        end,
        resourceId: member.id,
        isBackground: true,
        reason: slot.reason,
        memberName: member.name,
      });
      return;
    }

    if (slot.type === 'range' && slot.start && slot.end) {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      if (end < viewStart || start > viewEnd) return;
      events.push({
        id: `bg-${member.id}-rg-${idx}`,
        title: `${member.name}${slot.reason ? ` — ${slot.reason}` : ' — indisponível'}`,
        start,
        end,
        resourceId: member.id,
        isBackground: true,
        reason: slot.reason,
        memberName: member.name,
      });
      return;
    }

    if (
      slot.type === 'daily' &&
      Array.isArray(slot.weekdays) &&
      slot.start_time &&
      slot.end_time
    ) {
      // F #2 review fix: filtra weekdays ANTES de alocar (não cria evento pra dia que vai descartar).
      const allDays = eachDay(viewStart, viewEnd);
      const weekdaysSet = new Set(slot.weekdays);
      const matchingDays = allDays.filter((d) => weekdaysSet.has(d.getDay()));
      const [sh, sm] = parseHM(slot.start_time);
      const [eh, em] = parseHM(slot.end_time);
      matchingDays.forEach((d, i) => {
        const start = new Date(d);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(d);
        end.setHours(eh, em, 0, 0);
        events.push({
          id: `bg-${member.id}-dl-${idx}-${i}`,
          title: `${member.name}${slot.reason ? ` — ${slot.reason}` : ' — bloqueio recorrente'}`,
          start,
          end,
          resourceId: member.id,
          isBackground: true,
          reason: slot.reason,
          memberName: member.name,
        });
      });
    }
  });

  return events;
}

export function buildOutsideBusinessHoursEvents(
  bh: BusinessHours,
  viewStart: Date,
  viewEnd: Date,
  resourceIds: (string | null)[] = [null],
): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  const days = eachDay(viewStart, viewEnd);
  const [sh, sm] = parseHM(bh.start);
  const [eh, em] = parseHM(bh.end);

  days.forEach((d, i) => {
    const isBusinessDay = bh.days.includes(d.getDay());
    resourceIds.forEach((rid) => {
      if (!isBusinessDay) {
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        out.push({
          id: `bh-off-${i}-${rid ?? 'none'}`,
          title: 'Fora do horário comercial',
          start,
          end,
          resourceId: rid,
          isBackground: true,
        });
        return;
      }
      const morning = new Date(d);
      morning.setHours(0, 0, 0, 0);
      const morningEnd = new Date(d);
      morningEnd.setHours(sh, sm, 0, 0);
      const eveningStart = new Date(d);
      eveningStart.setHours(eh, em, 0, 0);
      const eveningEnd = new Date(d);
      eveningEnd.setHours(23, 59, 59, 999);
      out.push({
        id: `bh-m-${i}-${rid ?? 'none'}`,
        title: 'Fora do horário comercial',
        start: morning,
        end: morningEnd,
        resourceId: rid,
        isBackground: true,
      });
      out.push({
        id: `bh-e-${i}-${rid ?? 'none'}`,
        title: 'Fora do horário comercial',
        start: eveningStart,
        end: eveningEnd,
        resourceId: rid,
        isBackground: true,
      });
    });
  });

  return out;
}

export function formatRange(start: Date, end: Date): string {
  return `${format(start, 'dd/MM HH:mm')} – ${format(end, 'HH:mm')}`;
}
