import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './Button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  MODALIDADE_OPERACAO_OPTIONS,
  TIPO_CONTRATACAO_OPTIONS,
  RecruiterFormSchema,
  type Recruiter,
  type RecruiterFormInput,
  type ModalidadeOperacao,
  type TipoContratacao,
  type UnavailableSlot,
} from '@/types/recruiters';
import { SPECIALTY_CATEGORY_LABELS, type SpecialtyRh } from '@/types/specialties';
import { recruitersApi } from '@/services/recruitersApi';
import { specialtiesRhApi } from '@/services/specialtiesRhApi';
import { vacanciesApi } from '@/services/vacanciesApi';
import type { Vacancy } from '@/types/vacancies';

interface RecruiterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruiter?: Recruiter | null;
  onSaved?: (rec: Recruiter) => void;
}

const emptyForm: RecruiterFormInput = {
  name: '',
  email: '',
  phone: '',
  modalidade_operacao: 'rh_interno',
  registro_profissional: '',
  specialty_slugs: [],
  tipos_contratacao: ['clt'],
  bio: '',
  vacancy_ids: [],
  unavailable_slots: [],
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
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

export const RecruiterForm: React.FC<RecruiterFormProps> = ({
  open,
  onOpenChange,
  recruiter,
  onSaved,
}) => {
  const [form, setForm] = useState<RecruiterFormInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [specialties, setSpecialties] = useState<SpecialtyRh[]>([]);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [showNewSpecialty, setShowNewSpecialty] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecCategory, setNewSpecCategory] = useState('outros');

  useEffect(() => {
    if (open) {
      setErrors({});
      if (recruiter) {
        setForm({
          name: recruiter.name,
          email: recruiter.email,
          phone: '',
          modalidade_operacao: recruiter.modalidade_operacao,
          registro_profissional: recruiter.registro_profissional || '',
          specialty_slugs: recruiter.specialty_slugs || [],
          tipos_contratacao: (recruiter.tipos_contratacao || []) as TipoContratacao[],
          bio: recruiter.bio || '',
          vacancy_ids: recruiter.vacancy_ids || [],
          unavailable_slots: recruiter.unavailable_slots || [],
        });
      } else {
        setForm(emptyForm);
      }
      loadSpecialties();
      loadVacancies();
    }
    // FIX-D review: depende de recruiter?.id (objeto muda referência a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recruiter?.id]);

  const loadSpecialties = async () => {
    try {
      const data = await specialtiesRhApi.listAll();
      setSpecialties(data);
    } catch (err) {
      console.error('Erro ao carregar áreas', err);
    }
  };

  const loadVacancies = async () => {
    try {
      const list = await vacanciesApi.listOpenVacancies();
      setVacancies(list);
    } catch (err) {
      console.error('Erro ao carregar vagas', err);
    }
  };

  const groupedSpecialties = useMemo(() => {
    const filter = specialtySearch.trim().toLowerCase();
    const filtered = specialties.filter(
      (s) =>
        !filter ||
        s.name.toLowerCase().includes(filter) ||
        s.slug.toLowerCase().includes(filter),
    );
    const groups: Record<string, SpecialtyRh[]> = {};
    for (const s of filtered) {
      const cat = s.category || 'outros';
      groups[cat] = groups[cat] || [];
      groups[cat].push(s);
    }
    return groups;
  }, [specialties, specialtySearch]);

  const modalidadeMeta = MODALIDADE_OPERACAO_OPTIONS.find(
    (m) => m.value === form.modalidade_operacao,
  )!;

  const toggleSpecialty = (slug: string) => {
    setForm((f) => ({
      ...f,
      specialty_slugs: f.specialty_slugs.includes(slug)
        ? f.specialty_slugs.filter((s) => s !== slug)
        : [...f.specialty_slugs, slug],
    }));
  };

  const toggleTipoContratacao = (tipo: TipoContratacao) => {
    setForm((f) => ({
      ...f,
      tipos_contratacao: f.tipos_contratacao.includes(tipo)
        ? f.tipos_contratacao.filter((t) => t !== tipo)
        : [...f.tipos_contratacao, tipo],
    }));
  };

  const toggleVacancy = (id: string) => {
    setForm((f) => ({
      ...f,
      vacancy_ids: f.vacancy_ids.includes(id)
        ? f.vacancy_ids.filter((v) => v !== id)
        : [...f.vacancy_ids, id],
    }));
  };

  const addSlot = (kind: UnavailableSlot['kind']) => {
    const newSlot: UnavailableSlot =
      kind === 'full_day'
        ? { kind: 'full_day', date: '' }
        : kind === 'range'
          ? { kind: 'range', start: '', end: '' }
          : { kind: 'daily', start_time: '09:00', end_time: '12:00', weekdays: [1] };
    setForm((f) => ({ ...f, unavailable_slots: [...f.unavailable_slots, newSlot] }));
  };

  const updateSlot = (idx: number, patch: Partial<UnavailableSlot>) => {
    setForm((f) => ({
      ...f,
      unavailable_slots: f.unavailable_slots.map((s, i) =>
        i === idx ? ({ ...s, ...patch } as UnavailableSlot) : s,
      ),
    }));
  };

  const removeSlot = (idx: number) => {
    setForm((f) => ({
      ...f,
      unavailable_slots: f.unavailable_slots.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateSpecialty = async () => {
    if (!newSpecName.trim()) {
      toast.error('Informe o nome da área');
      return;
    }
    try {
      const created = await specialtiesRhApi.createCustom({
        name: newSpecName,
        category: newSpecCategory,
      });
      setSpecialties((prev) => [...prev, created]);
      setForm((f) => ({ ...f, specialty_slugs: [...f.specialty_slugs, created.slug] }));
      setNewSpecName('');
      setShowNewSpecialty(false);
      toast.success('Área criada');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao criar área');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = RecruiterFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        errs[path] = issue.message;
      }
      setErrors(errs);
      toast.error('Verifique os campos do formulário');
      return;
    }
    setSaving(true);
    try {
      const saved = recruiter
        ? await recruitersApi.update(recruiter.id, parsed.data)
        : await recruitersApi.create(parsed.data);
      toast.success(recruiter ? 'Recrutador atualizado' : 'Recrutador cadastrado');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao salvar recrutador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle>{recruiter ? 'Editar recrutador' : 'Novo recrutador'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure modalidade, áreas de atuação, vagas e bloqueios de agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Identidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo"
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="recrutador@empresa.com"
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Telefone (opcional)</Label>
              <Input
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="space-y-1">
              <Label>{modalidadeMeta.registroLabel}</Label>
              <Input
                value={form.registro_profissional || ''}
                onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Modalidade */}
          <div className="space-y-2">
            <Label>Modalidade de operação</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {MODALIDADE_OPERACAO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, modalidade_operacao: opt.value as ModalidadeOperacao })}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    form.modalidade_operacao === opt.value
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{opt.registroLabel}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tipos de contratação */}
          <div className="space-y-2">
            <Label>Tipos de contratação que opera</Label>
            <div className="flex flex-wrap gap-2">
              {TIPO_CONTRATACAO_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={form.tipos_contratacao.includes(opt.value)}
                  onClick={() => toggleTipoContratacao(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Áreas de atuação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Áreas de atuação</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewSpecialty((v) => !v)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Criar nova área
              </Button>
            </div>
            <Input
              value={specialtySearch}
              onChange={(e) => setSpecialtySearch(e.target.value)}
              placeholder="Buscar área…"
            />
            {showNewSpecialty && (
              <div className="rounded-lg border border-slate-700 p-3 space-y-2 bg-slate-950/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={newSpecName}
                    onChange={(e) => setNewSpecName(e.target.value)}
                    placeholder="Nome da nova área (ex: Pediatria)"
                  />
                  <Select value={newSpecCategory} onValueChange={setNewSpecCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SPECIALTY_CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewSpecialty(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateSpecialty}>
                    Criar
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {Object.entries(groupedSpecialties).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                    {SPECIALTY_CATEGORY_LABELS[cat] || cat}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((s) => (
                      <Chip
                        key={s.id}
                        active={form.specialty_slugs.includes(s.slug)}
                        onClick={() => toggleSpecialty(s.slug)}
                      >
                        {s.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(groupedSpecialties).length === 0 && (
                <p className="text-xs text-slate-500">Nenhuma área encontrada.</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <Label>Bio</Label>
            <Textarea
              rows={3}
              value={form.bio || ''}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Resumo curto de experiência."
            />
          </div>

          {/* Vagas que opera */}
          <div className="space-y-2">
            <Label>Vagas que opera</Label>
            {vacancies.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma vaga aberta no momento.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {vacancies.map((v) => (
                  <Chip key={v.id} active={form.vacancy_ids.includes(v.id)} onClick={() => toggleVacancy(v.id)}>
                    {v.titulo}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {/* Bloqueios / folgas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Folgas e bloqueios</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => addSlot('full_day')}>
                  + Dia inteiro
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => addSlot('range')}>
                  + Janela
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => addSlot('daily')}>
                  + Recorrente
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {form.unavailable_slots.map((slot, idx) => (
                <div key={idx} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-slate-500">
                      {slot.kind === 'full_day' ? 'Dia inteiro' : slot.kind === 'range' ? 'Janela' : 'Recorrente'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {slot.kind === 'full_day' && (
                    <Input
                      type="date"
                      value={(slot as any).date || ''}
                      onChange={(e) => updateSlot(idx, { date: e.target.value } as any)}
                    />
                  )}
                  {slot.kind === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="datetime-local"
                          value={(slot as any).start || ''}
                          onChange={(e) => updateSlot(idx, { start: e.target.value } as any)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fim</Label>
                        <Input
                          type="datetime-local"
                          value={(slot as any).end || ''}
                          onChange={(e) => updateSlot(idx, { end: e.target.value } as any)}
                        />
                      </div>
                    </div>
                  )}
                  {slot.kind === 'daily' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="time"
                            value={(slot as any).start_time}
                            onChange={(e) => updateSlot(idx, { start_time: e.target.value } as any)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="time"
                            value={(slot as any).end_time}
                            onChange={(e) => updateSlot(idx, { end_time: e.target.value } as any)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Dias</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {WEEKDAY_LABELS.map((lbl, w) => {
                            const active = ((slot as any).weekdays || []).includes(w);
                            return (
                              <Chip
                                key={w}
                                active={active}
                                onClick={() => {
                                  const wd = new Set<number>((slot as any).weekdays || []);
                                  if (wd.has(w)) wd.delete(w);
                                  else wd.add(w);
                                  updateSlot(idx, { weekdays: Array.from(wd).sort() } as any);
                                }}
                              >
                                {lbl}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {form.unavailable_slots.length === 0 && (
                <p className="text-xs text-slate-500">Sem bloqueios cadastrados.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {recruiter ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecruiterForm;
