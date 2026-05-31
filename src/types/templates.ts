import { z } from 'zod';

export type MessageTemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type MessageTemplateLanguage = 'pt_BR' | 'en_US' | 'es_ES';

export interface MessageTemplate {
  id: string;
  user_id: string | null;
  name: string;
  category: MessageTemplateCategory;
  language: MessageTemplateLanguage;
  body: string;
  variables_count: number;
  is_seed: boolean;
  meta_template_id: string | null;
  meta_status: string | null;
  meta_status_synced_at: string | null;
  meta_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_OPTIONS: {
  value: MessageTemplateCategory;
  label: string;
  hint: string;
}[] = [
  { value: 'UTILITY', label: 'Utility', hint: 'Lembretes, confirmações, atualizações de pedido' },
  { value: 'MARKETING', label: 'Marketing', hint: 'Promoções, novidades, divulgação' },
  { value: 'AUTHENTICATION', label: 'Authentication', hint: 'Códigos OTP, verificação de identidade' },
];

export const LANGUAGE_OPTIONS: {
  value: MessageTemplateLanguage;
  label: string;
}[] = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'Inglês (US)' },
  { value: 'es_ES', label: 'Espanhol (ES)' },
];

export const categoryLabels: Record<MessageTemplateCategory, string> = {
  UTILITY: 'Utility',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Authentication',
};

export const languageLabels: Record<MessageTemplateLanguage, string> = {
  pt_BR: 'pt_BR',
  en_US: 'en_US',
  es_ES: 'es_ES',
};

const NAME_REGEX = /^[a-z0-9_]+$/;

export const TemplateFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nome obrigatório')
      .max(512, 'Máx 512 caracteres')
      .regex(NAME_REGEX, 'Use apenas minúsculas, números e _ (underscore)'),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
    language: z.enum(['pt_BR', 'en_US', 'es_ES']),
    body: z
      .string()
      .min(1, 'Corpo obrigatório')
      .max(1024, 'Máx 1024 caracteres'),
  })
  .superRefine((data, ctx) => {
    const detected = detectVariables(data.body);
    if (detected.gaps.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: `Variáveis com gap: faltam ${detected.gaps.map((g) => `{{${g}}}`).join(', ')}`,
      });
    }
    // F10b: Meta requer URL via button component, não inline no body.
    if (/https?:\/\//i.test(data.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'URLs (http:// ou https://) não são permitidas no corpo. Use um botão de link via Meta.',
      });
    }
  });

export type TemplateFormInput = z.infer<typeof TemplateFormSchema>;

export interface DetectedVariables {
  numbers: number[];
  max: number;
  gaps: number[];
}

export const detectVariables = (body: string): DetectedVariables => {
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > 0) set.add(n);
  }
  const numbers = Array.from(set).sort((a, b) => a - b);
  const max = numbers.length === 0 ? 0 : numbers[numbers.length - 1];
  const gaps: number[] = [];
  for (let i = 1; i <= max; i++) {
    if (!set.has(i)) gaps.push(i);
  }
  return { numbers, max, gaps };
};

const EXAMPLES = [
  'João',
  'Frontend Sr',
  '28/05/2026',
  '14:00',
  'Equipe RH',
  '5511999999999',
  'Hospital São Lucas',
  'Remoto',
];

export const renderTemplatePreview = (body: string): string => {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const idx = parseInt(n, 10) - 1;
    return EXAMPLES[idx] ?? `[var${n}]`;
  });
};
