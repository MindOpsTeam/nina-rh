import { supabase as supabaseClient } from '@/integrations/supabase/client';
import {
  detectVariables,
  type MessageTemplate,
  type TemplateFormInput,
} from '@/types/templates';

// message_templates is added in F6 but not yet present in generated supabase types.
const supabase = supabaseClient as any;
const TABLE = 'message_templates';

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
};

export const templatesApi = {
  async list(): Promise<MessageTemplate[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('is_seed', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MessageTemplate[];
  },

  async create(input: TemplateFormInput): Promise<MessageTemplate> {
    const userId = await getCurrentUserId();
    const detected = detectVariables(input.body);
    const payload = {
      user_id: userId,
      name: input.name.trim(),
      category: input.category,
      language: input.language,
      body: input.body,
      variables_count: detected.max,
      is_seed: false,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as MessageTemplate;
  },

  async update(
    id: string,
    patch: Partial<TemplateFormInput>,
  ): Promise<MessageTemplate> {
    const updatePayload: Record<string, any> = { ...patch };
    if (patch.body !== undefined) {
      updatePayload.variables_count = detectVariables(patch.body).max;
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as MessageTemplate;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  // F10b — Meta integrations via Edge Function whatsapp-templates-sync
  async submitToMeta(template_id: string): Promise<{
    template_id: string;
    meta_template_id: string | null;
    meta_status: string;
  }> {
    const { data, error } = await supabaseClient.functions.invoke('whatsapp-templates-sync', {
      body: { action: 'submit', template_id },
    });
    if (error) {
      // Edge Function não-2xx → tenta extrair payload estruturado
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const j = await ctx.json();
          if (j?.error) throw j;
        } catch (inner: any) {
          if (inner?.error) throw inner;
        }
      }
      throw error;
    }
    return data;
  },

  async syncStatusFromMeta(template_id?: string): Promise<{ synced: number; errors: number; warning?: string }> {
    const { data, error } = await supabaseClient.functions.invoke('whatsapp-templates-sync', {
      body: template_id ? { action: 'sync-status', template_id } : { action: 'sync-status' },
    });
    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const j = await ctx.json();
          if (j?.error) throw j;
        } catch (inner: any) {
          if (inner?.error) throw inner;
        }
      }
      throw error;
    }
    return data;
  },

  async deleteFromMeta(template_id: string): Promise<{ template_id: string; deleted: boolean }> {
    const { data, error } = await supabaseClient.functions.invoke('whatsapp-templates-sync', {
      body: { action: 'delete', template_id },
    });
    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const j = await ctx.json();
          if (j?.error) throw j;
        } catch (inner: any) {
          if (inner?.error) throw inner;
        }
      }
      throw error;
    }
    return data;
  },

  async cloneSeed(seedId: string): Promise<MessageTemplate> {
    const { data: seed, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', seedId)
      .maybeSingle();
    if (error) throw error;
    if (!seed) throw new Error('Template seed não encontrado');

    const baseName = `${seed.name}_custom`;
    const userId = await getCurrentUserId();

    const { data: existing } = await supabase
      .from(TABLE)
      .select('name')
      .eq('user_id', userId)
      .like('name', `${baseName}%`);
    const existingNames: string[] = (existing ?? []).map((x: any) => x.name);
    let name = baseName;
    let n = 2;
    while (existingNames.includes(name)) {
      name = `${baseName}_${n++}`;
    }

    return templatesApi.create({
      name,
      category: seed.category,
      language: seed.language,
      body: seed.body,
    });
  },
};
