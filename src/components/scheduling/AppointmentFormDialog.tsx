import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { appointmentsApi } from '@/services/appointmentsApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotStart?: Date | null;
  resourceId?: string | null;
  recruiters?: Array<{ id: string; name: string }>;
  onCreated?: () => void;
}

export const AppointmentFormDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  slotStart,
  resourceId,
  recruiters = [],
  onCreated,
}) => {
  const [title, setTitle] = useState('Pré-entrevista');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [recruiter, setRecruiter] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && slotStart) {
      setDate(format(slotStart, 'yyyy-MM-dd'));
      setTime(format(slotStart, 'HH:mm'));
      setTitle('Pré-entrevista');
      setDuration(60);
      setRecruiter(resourceId ?? 'none');
    }
  }, [open, slotStart, resourceId]);

  const handleSubmit = async () => {
    if (!title.trim() || !date || !time) {
      toast.error('Preencha título, data e hora');
      return;
    }
    setSaving(true);
    try {
      await appointmentsApi.createFromSlot({
        title: title.trim(),
        date,
        time,
        duration,
        recruiter_id: recruiter && recruiter !== 'none' ? recruiter : null,
      });
      toast.success('Agendamento criado');
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error('[AppointmentFormDialog] create error', e);
      toast.error(e?.message || 'Erro ao criar agendamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Crie rapidamente um agendamento no slot selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="apt-title">Título *</Label>
            <Input
              id="apt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pré-entrevista"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="apt-date">Data *</Label>
              <Input
                id="apt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apt-time">Hora *</Label>
              <Input
                id="apt-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt-duration">Duração (min)</Label>
            <Input
              id="apt-duration"
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 60)}
            />
          </div>

          <div className="space-y-2">
            <Label>Recrutador</Label>
            <Select value={recruiter} onValueChange={setRecruiter}>
              <SelectTrigger>
                <SelectValue placeholder="Sem recrutador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem recrutador</SelectItem>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...
              </>
            ) : (
              'Criar agendamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentFormDialog;
