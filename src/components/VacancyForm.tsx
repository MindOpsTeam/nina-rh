import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './Button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  MODALIDADE_OPTIONS,
  REGIME_OPTIONS,
  SENIORIDADE_OPTIONS,
  VACANCY_AREAS,
  VacancyFormSchema,
  type Vacancy,
  type VacancyFormInput,
  type VacancyModalidade,
  type VacancyRegime,
  type VacancySenioridade,
} from '@/types/vacancies';
import { vacanciesApi } from '@/services/vacanciesApi';

interface VacancyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacancy?: Vacancy | null;
  onSaved?: (vacancy: Vacancy) => void;
}

const emptyForm: VacancyFormInput = {
  titulo: '',
  area: null,
  senioridade: null,
  modalidade_contrato: ['clt'],
  regime_trabalho: [],
  faixa_salarial_min: null,
  faixa_salarial_max: null,
  descricao: null,
  requirements: [],
  status: 'aberta',
  aceita_pcd: false,
  aceita_remoto: false,
};

const ChipToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
      active
        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'
    }`}
  >
    {children}
  </button>
);

export const VacancyForm: React.FC<VacancyFormProps> = ({
  open,
  onOpenChange,
  vacancy,
  onSaved,
}) => {
  const [form, setForm] = useState<VacancyFormInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newRequirement, setNewRequirement] = useState('');

  useEffect(() => {
    if (open) {
      if (vacancy) {
        setForm({
          titulo: vacancy.titulo,
          area: vacancy.area ?? null,
          senioridade: vacancy.senioridade ?? null,
          modalidade_contrato: vacancy.modalidade_contrato ?? [],
          regime_trabalho: vacancy.regime_trabalho ?? [],
          faixa_salarial_min: vacancy.faixa_salarial_min,
          faixa_salarial_max: vacancy.faixa_salarial_max,
          descricao: vacancy.descricao,
          requirements: vacancy.requirements ?? [],
          status: vacancy.status,
          aceita_pcd: vacancy.aceita_pcd,
          aceita_remoto: vacancy.aceita_remoto,
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      setNewRequirement('');
    }
    // FIX-D review: depende de vacancy?.id (objeto muda referência a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vacancy?.id]);

  const toggleArrayItem = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleAddRequirement = () => {
    const v = newRequirement.trim();
    if (!v) return;
    setForm((f) => ({ ...f, requirements: [...f.requirements, v] }));
    setNewRequirement('');
  };

  const handleRemoveRequirement = (idx: number) => {
    setForm((f) => ({
      ...f,
      requirements: f.requirements.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async () => {
    const parsed = VacancyFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path.join('.');
        errs[key] = issue.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = vacancy
        ? await vacanciesApi.updateVacancy(vacancy.id, parsed.data)
        : await vacanciesApi.createVacancy(parsed.data);
      toast.success(vacancy ? 'Vaga atualizada' : 'Vaga criada');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e: any) {
      console.error('[VacancyForm] save error', e);
      toast.error(e?.message || 'Erro ao salvar vaga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vacancy ? 'Editar vaga' : 'Nova vaga'}</DialogTitle>
          <DialogDescription>
            Preencha as informações da vaga aberta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Enfermeiro(a) Plantonista"
            />
            {errors.titulo && (
              <p className="text-xs text-red-400">{errors.titulo}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select
                value={form.area ?? ''}
                onValueChange={(v) =>
                  setForm({ ...form, area: v || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione área" />
                </SelectTrigger>
                <SelectContent>
                  {VACANCY_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Senioridade</Label>
              <div className="flex flex-wrap gap-2">
                {SENIORIDADE_OPTIONS.map((s) => (
                  <ChipToggle
                    key={s.value}
                    active={form.senioridade === s.value}
                    onClick={() =>
                      setForm({
                        ...form,
                        senioridade:
                          form.senioridade === s.value
                            ? null
                            : (s.value as VacancySenioridade),
                      })
                    }
                  >
                    {s.label}
                  </ChipToggle>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Modalidade de contrato *</Label>
            <div className="flex flex-wrap gap-2">
              {MODALIDADE_OPTIONS.map((m) => (
                <ChipToggle
                  key={m.value}
                  active={form.modalidade_contrato.includes(
                    m.value as VacancyModalidade,
                  )}
                  onClick={() =>
                    setForm({
                      ...form,
                      modalidade_contrato: toggleArrayItem(
                        form.modalidade_contrato,
                        m.value as VacancyModalidade,
                      ),
                    })
                  }
                >
                  {m.label}
                </ChipToggle>
              ))}
            </div>
            {errors.modalidade_contrato && (
              <p className="text-xs text-red-400">
                {errors.modalidade_contrato}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Regime de trabalho</Label>
            <div className="flex flex-wrap gap-2">
              {REGIME_OPTIONS.map((r) => (
                <ChipToggle
                  key={r.value}
                  active={form.regime_trabalho.includes(
                    r.value as VacancyRegime,
                  )}
                  onClick={() =>
                    setForm({
                      ...form,
                      regime_trabalho: toggleArrayItem(
                        form.regime_trabalho,
                        r.value as VacancyRegime,
                      ),
                    })
                  }
                >
                  {r.label}
                </ChipToggle>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salMin">Faixa salarial mín. (R$)</Label>
              <Input
                id="salMin"
                type="number"
                inputMode="numeric"
                value={form.faixa_salarial_min ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    faixa_salarial_min: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salMax">Faixa salarial máx. (R$)</Label>
              <Input
                id="salMax"
                type="number"
                inputMode="numeric"
                value={form.faixa_salarial_max ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    faixa_salarial_max: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="0"
              />
              {errors.faixa_salarial_max && (
                <p className="text-xs text-red-400">
                  {errors.faixa_salarial_max}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              rows={4}
              value={form.descricao ?? ''}
              onChange={(e) =>
                setForm({ ...form, descricao: e.target.value || null })
              }
              placeholder="Atribuições, responsabilidades, contexto da vaga..."
            />
          </div>

          <div className="space-y-2">
            <Label>Requisitos</Label>
            <div className="flex gap-2">
              <Input
                value={newRequirement}
                onChange={(e) => setNewRequirement(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRequirement();
                  }
                }}
                placeholder="Ex: COREN ativo"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddRequirement}
              >
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {form.requirements.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-2">
                {form.requirements.map((r, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 rounded-full pl-3 pr-1 py-1 text-slate-200"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(idx)}
                      className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <span className="text-sm text-slate-300">Aceita PCD</span>
              <Switch
                checked={form.aceita_pcd}
                onCheckedChange={(v) => setForm({ ...form, aceita_pcd: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <span className="text-sm text-slate-300">Aceita remoto</span>
              <Switch
                checked={form.aceita_remoto}
                onCheckedChange={(v) =>
                  setForm({ ...form, aceita_remoto: v })
                }
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm({ ...form, status: v as VacancyFormInput['status'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
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
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
              </>
            ) : vacancy ? (
              'Atualizar vaga'
            ) : (
              'Criar vaga'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VacancyForm;
