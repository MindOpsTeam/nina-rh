import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Input } from './ui/input';
import { recruitersApi } from '@/services/recruitersApi';
import {
  MODALIDADE_OPERACAO_OPTIONS,
  type Recruiter,
  type ModalidadeOperacao,
} from '@/types/recruiters';

interface RecruiterPickerProps {
  value: string | null;
  onChange: (id: string | null, recruiter: Recruiter | null) => void;
  specialty_slug?: string;
  vacancy_id?: string;
  placeholder?: string;
  disabled?: boolean;
}

const modalidadeBadgeClass = (m: ModalidadeOperacao) => {
  switch (m) {
    case 'rh_interno':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'agencia':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'freelancer':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
};

const modalidadeLabel = (m: ModalidadeOperacao) =>
  MODALIDADE_OPERACAO_OPTIONS.find((o) => o.value === m)?.label || m;

export const RecruiterPicker: React.FC<RecruiterPickerProps> = ({
  value,
  onChange,
  specialty_slug,
  vacancy_id,
  placeholder = 'Selecionar recrutador…',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    recruitersApi
      .list({ specialty_slug, vacancy_id })
      .then((data) => {
        if (!cancelled) setRecruiters(data);
      })
      .catch((err) => console.error('[RecruiterPicker] load error', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [specialty_slug, vacancy_id]);

  const selected = useMemo(() => recruiters.find((r) => r.id === value) || null, [recruiters, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recruiters;
    return recruiters.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.specialty_slugs.some((s) => s.toLowerCase().includes(q)),
    );
  }, [recruiters, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 disabled:opacity-50"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selected.name}</span>
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${modalidadeBadgeClass(selected.modalidade_operacao)}`}
              >
                {modalidadeLabel(selected.modalidade_operacao)}
              </span>
              {selected.specialty_slugs[0] && (
                <span className="text-xs text-slate-500">{selected.specialty_slugs[0]}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[380px] p-2 bg-slate-900 border-slate-700 text-slate-100"
      >
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou área…"
            className="pl-8"
          />
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            {specialty_slug || vacancy_id
              ? 'Nenhum recrutador para este filtro.'
              : 'Nenhum recrutador cadastrado.'}
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto space-y-1">
            {value && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                  className="w-full text-left text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded hover:bg-slate-800"
                >
                  Limpar seleção
                </button>
              </li>
            )}
            {filtered.map((r) => {
              const isSelected = r.id === value;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(r.id, r);
                      setOpen(false);
                    }}
                    className={`w-full text-left rounded px-2 py-2 transition-colors ${
                      isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-100 truncate">{r.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${modalidadeBadgeClass(r.modalidade_operacao)}`}
                      >
                        {modalidadeLabel(r.modalidade_operacao)}
                      </span>
                      {r.specialty_slugs[0] && (
                        <span className="text-xs text-slate-500 truncate">
                          {r.specialty_slugs[0]}
                          {r.specialty_slugs.length > 1 ? ` +${r.specialty_slugs.length - 1}` : ''}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default RecruiterPicker;
