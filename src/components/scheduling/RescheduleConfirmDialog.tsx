import React from 'react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentTitle?: string;
  oldStart?: Date;
  newStart?: Date;
  newEnd?: Date;
  saving?: boolean;
  onConfirm: () => void;
}

const fmt = (d?: Date) =>
  d
    ? format(d, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : '—';

export const RescheduleConfirmDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  appointmentTitle,
  oldStart,
  newStart,
  newEnd,
  saving,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar remarcação</DialogTitle>
          <DialogDescription>
            {appointmentTitle ?? 'Agendamento'} será movido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              De
            </p>
            <p className="text-sm text-slate-300">{fmt(oldStart)}</p>
          </div>
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1">
              Para
            </p>
            <p className="text-sm text-white font-medium">{fmt(newStart)}</p>
            {newEnd && (
              <p className="text-[11px] text-slate-400 mt-1">
                Término: {format(newEnd, 'HH:mm')}
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            O status do agendamento passa a <strong>remarcado</strong>. A Nina
            notificará o candidato em seguida.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
              </>
            ) : (
              'Confirmar remarcação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleConfirmDialog;
