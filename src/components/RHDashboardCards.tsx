import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RHMetrics {
  newCandidatesToday: number;
  interviewsWeek: number;
  attendanceRate30d: number | null;
  avgTimeToQualifyMin: number | null;
  loading: boolean;
}

const INTERVIEW_PREFIX = 'entrevista';

const fmtPercent = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fmtMinutes = (v: number | null) => {
  if (v == null) return '—';
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  return `${h}h ${m}m`;
};

const attendanceTier = (rate: number | null) => {
  if (rate == null) return 'text-slate-400';
  if (rate >= 0.75) return 'text-emerald-400';
  if (rate >= 0.65) return 'text-amber-400';
  return 'text-red-400';
};

const qualifyTier = (mins: number | null) => {
  if (mins == null) return 'text-slate-400';
  return mins < 15 ? 'text-emerald-400' : 'text-amber-400';
};

const Card: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  valueClassName?: string;
  gradient: string;
}> = ({ icon, label, value, hint, valueClassName, gradient }) => (
  <div
    className={`relative overflow-hidden rounded-2xl border bg-slate-900/50 backdrop-blur-sm p-6 shadow-xl transition-all duration-300 hover:translate-y-[-2px] hover:bg-slate-900 group ${gradient}`}
  >
    <div className="flex flex-row items-center justify-between space-y-0 pb-4">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 group-hover:border-slate-600 transition-colors">
        {icon}
      </div>
    </div>
    <div
      className={`text-3xl font-bold tracking-tight ${valueClassName ?? 'text-white'}`}
    >
      {value}
    </div>
    {hint && (
      <p className="text-[11px] text-slate-500 mt-2">{hint}</p>
    )}
    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/5 blur-2xl rounded-full group-hover:bg-white/10 transition-all" />
  </div>
);

export const RHDashboardCards: React.FC = () => {
  const [metrics, setMetrics] = useState<RHMetrics>({
    newCandidatesToday: 0,
    interviewsWeek: 0,
    attendanceRate30d: null,
    avgTimeToQualifyMin: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        const last30dStart = new Date(now);
        last30dStart.setDate(last30dStart.getDate() - 30);

        const todayStr = now.toISOString().slice(0, 10);
        const endWeekStr = endOfWeek.toISOString().slice(0, 10);

        const [
          newContactsRes,
          interviewsRes,
          past30dInterviewsRes,
          stagesRes,
        ] = await Promise.all([
          supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startOfDay.toISOString()),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .ilike('type', `${INTERVIEW_PREFIX}%`)
            .gte('date', todayStr)
            .lte('date', endWeekStr),
          supabase
            .from('appointments')
            .select('id, status, date')
            .ilike('type', `${INTERVIEW_PREFIX}%`)
            .gte('date', last30dStart.toISOString().slice(0, 10))
            .lt('date', todayStr),
          supabase
            .from('pipeline_stages')
            .select('id, title')
            .ilike('title', '%qualif%'),
        ]);

        let attendanceRate: number | null = null;
        if (past30dInterviewsRes.data && past30dInterviewsRes.data.length > 0) {
          const total = past30dInterviewsRes.data.length;
          const attended = past30dInterviewsRes.data.filter(
            (a: any) => a.status === 'compareceu',
          ).length;
          attendanceRate = total > 0 ? attended / total : null;
        }

        let avgQualifyMin: number | null = null;
        const qualifyStageIds = (stagesRes.data ?? [])
          .filter((s: any) => /qualif/i.test(s.title) && !/desqualif/i.test(s.title))
          .map((s: any) => s.id);
        if (qualifyStageIds.length > 0) {
          const { data: dealsData } = await supabase
            .from('deals')
            .select('id, contact_id, stage_id, updated_at, created_at, contact:contacts(first_contact_date)')
            .in('stage_id', qualifyStageIds)
            .gte('updated_at', last30dStart.toISOString());

          if (dealsData && dealsData.length > 0) {
            const diffs: number[] = [];
            for (const d of dealsData as any[]) {
              const start = d.contact?.first_contact_date
                ? new Date(d.contact.first_contact_date).getTime()
                : new Date(d.created_at).getTime();
              const end = new Date(d.updated_at).getTime();
              const min = (end - start) / 1000 / 60;
              if (min > 0 && min < 60 * 24 * 30) diffs.push(min);
            }
            if (diffs.length > 0) {
              avgQualifyMin = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            }
          }
        }

        if (cancelled) return;
        setMetrics({
          newCandidatesToday: newContactsRes.count ?? 0,
          interviewsWeek: interviewsRes.count ?? 0,
          attendanceRate30d: attendanceRate,
          avgTimeToQualifyMin: avgQualifyMin,
          loading: false,
        });
      } catch (e) {
        console.error('[RHDashboardCards] load error', e);
        if (!cancelled) {
          setMetrics((m) => ({ ...m, loading: false }));
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (metrics.loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        Carregando indicadores RH...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">Indicadores RH</h3>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<UserPlus className="h-5 w-5 text-violet-400" />}
          label="Novos candidatos hoje"
          value={metrics.newCandidatesToday}
          hint="Contatos criados nas últimas 24h"
          gradient="from-violet-500/20 to-violet-500/5 border-violet-500/20"
        />
        <Card
          icon={<CalendarCheck className="h-5 w-5 text-cyan-400" />}
          label="Entrevistas agendadas (semana)"
          value={metrics.interviewsWeek}
          hint="Próximos 7 dias"
          gradient="from-cyan-500/20 to-cyan-500/5 border-cyan-500/20"
        />
        <Card
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          label="Taxa de comparecimento (30d)"
          value={fmtPercent(metrics.attendanceRate30d)}
          hint="Meta: ≥ 75%"
          valueClassName={`${attendanceTier(metrics.attendanceRate30d)}`}
          gradient="from-emerald-500/20 to-emerald-500/5 border-emerald-500/20"
        />
        <Card
          icon={<Clock className="h-5 w-5 text-amber-400" />}
          label="Tempo até qualificação"
          value={fmtMinutes(metrics.avgTimeToQualifyMin)}
          hint="Meta: < 15 min"
          valueClassName={`${qualifyTier(metrics.avgTimeToQualifyMin)}`}
          gradient="from-amber-500/20 to-amber-500/5 border-amber-500/20"
        />
      </div>
    </div>
  );
};

export default RHDashboardCards;
