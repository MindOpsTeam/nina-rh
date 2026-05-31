import { z } from 'zod';

export type ModalidadeOperacao = 'rh_interno' | 'agencia' | 'freelancer';
export type TipoContratacao = 'clt' | 'pj' | 'estagio' | 'freelance';

export interface UnavailableSlotFullDay {
  kind: 'full_day';
  date: string; // YYYY-MM-DD
  note?: string;
}

export interface UnavailableSlotRange {
  kind: 'range';
  start: string; // ISO datetime
  end: string;   // ISO datetime
  note?: string;
}

export interface UnavailableSlotDaily {
  kind: 'daily';
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  weekdays: number[];       // 0=sun..6=sat
  note?: string;
}

export type UnavailableSlot =
  | UnavailableSlotFullDay
  | UnavailableSlotRange
  | UnavailableSlotDaily;

export interface Recruiter {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  status: 'active' | 'invited' | 'disabled';
  modalidade_operacao: ModalidadeOperacao;
  registro_profissional: string | null;
  specialty_slugs: string[];
  tipos_contratacao: TipoContratacao[];
  bio: string | null;
  vacancy_ids: string[];
  unavailable_slots: UnavailableSlot[];
  role: 'admin' | 'manager' | 'agent';
  team_id?: string | null;
  function_id?: string | null;
  weight?: number;
  avatar?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const MODALIDADE_OPERACAO_OPTIONS: { value: ModalidadeOperacao; label: string; registroLabel: string }[] = [
  { value: 'rh_interno', label: 'RH interno',                registroLabel: 'CRA / registro profissional' },
  { value: 'agencia',    label: 'Agência',                   registroLabel: 'CNPJ da agência' },
  { value: 'freelancer', label: 'Headhunter freelancer',     registroLabel: 'CPF / MEI' },
];

export const TIPO_CONTRATACAO_OPTIONS: { value: TipoContratacao; label: string }[] = [
  { value: 'clt',       label: 'CLT' },
  { value: 'pj',        label: 'PJ' },
  { value: 'estagio',   label: 'Estágio' },
  { value: 'freelance', label: 'Freelance' },
];

const UnavailableFullDaySchema = z.object({
  kind: z.literal('full_day'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data YYYY-MM-DD'),
  note: z.string().optional(),
});
const UnavailableRangeSchema = z.object({
  kind: z.literal('range'),
  start: z.string().min(10),
  end: z.string().min(10),
  note: z.string().optional(),
});
const UnavailableDailySchema = z.object({
  kind: z.literal('daily'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Selecione ao menos um dia'),
  note: z.string().optional(),
});

export const UnavailableSlotSchema = z.discriminatedUnion('kind', [
  UnavailableFullDaySchema,
  UnavailableRangeSchema,
  UnavailableDailySchema,
]);

export const RecruiterFormSchema = z.object({
  name: z.string().trim().min(2, 'Nome obrigatório'),
  email: z.string().trim().email('Email inválido'),
  phone: z.string().trim().optional(),
  modalidade_operacao: z.enum(['rh_interno', 'agencia', 'freelancer']),
  registro_profissional: z.string().trim().optional().nullable(),
  specialty_slugs: z.array(z.string()).default([]),
  tipos_contratacao: z.array(z.enum(['clt', 'pj', 'estagio', 'freelance'])).default([]),
  bio: z.string().optional().nullable(),
  vacancy_ids: z.array(z.string().uuid()).default([]),
  unavailable_slots: z.array(UnavailableSlotSchema).default([]),
});

export type RecruiterFormInput = z.infer<typeof RecruiterFormSchema>;
