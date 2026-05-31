import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Loader2,
  Pencil,
  Pause,
  Play,
  XCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { VacancyForm } from '@/components/VacancyForm';
import { vacanciesApi } from '@/services/vacanciesApi';
import {
  MODALIDADE_OPTIONS,
  SENIORIDADE_OPTIONS,
  VACANCY_AREAS,
  formatSalaryRange,
  type Vacancy,
  type VacancyModalidade,
  type VacancySenioridade,
  type VacancyStatus,
} from '@/types/vacancies';

const STATUS_OPTIONS: { value: VacancyStatus | 'todas'; label: string }[] = [
  { value: 'aberta', label: 'Abertas' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'fechada', label: 'Fechadas' },
  { value: 'todas', label: 'Todas' },
];

const statusBadge = (status: VacancyStatus) => {
  switch (status) {
    case 'aberta':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'pausada':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'fechada':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
};

const Vacancies: React.FC = () => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<VacancyStatus | 'todas'>(
    'aberta',
  );
  const [modalidadeFilter, setModalidadeFilter] = useState<VacancyModalidade[]>(
    [],
  );
  const [senioridadeFilter, setSenioridadeFilter] = useState<
    VacancySenioridade[]
  >([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vacancy | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('new');
      window.history.replaceState({}, '', url);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vacanciesApi.listVacancies({
        status: statusFilter,
        modalidade: modalidadeFilter,
        senioridade: senioridadeFilter,
        area: areaFilter,
        search: search.trim() || undefined,
      });
      setVacancies(data);
    } catch (e: any) {
      console.error('[Vacancies] load error', e);
      setError(e?.message || 'Erro ao carregar vagas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, modalidadeFilter, senioridadeFilter, areaFilter]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleItem = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (v: Vacancy) => {
    setEditing(v);
    setFormOpen(true);
  };

  const handleStatus = async (v: Vacancy, status: VacancyStatus) => {
    try {
      const updated = await vacanciesApi.setVacancyStatus(v.id, status);
      setVacancies((list) => list.map((x) => (x.id === v.id ? updated : x)));
      toast.success('Status atualizado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar status');
    }
  };

  const handleDelete = async (v: Vacancy) => {
    if (!confirm(`Excluir a vaga "${v.titulo}"? Esta ação não pode ser desfeita.`))
      return;
    try {
      await vacanciesApi.deleteVacancy(v.id);
      setVacancies((list) => list.filter((x) => x.id !== v.id));
      toast.success('Vaga excluída');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir vaga');
    }
  };

  const empty = !loading && vacancies.length === 0 && !error;

  const filterChips = useMemo(
    () => (
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s.value
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    ),
    [statusFilter],
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-50 p-6 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-cyan-400" />
            Vagas Abertas
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Catálogo de vagas para Nina conduzir entrevistas e qualificar candidatos.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova vaga
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-9"
            />
          </div>
          {filterChips}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Modalidade
            </p>
            <div className="flex flex-wrap gap-2">
              {MODALIDADE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() =>
                    setModalidadeFilter((arr) =>
                      toggleItem(arr, m.value as VacancyModalidade),
                    )
                  }
                  className={`text-xs px-3 py-1 rounded-full border ${
                    modalidadeFilter.includes(m.value as VacancyModalidade)
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Senioridade
            </p>
            <div className="flex flex-wrap gap-2">
              {SENIORIDADE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() =>
                    setSenioridadeFilter((arr) =>
                      toggleItem(arr, s.value as VacancySenioridade),
                    )
                  }
                  className={`text-xs px-3 py-1 rounded-full border ${
                    senioridadeFilter.includes(s.value as VacancySenioridade)
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Área
            </p>
            <div className="flex flex-wrap gap-2">
              {VACANCY_AREAS.map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    setAreaFilter((arr) => toggleItem(arr, a))
                  }
                  className={`text-xs px-3 py-1 rounded-full border ${
                    areaFilter.includes(a)
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {empty && (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">
            Nenhuma vaga cadastrada
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Crie sua primeira vaga para a Nina começar a triar candidatos.
          </p>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira vaga
          </Button>
        </div>
      )}

      {!loading && !error && vacancies.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vacancies.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-5 hover:border-cyan-500/40 transition-colors flex flex-col"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-base font-semibold text-white leading-snug pr-3">
                  {v.titulo}
                </h3>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge(v.status)}`}
                >
                  {v.status}
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                {v.area ?? 'Sem área'}
                {v.senioridade ? ` • ${v.senioridade}` : ''}
              </p>

              <p className="text-sm font-bold text-emerald-400 mb-3">
                {formatSalaryRange(v.faixa_salarial_min, v.faixa_salarial_max)}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {v.modalidade_contrato.map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20"
                  >
                    {m.toUpperCase()}
                  </span>
                ))}
                {v.regime_trabalho.map((r) => (
                  <span
                    key={r}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                  >
                    {r}
                  </span>
                ))}
                {v.aceita_pcd && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    PCD
                  </span>
                )}
              </div>

              {v.descricao && (
                <p className="text-xs text-slate-500 line-clamp-3 mb-4">
                  {v.descricao}
                </p>
              )}

              <div className="mt-auto flex items-center justify-end gap-1 pt-3 border-t border-slate-800">
                <button
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                  title="Editar"
                  onClick={() => handleEdit(v)}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {v.status === 'aberta' ? (
                  <button
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-colors"
                    title="Pausar"
                    onClick={() => handleStatus(v, 'pausada')}
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : v.status === 'pausada' ? (
                  <button
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Reabrir"
                    onClick={() => handleStatus(v, 'aberta')}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                ) : null}
                {v.status !== 'fechada' && (
                  <button
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    title="Fechar"
                    onClick={() => handleStatus(v, 'fechada')}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  title="Excluir"
                  onClick={() => handleDelete(v)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <VacancyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        vacancy={editing}
        onSaved={() => load()}
      />
    </div>
  );
};

export default Vacancies;
