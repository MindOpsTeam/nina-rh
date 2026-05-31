import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Resume } from '@/types/resumes';

// resumes table foi criada na F10.5; ainda não está nos tipos gerados.
const supabase = supabaseClient as any;
const TABLE = 'resumes';

export interface SignedUploadResponse {
  upload_url: string;
  resume_id: string;
  file_path: string;
  expires_in: number;
}

export const resumesApi = {
  async listByContact(contact_id: string): Promise<Resume[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Resume[];
  },

  async getById(id: string): Promise<Resume | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Resume) || null;
  },

  async requestUploadFor(args: {
    contact_id: string;
    vacancy_id?: string;
    file_name: string;
    mime_type: string;
  }): Promise<SignedUploadResponse> {
    const { data, error } = await supabaseClient.functions.invoke('signed-upload-url', {
      body: args,
    });
    if (error) throw error;
    return data as SignedUploadResponse;
  },

  async triggerParse(resume_id: string): Promise<{ resume_id: string; parse_status: string }> {
    const { data, error } = await supabaseClient.functions.invoke('parse-resume', {
      body: { resume_id },
    });
    if (error) throw error;
    return data;
  },

  async downloadOriginal(file_path: string): Promise<string> {
    const { data, error } = await (supabaseClient.storage.from('resumes') as any)
      .createSignedUrl(file_path, 600);
    if (error) throw error;
    return (data as any).signedUrl || (data as any).signed_url;
  },

  async remove(id: string, file_path?: string): Promise<void> {
    if (file_path) {
      try {
        await (supabaseClient.storage.from('resumes') as any).remove([file_path]);
      } catch (e) {
        console.warn('[resumesApi.remove] storage delete non-fatal:', e);
      }
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
