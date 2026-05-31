import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Briefcase, Calendar, Clock, User, Phone, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppointmentStatusBadge } from '@/components/AppointmentStatusBadge';
import type { Appointment } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
}

export const AppointmentDetailDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  appointment,
}) => {
  if (!appointment) return null;
  const start = new Date(`${appointment.date}T${appointment.time}`);
  const recruiter = (appointment as any).recruiter;
  const vacancy = (appointment as any).vacancy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {appointment.title}
            <AppointmentStatusBadge status={appointment.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-cyan-400" />
            {format(start, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-violet-400" />
            {format(start, 'HH:mm')} — {appointment.duration ?? 60} min
          </div>

          {appointment.contact && (
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4 text-emerald-400" />
              {appointment.contact.name || 'Sem nome'}
              <span className="text-slate-500 text-xs">
                <Phone className="w-3 h-3 inline mr-1" />
                {appointment.contact.phone_number}
              </span>
            </div>
          )}

          {recruiter && (
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4 text-amber-400" />
              Recrutador: {recruiter.name}
            </div>
          )}

          {vacancy && (
            <div className="flex items-center gap-2 text-slate-300">
              <Briefcase className="w-4 h-4 text-cyan-400" />
              Vaga: {vacancy.titulo}
              {vacancy.area && (
                <span className="text-slate-500 text-xs">· {vacancy.area}</span>
              )}
            </div>
          )}

          {appointment.description && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="whitespace-pre-wrap leading-relaxed">
                {appointment.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
            <div className="rounded border border-slate-800 bg-slate-900/30 p-2">
              <p className="text-slate-500">Lembrete D-1</p>
              <p className={appointment.reminder_d1_sent_at ? 'text-emerald-400' : 'text-slate-400'}>
                {appointment.reminder_d1_sent_at
                  ? `✓ ${format(new Date(appointment.reminder_d1_sent_at), 'dd/MM HH:mm')}`
                  : 'pendente'}
              </p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/30 p-2">
              <p className="text-slate-500">Lembrete D-0</p>
              <p className={appointment.reminder_d0_sent_at ? 'text-emerald-400' : 'text-slate-400'}>
                {appointment.reminder_d0_sent_at
                  ? `✓ ${format(new Date(appointment.reminder_d0_sent_at), 'dd/MM HH:mm')}`
                  : 'pendente'}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailDialog;
