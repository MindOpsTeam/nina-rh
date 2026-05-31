import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Bell, Clock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  reminderSettingsApi,
  type ReminderSettings as ReminderSettingsType,
} from '@/services/reminderSettingsApi';

export interface ReminderSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

const ReminderSettingsView = forwardRef<ReminderSettingsRef>((_, ref) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<ReminderSettingsType | null>(null);
  const [form, setForm] = useState({
    reminder_enabled: true,
    reminder_lead_hours: 24,
    reminder_dispatch_hour: 18,
    reminder_d0_enabled: true,
    reminder_d0_hour: 8,
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await reminderSettingsApi.get();
      if (data) {
        setOriginal(data);
        setForm({
          reminder_enabled: data.reminder_enabled,
          reminder_lead_hours: data.reminder_lead_hours,
          reminder_dispatch_hour: data.reminder_dispatch_hour,
          reminder_d0_enabled: data.reminder_d0_enabled,
          reminder_d0_hour: data.reminder_d0_hour,
        });
      }
    } catch (e: any) {
      console.error('[ReminderSettings] load error', e);
      toast.error(e?.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await reminderSettingsApi.update(form);
      setOriginal(data);
      toast.success('Lembretes atualizados');
    } catch (e: any) {
      console.error('[ReminderSettings] save error', e);
      toast.error(e?.message || 'Erro ao salvar lembretes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!original) return;
    setForm({
      reminder_enabled: original.reminder_enabled,
      reminder_lead_hours: original.reminder_lead_hours,
      reminder_dispatch_hour: original.reminder_dispatch_hour,
      reminder_d0_enabled: original.reminder_d0_enabled,
      reminder_d0_hour: original.reminder_d0_hour,
    });
  };

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: handleCancel,
    isSaving: saving,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2 text-cyan-400" />
        Carregando lembretes...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Bell className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Lembrete D-1 (véspera)
            </h3>
            <p className="text-sm text-slate-400">
              Mensagem enviada na véspera da entrevista para confirmação.
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span className="text-sm text-slate-200">Ativar lembrete D-1</span>
          <Switch
            checked={form.reminder_enabled}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, reminder_enabled: v }))
            }
          />
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="leadHours">Antecedência (horas)</Label>
            <Input
              id="leadHours"
              type="number"
              min={24}
              max={48}
              value={form.reminder_lead_hours}
              disabled={!form.reminder_enabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reminder_lead_hours: Math.max(
                    24,
                    Math.min(48, Number(e.target.value) || 24),
                  ),
                }))
              }
            />
            <p className="text-xs text-slate-500">Entre 24h e 48h.</p>
          </div>

          <div className="space-y-2">
            <Label>Horário de envio</Label>
            <Select
              value={String(form.reminder_dispatch_hour)}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, reminder_dispatch_hour: Number(v) }))
              }
              disabled={!form.reminder_enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {fmtHour(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Hora local (America/Sao_Paulo) que o cron tenta enviar D-1.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Clock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Lembrete D-0 (no dia)
            </h3>
            <p className="text-sm text-slate-400">
              Mensagem rápida no próprio dia da entrevista.
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span className="text-sm text-slate-200">Ativar lembrete D-0</span>
          <Switch
            checked={form.reminder_d0_enabled}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, reminder_d0_enabled: v }))
            }
          />
        </label>

        <div className="space-y-2 md:max-w-xs">
          <Label>Horário do D-0</Label>
          <Select
            value={String(form.reminder_d0_hour)}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, reminder_d0_hour: Number(v) }))
            }
            disabled={!form.reminder_d0_enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {fmtHour(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Hora local em que o cron tenta enviar D-0.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <strong>D-1</strong> = lembrete 24h antes (configurável até 48h).{' '}
          <strong>D-0</strong> = lembrete no próprio dia da entrevista. Os crons
          rodam de hora em hora e respeitam o fuso America/Sao_Paulo.
        </p>
      </div>
    </div>
  );
});

ReminderSettingsView.displayName = 'ReminderSettingsView';

export default ReminderSettingsView;
