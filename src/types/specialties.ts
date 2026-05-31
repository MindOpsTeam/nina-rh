import { z } from 'zod';

export type SpecialtyCategory =
  | 'tecnologia'
  | 'comercial'
  | 'marketing'
  | 'financeiro'
  | 'rh'
  | 'operacoes'
  | 'juridico'
  | 'outros';

export interface SpecialtyRh {
  id: string;
  slug: string;
  name: string;
  category: string;
  is_seed: boolean;
  user_id: string | null;
  created_at: string;
}

export const SPECIALTY_CATEGORY_LABELS: Record<string, string> = {
  tecnologia: 'Tecnologia',
  comercial: 'Comercial',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  rh: 'RH',
  operacoes: 'Operações',
  juridico: 'Jurídico',
  outros: 'Outros',
};

export const SpecialtyCustomSchema = z.object({
  name: z.string().trim().min(2, 'Nome obrigatório'),
  category: z.string().trim().min(2, 'Categoria obrigatória'),
});

export type SpecialtyCustomInput = z.infer<typeof SpecialtyCustomSchema>;

export function slugify(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
