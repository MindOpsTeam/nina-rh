import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { resumesApi } from '@/services/resumesApi';
import type { Resume, ResumeParseStatus, ResumeParsedData } from '@/types/resumes';

interface ResumeBlockProps {
  contactId: string;
  vacancyId?: string | null;
}

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return `${Math.floor(diff / 86_400_000)} d`;
};

const STATUS_META: Record<ResumeParseStatus, { label: string; className: string; Icon: typeof Loader2 }> = {
  pending:  { label: 'Aguardando', className: 'bg-slate-500/15 text-slate-300 border-slate-500/30', Icon: Clock },
  parsing:  { label: 'Processando', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: Loader2 },
  parsed:   { label: 'Pronto',     className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 },
  failed:   { label: 'Erro',       className: 'bg-red-500/15 text-red-300 border-red-500/30', Icon: AlertCircle },
};

export const ResumeBlock: React.FC<ResumeBlockProps> = ({ contactId, vacancyId }) => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await resumesApi.listByContact(contactId);
      setResumes(data);
    } catch (e: any) {
      console.error('[ResumeBlock] load error', e);
      toast.error(e?.message || 'Erro ao carregar currículos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Realtime: refresh on inserts/updates do contato
    const channel = supabase
      .channel(`resumes-${contactId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resumes', filter: `contact_id=eq.${contactId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const handleToggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  const handleDownload = async (r: Resume) => {
    try {
      const url = await resumesApi.downloadOriginal(r.file_path);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar link');
    }
  };

  const handleReparse = async (r: Resume) => {
    setBusyId(r.id);
    try {
      await resumesApi.triggerParse(r.id);
      toast.success('Re-parse disparado');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao re-parsear');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (r: Resume) => {
    if (!confirm(`Excluir o currículo "${r.file_name || r.id}"?`)) return;
    setBusyId(r.id);
    try {
      await resumesApi.remove(r.id, r.file_path);
      setResumes((arr) => arr.filter((x) => x.id !== r.id));
      toast.success('Currículo removido');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo maior que 10 MB');
      return;
    }
    const mime = file.type || 'application/pdf';
    setUploading(true);
    try {
      const signed = await resumesApi.requestUploadFor({
        contact_id: contactId,
        vacancy_id: vacancyId || undefined,
        file_name: file.name,
        mime_type: mime,
      });
      const putResp = await fetch(signed.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: file,
      });
      if (!putResp.ok) throw new Error(`upload_${putResp.status}`);
      toast.success('Upload concluído, processando…');
      // Dispara parse em background (fire-and-forget)
      resumesApi.triggerParse(signed.resume_id).catch((err) => {
        console.warn('[ResumeBlock] auto-parse non-fatal:', err);
      });
      await load();
    } catch (err: any) {
      console.error('[ResumeBlock] manual upload error', err);
      toast.error(err?.message || 'Erro no upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const renderParsedData = (data: ResumeParsedData) => {
    return (
      <div className="space-y-3 text-xs">
        {data.experiencia_total_anos != null && (
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Experiência:</span>
            <strong>{data.experiencia_total_anos} {data.experiencia_total_anos === 1 ? 'ano' : 'anos'}</strong>
          </div>
        )}
        {data.localizacao_cidade_estado && (
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Localização:</span>
            <span>{data.localizacao_cidade_estado}</span>
          </div>
        )}
        {(data.cargos?.length || 0) > 0 && (
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Cargos</div>
            <ul className="space-y-1.5">
              {data.cargos!.slice(0, 5).map((c, i) => (
                <li key={i} className="rounded bg-slate-900/60 border border-slate-800 px-2 py-1.5">
                  <div className="text-slate-200 font-medium">{c.cargo || 'Cargo'}</div>
                  <div className="text-slate-400">{[c.empresa, c.periodo].filter(Boolean).join(' · ')}</div>
                  {c.descricao && <div className="text-slate-500 mt-0.5 line-clamp-2">{c.descricao}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(data.formacao?.length || 0) > 0 && (
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Formação</div>
            <ul className="space-y-1">
              {data.formacao!.slice(0, 4).map((f, i) => (
                <li key={i} className="text-slate-300">
                  {[f.curso, f.instituicao, f.ano_conclusao].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(data.idiomas?.length || 0) > 0 && (
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Idiomas</div>
            <div className="flex flex-wrap gap-1">
              {data.idiomas!.map((id, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  {id.nome}{id.nivel ? ` · ${id.nivel}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {(data.skills?.length || 0) > 0 && (
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Skills</div>
            <div className="flex flex-wrap gap-1">
              {data.skills!.slice(0, 20).map((s, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {(data.certificacoes?.length || 0) > 0 && (
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Certificações</div>
            <ul className="space-y-0.5">
              {data.certificacoes!.slice(0, 6).map((c, i) => (
                <li key={i} className="text-slate-300">
                  {c.nome}{c.ano ? ` · ${c.ano}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Currículos ({resumes.length})
          </h3>
        </div>
        <label className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center gap-1">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Enviar arquivo
          <input
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={handleManualUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        </div>
      ) : resumes.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nenhum currículo. Peça pela Nina via tool <code className="font-mono text-[10px]">request_resume_upload</code>{' '}
          ou envie acima.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {resumes.map((r) => {
            const meta = STATUS_META[r.parse_status];
            const Icon = meta.Icon;
            const isExpanded = !!expanded[r.id];
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden">
                <button
                  onClick={() => handleToggle(r.id)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                    <span className="text-xs text-slate-200 truncate">{r.file_name || r.file_path.split('/').pop()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${meta.className}`}
                    >
                      <Icon className={`w-2.5 h-2.5 ${r.parse_status === 'parsing' ? 'animate-spin' : ''}`} />
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{relativeTime(r.created_at)}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 py-2.5 border-t border-slate-800 bg-slate-950/60 space-y-2">
                    {r.parse_status === 'parsed' && r.parsed_data && renderParsedData(r.parsed_data)}
                    {r.parse_status === 'failed' && (
                      <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
                        <strong>Erro no parse:</strong> {r.parse_error || 'desconhecido'}
                      </div>
                    )}
                    {(r.parse_status === 'pending' || r.parse_status === 'parsing') && (
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processando…
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => handleDownload(r)}
                        className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Baixar original
                      </button>
                      {(r.parse_status === 'failed' || r.parse_status === 'parsed') && (
                        <button
                          onClick={() => handleReparse(r)}
                          disabled={busy}
                          className="text-[10px] px-2 py-1 rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 flex items-center gap-1"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                          Re-parse
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={busy}
                        className="text-[10px] px-2 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ResumeBlock;
