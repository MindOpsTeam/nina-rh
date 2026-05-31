import { z } from 'zod';

export type VacancyStatus = 'aberta' | 'pausada' | 'fechada';
export type VacancySenioridade = 'junior' | 'pleno' | 'senior' | 'especialista';
export type VacancyModalidade = 'clt' | 'pj' | 'estagio' | 'freelance';
export type VacancyRegime = 'remoto' | 'hibrido' | 'presencial';

export interface Vacancy {
  id: string;
  user_id: string | null;
  titulo: string;
  area: string | null;
  senioridade: VacancySenioridade | null;
  modalidade_contrato: VacancyModalidade[];
  regime_trabalho: VacancyRegime[];
  faixa_salarial_min: number | null;
  faixa_salarial_max: number | null;
  descricao: string | null;
  requirements: string[];
  status: VacancyStatus;
  aceita_pcd: boolean;
  aceita_remoto: boolean;
  created_at: string;
  updated_at: string;
}

export const VACANCY_AREAS = [
  'Saúde',
  'Administrativo',
  'Comercial',
  'Tecnologia',
  'Operacional',
] as const;

export const SENIORIDADE_OPTIONS: { value: VacancySenioridade; label: string }[] = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'especialista', label: 'Especialista' },
];

export const MODALIDADE_OPTIONS: { value: VacancyModalidade; label: string }[] = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'freelance', label: 'Freelance' },
];

export const REGIME_OPTIONS: { value: VacancyRegime; label: string }[] = [
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'presencial', label: 'Presencial' },
];

export const VacancyFormSchema = z
  .object({
    titulo: z.string().trim().min(2, 'Título obrigatório'),
    area: z.string().nullable().optional(),
    senioridade: z
      .enum(['junior', 'pleno', 'senior', 'especialista'])
      .nullable()
      .optional(),
    modalidade_contrato: z
      .array(z.enum(['clt', 'pj', 'estagio', 'freelance']))
      .min(1, 'Selecione ao menos uma modalidade'),
    regime_trabalho: z
      .array(z.enum(['remoto', 'hibrido', 'presencial']))
      .default([]),
    faixa_salarial_min: z.number().nullable().optional(),
    faixa_salarial_max: z.number().nullable().optional(),
    descricao: z.string().nullable().optional(),
    requirements: z.array(z.string().trim().min(1)).default([]),
    status: z.enum(['aberta', 'pausada', 'fechada']).default('aberta'),
    aceita_pcd: z.boolean().default(false),
    aceita_remoto: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.faixa_salarial_min != null && data.faixa_salarial_max != null) {
        return data.faixa_salarial_min <= data.faixa_salarial_max;
      }
      return true;
    },
    { message: 'Mínimo deve ser <= máximo', path: ['faixa_salarial_max'] },
  );

export type VacancyFormInput = z.infer<typeof VacancyFormSchema>;

export interface VacancyFilters {
  status?: VacancyStatus | 'todas';
  modalidade?: VacancyModalidade[];
  senioridade?: VacancySenioridade[];
  area?: string[];
  search?: string;
}

export const formatSalaryRange = (
  min: number | null,
  max: number | null,
): string => {
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  if (max != null) return `Até ${fmt(max)}`;
  return 'A combinar';
};
