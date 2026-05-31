import { supabase as supabaseClient } from '@/integrations/supabase/client';

const supabase = supabaseClient as any;

export interface ReminderSettings {
  id: string;
  reminder_enabled: boolean;
  reminder_lead_hours: number;
  reminder_dispatch_hour: number;
  reminder_d0_enabled: boolean;
  reminder_d0_hour: number;
}

export type ReminderSettingsUpdate = Omit<ReminderSettings, 'id'>;

export const reminderSettingsApi = {
  async get(): Promise<ReminderSettings | null> {
    const { data, error } = await supabase
      .from('nina_settings')
      .select(
        'id, reminder_enabled, reminder_lead_hours, reminder_dispatch_hour, reminder_d0_enabled, reminder_d0_hour',
      )
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as ReminderSettings | null;
  },

  async update(patch: Partial<ReminderSettingsUpdate>): Promise<ReminderSettings> {
    const current = await reminderSettingsApi.get();
    if (!current?.id) {
      throw new Error('nina_settings ainda não inicializado. Complete o onboarding.');
    }
    const { data, error } = await supabase
      .from('nina_settings')
      .update(patch)
      .eq('id', current.id)
      .select(
        'id, reminder_enabled, reminder_lead_hours, reminder_dispatch_hour, reminder_d0_enabled, reminder_d0_hour',
      )
      .single();
    if (error) throw error;
    return data as ReminderSettings;
  },
};
