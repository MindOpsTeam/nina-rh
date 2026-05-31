import React, { useEffect, useState } from 'react';
import { Briefcase, Calendar, Loader2 } from 'lucide-react';
import { vacanciesApi, type VacancyInterest } from '@/services/vacanciesApi';
import { Button } from './Button';

interface CandidateInterestsBlockProps {
  contactId: string;
  onScheduleInterview?: (vacancyId: string) => void;
}

export const CandidateInterestsBlock: React.FC<CandidateInterestsBlockProps> = ({
  contactId,
  onScheduleInterview,
}) => {
  const [interests, setInterests] = useState<VacancyInterest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await vacanciesApi.listInterestsByContact(contactId);
        if (!cancelled) setInterests(data);
      } catch (e) {
        console.error('[CandidateInterestsBlock] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (contactId) load();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-cyan-400" />
        Vagas de interesse
      </h4>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
        </div>
      ) : interests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4 text-center text-xs text-slate-500">
          Nina ainda não registrou interesse em vagas.
        </div>
      ) : (
        <ul className="space-y-2">
          {interests.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {it.vacancy?.titulo ?? 'Vaga removida'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {it.vacancy?.area ?? '—'}
                    {it.status ? ` • ${it.status}` : ''}
                  </p>
                </div>
                {it.vacancy?.status && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
                    {it.vacancy.status}
                  </span>
                )}
              </div>

              {it.motivo_parqueio && (
                <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                  Parqueio: {it.motivo_parqueio}
                </p>
              )}

              {it.vacancy && it.vacancy.status === 'aberta' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => onScheduleInterview?.(it.vacancy!.id)}
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Marcar entrevista
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CandidateInterestsBlock;
