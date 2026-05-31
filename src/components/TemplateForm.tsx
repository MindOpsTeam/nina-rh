import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  TemplateFormSchema,
  detectVariables,
  renderTemplatePreview,
  type MessageTemplate,
  type TemplateFormInput,
} from '@/types/templates';
import { templatesApi } from '@/services/templatesApi';

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSaved?: (t: MessageTemplate) => void;
}

const emptyForm: TemplateFormInput = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  body: '',
};

export const TemplateForm: React.FC<TemplateFormProps> = ({
  open,
  onOpenChange,
  template,
  onSaved,
}) => {
  const [form, setForm] = useState<TemplateFormInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setForm({
          name: template.name,
          category: template.category,
          language: template.language,
          body: template.body,
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
    }
  }, [open, template]);

  const detected = useMemo(() => detectVariables(form.body), [form.body]);
  const preview = useMemo(() => renderTemplatePreview(form.body), [form.body]);
  const bodyLen = form.body.length;

  const handleSubmit = async () => {
    const parsed = TemplateFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errs[issue.path.join('.')] = issue.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = template
        ? await templatesApi.update(template.id, parsed.data)
        : await templatesApi.create(parsed.data);
      toast.success(template ? 'Template atualizado' : 'Template criado');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e: any) {
      console.error('[TemplateForm] save error', e);
      toast.error(e?.message || 'Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar template' : 'Novo template'}
          </DialogTitle>
          <DialogDescription>
            Templates de mensagem (Meta HSM) usados pela Nina em janelas
            re-engagement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="t-name">Nome técnico *</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value.toLowerCase() })
              }
              placeholder="ex: lembrete_entrevista_d1"
              autoComplete="off"
              maxLength={512}
            />
            <p className="text-[11px] text-slate-500">
              Apenas minúsculas, números e underscore. Será usado pra
              identificar o template na Meta.
            </p>
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as TemplateFormInput['category'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{c.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {c.hint}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Idioma *</Label>
              <Select
                value={form.language}
                onValueChange={(v) =>
                  setForm({ ...form, language: v as TemplateFormInput['language'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-body">Corpo da mensagem *</Label>
            <Textarea
              id="t-body"
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Olá {{1}}! Sua entrevista para {{2}} é amanhã às {{3}}."
              maxLength={1024}
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Use {'{{1}}'}, {'{{2}}'}... para variáveis (sem gap).
              </span>
              <span className={bodyLen > 1024 ? 'text-red-400' : ''}>
                {bodyLen}/1024
              </span>
            </div>
            {errors.body && (
              <p className="text-xs text-red-400">{errors.body}</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Preview
              </span>
              <span className="text-[10px] text-slate-500">
                {detected.numbers.length} variável(eis) ·{' '}
                {detected.gaps.length > 0 ? (
                  <span className="text-red-400">
                    gaps: {detected.gaps.map((g) => `{{${g}}}`).join(', ')}
                  </span>
                ) : (
                  <span className="text-emerald-400">sequência OK</span>
                )}
              </span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap min-h-[60px]">
              {preview || (
                <span className="text-slate-600 italic">
                  Digite o corpo para ver o preview...
                </span>
              )}
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/80">
            Não inclua URLs no corpo — a Meta exige aprovação prévia para
            templates com links. Submissão final acontece em F10.
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
            ) : template ? (
              'Atualizar template'
            ) : (
              'Criar template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateForm;
