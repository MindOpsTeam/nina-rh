import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  Shield,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { TemplateForm } from '@/components/TemplateForm';
import { templatesApi } from '@/services/templatesApi';
import {
  categoryLabels,
  languageLabels,
  type MessageTemplate,
} from '@/types/templates';

const categoryColor = (c: MessageTemplate['category']) => {
  switch (c) {
    case 'UTILITY':
      return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
    case 'MARKETING':
      return 'bg-violet-500/10 text-violet-300 border-violet-500/20';
    case 'AUTHENTICATION':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  }
};

const META_STATUS_META: Record<string, { label: string; className: string; icon: string }> = {
  pending:   { label: 'PENDING',   className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: '🟡' },
  approved:  { label: 'APPROVED',  className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: '🟢' },
  rejected:  { label: 'REJECTED',  className: 'bg-red-500/15 text-red-300 border-red-500/30',   icon: '🔴' },
  disabled:  { label: 'DISABLED',  className: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: '⚪' },
};

const relativeTime = (iso: string | null): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h atrás`;
  return `${Math.floor(diff / 86_400_000)} dias atrás`;
};

const nextResubmitName = (existingNames: Set<string>, base: string): string => {
  const stripped = base.replace(/_v\d+$/, '');
  let n = 2;
  let candidate = `${stripped}_v${n}`;
  while (existingNames.has(candidate)) {
    n++;
    candidate = `${stripped}_v${n}`;
  }
  return candidate;
};

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [scopeWarning, setScopeWarning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await templatesApi.list();
      setTemplates(data);
    } catch (e: any) {
      console.error('[Templates] load error', e);
      toast.error(e?.message || 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const allNames = useMemo(() => new Set(templates.map((t) => t.name)), [templates]);

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (t: MessageTemplate) => {
    if (t.is_seed) {
      toast.info('Templates de sistema são read-only. Clone para customizar.');
      return;
    }
    setEditing(t);
    setFormOpen(true);
  };

  const handleClone = async (t: MessageTemplate) => {
    try {
      const cloned = await templatesApi.cloneSeed(t.id);
      toast.success(`Template clonado como "${cloned.name}"`);
      await load();
      setEditing(cloned);
      setFormOpen(true);
    } catch (e: any) {
      console.error('[Templates] clone error', e);
      toast.error(e?.message || 'Erro ao clonar template');
    }
  };

  const handleDelete = async (t: MessageTemplate) => {
    if (t.is_seed) {
      toast.info('Templates de sistema não podem ser excluídos.');
      return;
    }
    if (!confirm(`Excluir o template "${t.name}"? Isso também removerá na Meta se já estiver lá.`)) return;
    setActionInFlight(t.id);
    try {
      if (t.meta_template_id) {
        try {
          await templatesApi.deleteFromMeta(t.id);
        } catch (err: any) {
          if (err?.error === 'token_lacks_management_scope') {
            setScopeWarning(true);
            toast.error('Token Meta sem permissão. Removi só localmente — limpe na Meta depois.');
          } else {
            console.warn('[Templates] meta delete fallback, removing locally', err);
          }
        }
      }
      await templatesApi.remove(t.id);
      setTemplates((arr) => arr.filter((x) => x.id !== t.id));
      toast.success('Template excluído');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir template');
    } finally {
      setActionInFlight(null);
    }
  };

  const handleSubmit = async (t: MessageTemplate) => {
    setActionInFlight(t.id);
    try {
      const res = await templatesApi.submitToMeta(t.id);
      toast.success(`Submetido à Meta (status: ${res.meta_status})`);
      await load();
    } catch (e: any) {
      if (e?.error === 'token_lacks_management_scope') {
        setScopeWarning(true);
        toast.error('Token Meta sem permissão de gestão de templates.');
      } else {
        toast.error(e?.error || e?.message || 'Erro ao submeter');
      }
    } finally {
      setActionInFlight(null);
    }
  };

  const handleSyncOne = async (t: MessageTemplate) => {
    setActionInFlight(t.id);
    try {
      const res = await templatesApi.syncStatusFromMeta(t.id);
      if (res.warning === 'token_lacks_management_scope') setScopeWarning(true);
      toast.success(`Sync: ${res.synced} atualizado(s)`);
      await load();
    } catch (e: any) {
      if (e?.error === 'token_lacks_management_scope') {
        setScopeWarning(true);
      }
      toast.error(e?.error || e?.message || 'Erro ao sincronizar');
    } finally {
      setActionInFlight(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await templatesApi.syncStatusFromMeta();
      if (res.warning === 'token_lacks_management_scope') setScopeWarning(true);
      toast.success(`Sync global: ${res.synced} atualizado(s), ${res.errors} erro(s)`);
      await load();
    } catch (e: any) {
      if (e?.error === 'token_lacks_management_scope') setScopeWarning(true);
      toast.error(e?.error || e?.message || 'Erro ao sincronizar');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleResubmit = async (t: MessageTemplate) => {
    setActionInFlight(t.id);
    try {
      const newName = nextResubmitName(allNames, t.name);
      const fresh = await templatesApi.create({
        name: newName,
        category: t.category,
        language: t.language,
        body: t.body,
      });
      toast.success(`Re-submetendo como "${newName}"...`);
      await templatesApi.submitToMeta(fresh.id);
      await load();
      toast.success('Nova versão enviada à Meta');
    } catch (e: any) {
      if (e?.error === 'token_lacks_management_scope') {
        setScopeWarning(true);
        toast.error('Token Meta sem permissão de gestão de templates.');
      } else {
        toast.error(e?.error || e?.message || 'Erro ao re-submeter');
      }
    } finally {
      setActionInFlight(null);
    }
  };

  const seeds = templates.filter((t) => t.is_seed);
  const customs = templates.filter((t) => !t.is_seed);

  const renderMetaBadge = (t: MessageTemplate) => {
    if (t.is_seed) return null;
    if (!t.meta_status) {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/50 text-slate-400">
          Apenas local
        </span>
      );
    }
    const meta = META_STATUS_META[t.meta_status] || META_STATUS_META.pending;
    return (
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${meta.className} flex items-center gap-1`}
        title={t.meta_status === 'rejected' && t.meta_rejection_reason ? t.meta_rejection_reason : ''}
      >
        <span>{meta.icon}</span> {meta.label}
      </span>
    );
  };

  const renderMetaActions = (t: MessageTemplate) => {
    if (t.is_seed) return null;
    const busy = actionInFlight === t.id;

    const baseClass =
      'text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 disabled:opacity-50';

    if (!t.meta_status) {
      // local only — pode submeter
      if (!t.body) return null;
      return (
        <button
          onClick={() => handleSubmit(t)}
          disabled={busy}
          className={`${baseClass} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
          title="Enviar para aprovação da Meta"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Submeter à Meta
        </button>
      );
    }

    if (t.meta_status === 'pending') {
      return (
        <button
          onClick={() => handleSyncOne(t)}
          disabled={busy}
          className={`${baseClass} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
          title="Buscar status atual na Meta"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          Sincronizar agora
        </button>
      );
    }

    if (t.meta_status === 'rejected') {
      return (
        <button
          onClick={() => handleResubmit(t)}
          disabled={busy}
          className={`${baseClass} border-red-500/40 text-red-300 hover:bg-red-500/10`}
          title={t.meta_rejection_reason || 'Re-submeter como nova versão'}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Re-submeter
        </button>
      );
    }

    // approved | disabled → read-only
    return null;
  };

  const renderCard = (t: MessageTemplate) => (
    <div
      key={t.id}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 hover:border-cyan-500/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white font-mono truncate">
              {t.name}
            </h3>
            {t.is_seed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Sistema
              </span>
            )}
            {renderMetaBadge(t)}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryColor(t.category)}`}
            >
              {categoryLabels[t.category]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/50 text-slate-300">
              {languageLabels[t.language]}
            </span>
            <span className="text-[10px] text-slate-500">
              {t.variables_count} var
            </span>
            {!t.is_seed && t.meta_status_synced_at && (
              <span className="text-[10px] text-slate-500" title={new Date(t.meta_status_synced_at).toLocaleString('pt-BR')}>
                · sync {relativeTime(t.meta_status_synced_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {t.is_seed ? (
            <button
              onClick={() => handleClone(t)}
              title="Clonar para customizar"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => handleEdit(t)}
                title="Editar"
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(t)}
                title="Excluir"
                disabled={actionInFlight === t.id}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">
        {t.body}
      </p>

      {t.meta_status === 'rejected' && t.meta_rejection_reason && (
        <div className="text-[11px] rounded bg-red-500/5 border border-red-500/20 text-red-300 px-2 py-1.5">
          <strong>Motivo da rejeição:</strong> {t.meta_rejection_reason}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">{renderMetaActions(t)}</div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-50 p-6 custom-scrollbar">
      {scopeWarning && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-200 space-y-1.5 flex-1">
            <div className="font-semibold">Permissão do Meta insuficiente</div>
            <div className="text-amber-200/90">
              Seu token Meta não tem a permissão <code className="px-1 rounded bg-amber-900/40 font-mono text-xs">whatsapp_business_management</code>.
              Gere um novo token em <a className="underline inline-flex items-center gap-1" href="https://developers.facebook.com/" target="_blank" rel="noreferrer">developers.facebook.com<ExternalLink className="w-3 h-3" /></a> com essa scope habilitada e atualize em
              {' '}<button className="underline" onClick={() => navigate('/settings')}>Configurações → WhatsApp</button>.
            </div>
          </div>
          <button
            onClick={() => setScopeWarning(false)}
            className="text-xs text-amber-300/80 hover:text-amber-100"
          >
            Dispensar
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate('/settings')}
            className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" /> Voltar para Configurações
          </button>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <MessageSquareQuote className="w-7 h-7 text-cyan-400" />
            Templates de Mensagem
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Catálogo de templates HSM da Meta usados pela Nina em re-engajamento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncAll} variant="outline" disabled={syncingAll}>
            {syncingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4 mr-2" />
            )}
            Sincronizar tudo
          </Button>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> Novo template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {seeds.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-3 h-3 text-amber-400" />
                Templates de Sistema
              </h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {seeds.map(renderCard)}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Seus Templates
            </h3>
            {customs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
                <MessageSquareQuote className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-200">
                  Apenas templates de sistema
                </h4>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Clique em "Novo template" para customizar ou clone um seed
                  acima para começar a partir dele.
                </p>
                <Button onClick={handleNew}>
                  <Plus className="w-4 h-4 mr-2" /> Criar primeiro template
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {customs.map(renderCard)}
              </div>
            )}
          </section>
        </div>
      )}

      <TemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
        onSaved={() => load()}
      />
    </div>
  );
};

export default Templates;
