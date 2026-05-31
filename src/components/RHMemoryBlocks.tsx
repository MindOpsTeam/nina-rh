import React from 'react';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Calendar,
  Globe,
  Languages,
  MapPin,
  Wallet,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/formatters';

interface RHMemoryBlocksProps {
  memory?: Record<string, any> | null;
}

const fmtCurrency = (v?: number | null) => {
  if (v == null) return null;
  return formatCurrencyBRL(v);
};

const fmtSalary = (min?: number | null, max?: number | null) => {
  const a = fmtCurrency(min);
  const b = fmtCurrency(max);
  if (a && b) return `${a} – ${b}`;
  if (a) return `A partir de ${a}`;
  if (b) return `Até ${b}`;
  return null;
};

const fmtDisponibilidade = (dias?: number | string | null) => {
  if (dias == null || dias === '') return null;
  const n = typeof dias === 'string' ? parseInt(dias, 10) : dias;
  if (Number.isNaN(n)) return String(dias);
  if (n <= 7) return 'Imediata';
  if (n <= 30) return 'Em até 30 dias';
  if (n <= 60) return 'Em até 60 dias';
  return '60+ dias';
};

const Block: React.FC<{
  title: string;
  icon: React.ReactNode;
  empty?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, empty, children }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
      {icon}
      {title}
    </div>
    {empty ? (
      <p className="text-xs text-slate-600 italic">
        Nina ainda não coletou
      </p>
    ) : (
      <div className="text-sm text-slate-200">{children}</div>
    )}
  </div>
);

export const RHMemoryBlocks: React.FC<RHMemoryBlocksProps> = ({ memory }) => {
  const m = memory ?? {};

  const experiencia = m.experiencia ?? m.experience ?? null;
  const pretensao =
    m.pretensao_salarial ?? m.pretensaoSalarial ?? m.salary_expectation ?? null;
  const disponibilidade =
    m.disponibilidade ?? m.availability ?? m.disponibilidade_inicio ?? null;
  const modalidade =
    m.modalidade_preferida ?? m.modalidade ?? m.preferred_modality ?? null;
  const localizacao = m.localizacao ?? m.location ?? m.cidade_estado ?? null;
  const idiomas: any[] = Array.isArray(m.idiomas) ? m.idiomas : [];
  const certificacoes: any[] = Array.isArray(m.certificacoes)
    ? m.certificacoes
    : Array.isArray(m.certifications)
      ? m.certifications
      : [];
  const redFlag = m.red_flag ?? m.redFlag ?? null;

  const hasExperiencia =
    experiencia &&
    (experiencia.anos != null ||
      (Array.isArray(experiencia.areas) && experiencia.areas.length > 0));
  const salaryStr = pretensao
    ? fmtSalary(pretensao.min ?? pretensao.minimo, pretensao.max ?? pretensao.maximo)
    : null;
  const dispStr =
    disponibilidade != null
      ? fmtDisponibilidade(
          disponibilidade.inicio_dias ??
            disponibilidade.dias ??
            disponibilidade,
        )
      : null;
  const modContrato: string[] = modalidade?.contrato ?? modalidade?.contracts ?? [];
  const modRegime: string[] = modalidade?.regime ?? modalidade?.regimes ?? [];
  const locStr: string | null =
    typeof localizacao === 'string'
      ? localizacao
      : localizacao
        ? [localizacao.cidade, localizacao.estado, localizacao.uf]
            .filter(Boolean)
            .join(' – ') || null
        : null;

  return (
    <div className="space-y-3">
      {redFlag && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">
              Red Flag
            </p>
            <p className="text-sm text-red-200">
              {typeof redFlag === 'string'
                ? redFlag
                : redFlag.tipo ?? redFlag.type ?? 'sinalizado'}
            </p>
            {redFlag?.detalhe && (
              <p className="text-xs text-red-300/70 mt-1">{redFlag.detalhe}</p>
            )}
          </div>
        </div>
      )}

      <Block
        title="Experiência"
        icon={<Briefcase className="w-3 h-3" />}
        empty={!hasExperiencia}
      >
        {hasExperiencia && (
          <div className="space-y-1">
            {experiencia.anos != null && (
              <p>
                <span className="text-slate-400">Anos:</span>{' '}
                <span className="font-medium">{experiencia.anos}</span>
              </p>
            )}
            {Array.isArray(experiencia.areas) && experiencia.areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {experiencia.areas.map((a: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Block>

      <Block
        title="Pretensão salarial"
        icon={<Wallet className="w-3 h-3" />}
        empty={!salaryStr}
      >
        {salaryStr}
      </Block>

      <Block
        title="Disponibilidade"
        icon={<Calendar className="w-3 h-3" />}
        empty={!dispStr}
      >
        {dispStr}
      </Block>

      <Block
        title="Modalidade preferida"
        icon={<Globe className="w-3 h-3" />}
        empty={modContrato.length === 0 && modRegime.length === 0}
      >
        <div className="flex flex-wrap gap-1.5">
          {modContrato.map((c, i) => (
            <span
              key={`c-${i}`}
              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20"
            >
              {String(c).toUpperCase()}
            </span>
          ))}
          {modRegime.map((r, i) => (
            <span
              key={`r-${i}`}
              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
            >
              {r}
            </span>
          ))}
        </div>
      </Block>

      <Block title="Localização" icon={<MapPin className="w-3 h-3" />} empty={!locStr}>
        {locStr}
      </Block>

      {idiomas.length > 0 && (
        <Block title="Idiomas" icon={<Languages className="w-3 h-3" />}>
          <ul className="space-y-1">
            {idiomas.map((it: any, i: number) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{it.nome ?? it.name}</span>
                {it.nivel || it.level ? (
                  <span className="text-slate-500"> — {it.nivel ?? it.level}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {certificacoes.length > 0 && (
        <Block title="Certificações" icon={<Award className="w-3 h-3" />}>
          <ul className="space-y-1">
            {certificacoes.map((c: any, i: number) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{c.nome ?? c.name}</span>
                {c.ano || c.year ? (
                  <span className="text-slate-500"> — {c.ano ?? c.year}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
};

export default RHMemoryBlocks;
