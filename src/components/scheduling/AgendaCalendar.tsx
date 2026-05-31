import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Views,
  type View,
  type SlotInfo,
  type EventProps,
} from 'react-big-calendar';
import withDragAndDrop, {
  type withDragAndDropProps,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { appointmentsApi } from '@/services/appointmentsApi';
import {
  CALENDAR_MESSAGES,
  appointmentToEvent,
  buildOutsideBusinessHoursEvents,
  calendarLocalizer,
  expandUnavailableToEvents,
  statusColor,
  type AnyCalendarEvent,
  type BackgroundEvent,
  type CalendarEvent,
  type TeamMemberLike,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHours,
} from './calendar-helpers';
import RescheduleConfirmDialog from './RescheduleConfirmDialog';
import AppointmentDetailDialog from './AppointmentDetailDialog';
import AppointmentFormDialog from './AppointmentFormDialog';
import type { Appointment } from '@/types';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-styles.css';

const DnDCalendar = withDragAndDrop(Calendar as any) as unknown as React.ComponentType<
  withDragAndDropProps<AnyCalendarEvent> & React.ComponentProps<typeof Calendar>
>;

const NO_RECRUITER_ID = '__none__';

const MOBILE_BREAKPOINT = 768;

interface RescheduleTarget {
  appointment: Appointment;
  oldStart: Date;
  newStart: Date;
  newEnd: Date;
}

const computeRange = (date: Date, view: View): { start: Date; end: Date } => {
  switch (view) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'week':
      return {
        start: startOfWeek(date, { weekStartsOn: 0 }),
        end: endOfWeek(date, { weekStartsOn: 0 }),
      };
    case 'agenda': {
      const start = startOfDay(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      return { start, end };
    }
    case 'month':
    default: {
      const s = startOfMonth(date);
      const e = endOfMonth(date);
      return {
        start: startOfWeek(s, { weekStartsOn: 0 }),
        end: endOfWeek(e, { weekStartsOn: 0 }),
      };
    }
  }
};

export interface AgendaCalendarProps {
  businessHours?: BusinessHours;
  initialView?: View;
}

export const AgendaCalendar: React.FC<AgendaCalendarProps> = ({
  businessHours = DEFAULT_BUSINESS_HOURS,
  initialView = Views.WEEK,
}) => {
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState<Date>(new Date());
  const [isMobile, setIsMobile] = useState(false);

  const [recruiters, setRecruiters] = useState<TeamMemberLike[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleTarget | null>(
    null,
  );
  const [rescheduling, setRescheduling] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState<{
    start: Date;
    resourceId?: string | null;
  } | null>(null);

  const range = useMemo(() => computeRange(date, view), [date, view]);

  // Mobile detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Force agenda on mobile
  useEffect(() => {
    if (isMobile && view !== Views.AGENDA) {
      setView(Views.AGENDA);
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load recruiters once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await appointmentsApi.listActiveRecruiters();
        if (!cancelled) setRecruiters(list);
      } catch (e) {
        console.error('[AgendaCalendar] recruiters load error', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load appointments for range
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    appointmentsApi
      .getAppointmentsRange(range.start, range.end)
      .then((rows) => {
        if (!cancelled) setAppointments(rows);
      })
      .catch((e) => {
        console.error('[AgendaCalendar] load range error', e);
        toast.error('Erro ao carregar agendamentos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, reloadKey]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const events: CalendarEvent[] = useMemo(
    () => appointments.map(appointmentToEvent),
    [appointments],
  );

  const resourceIds = useMemo(
    () => [NO_RECRUITER_ID, ...recruiters.map((r) => r.id)],
    [recruiters],
  );

  const backgroundEvents: BackgroundEvent[] = useMemo(() => {
    const bh = buildOutsideBusinessHoursEvents(
      businessHours,
      range.start,
      range.end,
      view === Views.DAY || view === Views.WEEK ? resourceIds : [null],
    );
    const unavailable = recruiters.flatMap((r) =>
      expandUnavailableToEvents(r, range.start, range.end),
    );
    return [...bh, ...unavailable];
  }, [businessHours, range.start, range.end, recruiters, view, resourceIds]);

  const resources = useMemo(() => {
    if (view !== Views.DAY && view !== Views.WEEK) return undefined;
    if (recruiters.length === 0) return undefined;
    return [
      { id: NO_RECRUITER_ID, title: 'Sem recrutador' },
      ...recruiters.map((r) => ({ id: r.id, title: r.name })),
    ];
  }, [recruiters, view]);

  // Re-route appointments to NO_RECRUITER_ID when null so they render in column
  const displayedEvents = useMemo(() => {
    if (!resources) return events;
    return events.map((e) => ({
      ...e,
      resourceId: e.resourceId ?? NO_RECRUITER_ID,
    }));
  }, [events, resources]);

  const eventPropGetter = useCallback((event: AnyCalendarEvent) => {
    if ((event as BackgroundEvent).isBackground) return { className: '' };
    const status = (event as CalendarEvent).appointment.status;
    const bg = statusColor(status);
    return {
      style: {
        backgroundColor: bg,
        borderColor: bg,
        color: '#fff',
      },
    };
  }, []);

  const handleSelectEvent = useCallback((evt: AnyCalendarEvent) => {
    if ((evt as BackgroundEvent).isBackground) return;
    setSelected((evt as CalendarEvent).appointment);
    setDetailOpen(true);
  }, []);

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    if (isMobile) return;
    setCreateSlot({
      start: slot.start,
      resourceId:
        slot.resourceId && slot.resourceId !== NO_RECRUITER_ID
          ? String(slot.resourceId)
          : null,
    });
    setCreateOpen(true);
  }, [isMobile]);

  const onEventDrop = useCallback(
    ({ event, start, end }: any) => {
      const ev = event as CalendarEvent;
      if (!ev.appointment) return;
      const oldStart = new Date(`${ev.appointment.date}T${ev.appointment.time}`);
      setRescheduleTarget({
        appointment: ev.appointment,
        oldStart,
        newStart: new Date(start),
        newEnd: new Date(end),
      });
    },
    [],
  );

  const onEventResize = useCallback(
    ({ event, start, end }: any) => {
      const ev = event as CalendarEvent;
      if (!ev.appointment) return;
      const oldStart = new Date(`${ev.appointment.date}T${ev.appointment.time}`);
      setRescheduleTarget({
        appointment: ev.appointment,
        oldStart,
        newStart: new Date(start),
        newEnd: new Date(end),
      });
    },
    [],
  );

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget) return;
    setRescheduling(true);
    try {
      const newDate = format(rescheduleTarget.newStart, 'yyyy-MM-dd');
      const newTime = format(rescheduleTarget.newStart, 'HH:mm');
      await appointmentsApi.reschedule(
        rescheduleTarget.appointment.id,
        newDate,
        newTime,
      );
      toast.success('Agendamento remarcado');
      setReloadKey((k) => k + 1);
      setRescheduleTarget(null);
    } catch (e: any) {
      console.error('[AgendaCalendar] reschedule error', e);
      toast.error(e?.message || 'Erro ao remarcar');
    } finally {
      setRescheduling(false);
    }
  };

  const dndProps = isMobile
    ? {}
    : {
        onEventDrop,
        onEventResize,
        draggableAccessor: (e: AnyCalendarEvent) =>
          !(e as BackgroundEvent).isBackground,
        resizableAccessor: (e: AnyCalendarEvent) =>
          !(e as BackgroundEvent).isBackground,
      };

  const allowedViews: View[] = isMobile
    ? [Views.AGENDA]
    : [Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA];

  return (
    <div className="relative w-full h-full flex flex-col">
      {loading && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-1 rounded">
          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
          Carregando...
        </div>
      )}

      <DnDCalendar
        culture="pt-BR"
        localizer={calendarLocalizer}
        messages={CALENDAR_MESSAGES}
        events={displayedEvents as any}
        backgroundEvents={backgroundEvents as any}
        date={date}
        onNavigate={(d) => setDate(d)}
        view={view}
        onView={(v) => setView(v)}
        views={allowedViews}
        defaultView={initialView}
        startAccessor={(e: any) => (e as AnyCalendarEvent).start}
        endAccessor={(e: any) => (e as AnyCalendarEvent).end}
        titleAccessor={(e: any) => (e as AnyCalendarEvent).title}
        resourceIdAccessor={(r: any) => r.id}
        resourceTitleAccessor={(r: any) => r.title}
        resources={resources as any}
        selectable={!isMobile}
        onSelectEvent={handleSelectEvent as any}
        onSelectSlot={handleSelectSlot}
        eventPropGetter={eventPropGetter as any}
        tooltipAccessor={(e: any) => {
          const evt = e as AnyCalendarEvent;
          if ((evt as BackgroundEvent).isBackground) {
            const bg = evt as BackgroundEvent;
            return bg.reason
              ? `${bg.memberName ?? ''} — ${bg.reason}`.trim()
              : bg.title;
          }
          return (evt as CalendarEvent).title;
        }}
        style={{ minHeight: 600 }}
        {...dndProps}
      />

      <AppointmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selected}
      />

      <RescheduleConfirmDialog
        open={!!rescheduleTarget}
        onOpenChange={(v) => !v && setRescheduleTarget(null)}
        appointmentTitle={rescheduleTarget?.appointment.title}
        oldStart={rescheduleTarget?.oldStart}
        newStart={rescheduleTarget?.newStart}
        newEnd={rescheduleTarget?.newEnd}
        saving={rescheduling}
        onConfirm={handleConfirmReschedule}
      />

      <AppointmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        slotStart={createSlot?.start}
        resourceId={createSlot?.resourceId ?? null}
        recruiters={recruiters.map((r) => ({ id: r.id, name: r.name }))}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
};

export default AgendaCalendar;
