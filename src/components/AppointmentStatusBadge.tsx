import React from 'react';
import type { AppointmentStatus } from '@/types';

interface Props {
  status?: AppointmentStatus | null;
  className?: string;
}

const STATUS_META: Record<
  AppointmentStatus,
  { label: string; classes: string }
> = {
  agendamento_pendente: {
    label: 'Pendente',
    classes: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  agendado: {
    label: 'Agendado',
    classes: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  },
  confirmado: {
    label: 'Confirmado',
    classes: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
  cancelado: {
    label: 'Cancelado',
    classes: 'bg-red-500/10 text-red-300 border-red-500/20',
  },
  cancelado_para_remarcacao: {
    label: 'Cancelado p/ remarcar',
    classes: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  },
  no_show: {
    label: 'No-show',
    classes: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  },
  compareceu: {
    label: 'Compareceu',
    classes: 'bg-emerald-600/20 text-emerald-200 border-emerald-600/40',
  },
  remarcado: {
    label: 'Remarcado',
    classes: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  },
  scheduled: {
    label: 'Scheduled (legado)',
    classes: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  },
};

export const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] =
  (Object.keys(STATUS_META) as AppointmentStatus[]).map((k) => ({
    value: k,
    label: STATUS_META[k].label,
  }));

export const AppointmentStatusBadge: React.FC<Props> = ({ status, className }) => {
  if (!status) return null;
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-medium ${meta.classes} ${className ?? ''}`}
    >
      {meta.label}
    </span>
  );
};

export default AppointmentStatusBadge;
