import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, X } from 'lucide-react';
import { vacanciesApi } from '@/services/vacanciesApi';
import type { Vacancy } from '@/types/vacancies';

interface VacancyPickerProps {
  value: string | null;
  onChange: (vacancyId: string | null, vacancy: Vacancy | null) => void;
  placeholder?: string;
  /** When true, lists all vacancies regardless of status. Default: only 'aberta'. */
  includeAll?: boolean;
  className?: string;
}

export const VacancyPicker: React.FC<VacancyPickerProps> = ({
  value,
  onChange,
  placeholder = 'Selecione uma vaga',
  includeAll = false,
  className,
}) => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = includeAll
          ? await vacanciesApi.listVacancies({ status: 'todas' })
          : await vacanciesApi.listOpenVacancies();
        if (!cancelled) setVacancies(data);
      } catch (e) {
        console.error('[VacancyPicker] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [includeAll]);

  const selected = useMemo(
    () => vacancies.find((v) => v.id === value) ?? null,
    [vacancies, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vacancies;
    return vacancies.filter(
      (v) =>
        v.titulo.toLowerCase().includes(q) ||
        (v.area ?? '').toLowerCase().includes(q),
    );
  }, [vacancies, query]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          <Briefcase className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          {selected ? (
            <span className="truncate">{selected.titulo}</span>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null, null);
            }}
            className="p-1 hover:bg-slate-800 rounded text-slate-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-800 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar vaga..."
              className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhuma vaga encontrada
              </div>
            ) : (
              filtered.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => {
                    onChange(v.id, v);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 ${
                    value === v.id ? 'bg-slate-800/50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-slate-200 font-medium truncate">
                      {v.titulo}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {v.area ?? 'Sem área'}
                      {v.senioridade ? ` • ${v.senioridade}` : ''}
                    </p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">
                    {v.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VacancyPicker;
