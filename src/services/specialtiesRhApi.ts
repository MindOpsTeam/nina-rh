import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { slugify, type SpecialtyRh } from '@/types/specialties';

// specialties_rh table was added in F5a but is not yet in generated supabase types.
const supabase = supabaseClient as any;

const TABLE = 'specialties_rh';

export const specialtiesRhApi = {
  async listAll(): Promise<SpecialtyRh[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as SpecialtyRh[];
  },

  async createCustom(input: { name: string; category: string }): Promise<SpecialtyRh> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const slug = slugify(input.name);
    const payload = {
      slug,
      name: input.name.trim(),
      category: input.category.trim().toLowerCase(),
      is_seed: false,
      user_id: user.id,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as SpecialtyRh;
  },
};
