// F6b — Edge Function: dispatcha lembretes de pré-entrevista (D-1 e D-0)
// chamando Meta Cloud API HSM DIRETAMENTE (não usa whatsapp-sender — off-limits).
// Lê configs por owner em nina_settings; per-owner secrets vivem ali
// (whatsapp_phone_number_id + whatsapp_access_token).
//
// Body: { action: 'dispatch_d1' | 'dispatch_d0' }
//
// Lógica D-1: appointments com starts_at em (now + lead_hours ±30min), status candidato a lembrete, reminder_d1_sent_at IS NULL.
// Lógica D-0: appointments com starts_at HOJE (TZ America/Sao_Paulo), reminder_d0_sent_at IS NULL.
//
// Concorrência: pg_try_advisory_xact_lock(hashtext(appointment.id::text)::bigint) por appointment;
// implementado via RPC inline (SELECT pg_try_advisory_lock(...)).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API = "https://graph.facebook.com/v18.0";
const TZ = "America/Sao_Paulo";

type Action = 'dispatch_d1' | 'dispatch_d0';

interface NinaSettings {
  user_id: string | null;
  reminder_enabled: boolean;
  reminder_lead_hours: number;
  reminder_d0_enabled: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token: string | null;
}

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  is_blocked: boolean | null;
  reminder_enabled: boolean | null;
  reminder_quiet_hours_start: string | null;
  reminder_quiet_hours_end: string | null;
}

interface AppointmentRow {
  id: string;
  contact_id: string;
  conversation_id?: string | null;
  starts_at: string;
  vacancy_id: string | null;
  recruiter_id: string | null;
  status: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const { requireServiceRole } = await import("../_shared/auth.ts");
  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: { action?: Action };
  try {
    body = await req.json();
  } catch {
    return jsonErr(corsHeaders, 'invalid_body', 400);
  }
  const action = body.action;
  if (action !== 'dispatch_d1' && action !== 'dispatch_d0') {
    return jsonErr(corsHeaders, 'invalid_action', 400);
  }

  console.log(`[reminder-dispatcher] action=${action}`);

  // 1) Por owner (nina_settings)
  const { data: ownersRaw, error: ownersErr } = await supabase
    .from('nina_settings')
    .select('user_id, reminder_enabled, reminder_lead_hours, reminder_d0_enabled, whatsapp_phone_number_id, whatsapp_access_token');

  if (ownersErr) {
    console.error('[reminder-dispatcher] error loading nina_settings:', ownersErr);
    return jsonErr(corsHeaders, ownersErr.message, 500);
  }

  const owners = (ownersRaw || []) as NinaSettings[];
  let totalProcessed = 0;
  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const owner of owners) {
    if (!owner.reminder_enabled) {
      console.log(`[reminder-dispatcher] owner=${owner.user_id} reminders disabled, skipping`);
      continue;
    }
    if (action === 'dispatch_d0' && !owner.reminder_d0_enabled) {
      console.log(`[reminder-dispatcher] owner=${owner.user_id} D-0 disabled, skipping`);
      continue;
    }
    if (!owner.whatsapp_phone_number_id || !owner.whatsapp_access_token) {
      console.warn(`[reminder-dispatcher] owner=${owner.user_id} missing whatsapp credentials, skipping`);
      continue;
    }

    const apts = await loadAppointments(supabase, owner, action);
    console.log(`[reminder-dispatcher] owner=${owner.user_id} apts=${apts.length}`);

    // F #1 review fix: paraleliza o processamento dos appointments do owner.
    // Lock advisory + re-check guard ficam DENTRO de processAppointment, então
    // dedup concorrencial entre runs do dispatcher continua valendo.
    totalProcessed += apts.length;
    const results = await Promise.allSettled(
      apts.map((apt) => processAppointment(supabase, apt, owner, action)),
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        if (r.value.status === 'sent') totalSent++;
        else if (r.value.status === 'error') totalErrors++;
        else totalSkipped++;
      } else {
        totalErrors++;
        console.error(`[reminder-dispatcher] dispatch rejected apt=${apts[i]?.id}:`, r.reason);
      }
    }
  }

  console.log(`[reminder-dispatcher] done action=${action} processed=${totalProcessed} sent=${totalSent} skipped=${totalSkipped} errors=${totalErrors}`);
  return new Response(
    JSON.stringify({ action, processed: totalProcessed, sent: totalSent, skipped: totalSkipped, errors: totalErrors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

// ----------------------------------------------------------------------------
// F #1 review fix: corpo do loop extraído pra rodar paralelo via Promise.allSettled.
async function processAppointment(
  supabase: any,
  apt: AppointmentRow,
  owner: NinaSettings,
  action: Action,
): Promise<{ status: 'sent' | 'skipped' | 'error'; reason?: string }> {
  try {
    // Concurrency: per-appointment advisory lock via RPC helper
    // (nina_try_lock_appointment usa pg_try_advisory_xact_lock(hashtext(id)::bigint))
    const { data: lockAcquired } = await supabase
      .rpc('nina_try_lock_appointment', { p_appointment_id: apt.id } as any);
    if (lockAcquired === false) {
      console.log(`[reminder-dispatcher] apt=${apt.id} lock contention, skipping`);
      return { status: 'skipped', reason: 'lock_contention' };
    }

    // Re-check guard: outro dispatcher pode ter marcado sent_at entre o load e o lock.
    const guardCol = action === 'dispatch_d1' ? 'reminder_d1_sent_at' : 'reminder_d0_sent_at';
    const { data: fresh } = await supabase
      .from('appointments')
      .select(`id, ${guardCol}`)
      .eq('id', apt.id)
      .maybeSingle();
    if (fresh && (fresh as any)[guardCol]) {
      return { status: 'skipped', reason: 'already_sent' };
    }

    // Contact gate
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone_number, is_blocked, reminder_enabled, reminder_quiet_hours_start, reminder_quiet_hours_end')
      .eq('id', apt.contact_id)
      .maybeSingle();

    if (!contact) return { status: 'skipped', reason: 'contact_not_found' };
    const c = contact as ContactRow;
    if (c.is_blocked || c.reminder_enabled === false) {
      return { status: 'skipped', reason: 'contact_disabled' };
    }
    if (isInQuietHours(c.reminder_quiet_hours_start, c.reminder_quiet_hours_end)) {
      console.log(`[reminder-dispatcher] apt=${apt.id} contact ${c.id} in quiet hours, skipping`);
      return { status: 'skipped', reason: 'quiet_hours' };
    }

    // Resolve vacancy + recruiter
    const [vacancyRes, recruiterRes] = await Promise.all([
      apt.vacancy_id
        ? supabase.from('vacancies').select('titulo').eq('id', apt.vacancy_id).maybeSingle()
        : Promise.resolve({ data: null }),
      apt.recruiter_id
        ? supabase.from('team_members').select('name').eq('id', apt.recruiter_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const vacancyTitle = (vacancyRes as any).data?.titulo || 'a vaga';
    // Recruiter name (reservado p/ templates customs futuras)
    const _recruiterName = (recruiterRes as any).data?.name || '';

    // Resolve template (owner override → seed fallback)
    const templateName = action === 'dispatch_d1' ? 'interview_reminder_d1' : 'interview_reminder_d0';
    const template = await resolveTemplate(supabase, owner.user_id, templateName);
    if (!template) {
      console.warn(`[reminder-dispatcher] template ${templateName} not found for owner ${owner.user_id}`);
      return { status: 'skipped', reason: 'template_missing' };
    }

    // Variables
    const { dataPtBr, horaPtBr } = formatDateTimePtBr(apt.starts_at);
    const firstName = (c.name || 'tudo bem').split(/\s+/)[0];
    const params =
      action === 'dispatch_d1'
        ? [firstName, vacancyTitle, dataPtBr, horaPtBr]
        : [firstName, vacancyTitle, horaPtBr];

    // Call Meta HSM
    const metaResp = await sendMetaHsm({
      phoneNumberId: owner.whatsapp_phone_number_id!,
      accessToken: owner.whatsapp_access_token!,
      to: c.phone_number,
      templateName: template.name,
      language: template.language || 'pt_BR',
      bodyParams: params,
    });

    if (!metaResp.ok) {
      console.error(`[reminder-dispatcher] meta error apt=${apt.id}:`, metaResp.status, metaResp.error);
      return { status: 'error', reason: `meta_${metaResp.status}` };
    }

    // Mark sent
    const patch: Record<string, any> = {};
    if (action === 'dispatch_d1') patch.reminder_d1_sent_at = new Date().toISOString();
    else patch.reminder_d0_sent_at = new Date().toISOString();

    const { error: updErr } = await supabase
      .from('appointments')
      .update(patch)
      .eq('id', apt.id);

    if (updErr) {
      console.error(`[reminder-dispatcher] update apt=${apt.id} error:`, updErr);
      return { status: 'error', reason: 'db_update' };
    }

    // Audit em send_queue (best-effort, não-fatal)
    if (apt.conversation_id) {
      await supabase
        .from('send_queue')
        .insert({
          conversation_id: apt.conversation_id,
          contact_id: c.id,
          message_type: 'template',
          from_type: 'nina',
          content: `[HSM ${template.name}] params=${JSON.stringify(params)}`,
          status: 'completed',
          priority: 1,
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          metadata: {
            source: 'reminder_dispatcher',
            action,
            appointment_id: apt.id,
            template_name: template.name,
            meta_message_id: metaResp.metaMessageId || null,
          },
        })
        .then(({ error }: any) => {
          if (error) console.warn('[reminder-dispatcher] audit send_queue insert error (non-fatal):', error.message);
        });
    }

    console.log(`[reminder-dispatcher] sent apt=${apt.id} template=${template.name}`);
    return { status: 'sent' };
  } catch (e: any) {
    console.error(`[reminder-dispatcher] unexpected error apt=${apt.id}:`, e);
    return { status: 'error', reason: e?.message || 'unknown' };
  }
}

// ----------------------------------------------------------------------------
async function loadAppointments(
  supabase: any,
  owner: NinaSettings,
  action: Action,
): Promise<AppointmentRow[]> {
  const statusList = ['agendado', 'agendamento_pendente', 'confirmado', 'scheduled'];
  const select = 'id, contact_id, conversation_id, starts_at, vacancy_id, recruiter_id, status, user_id';

  if (action === 'dispatch_d1') {
    const leadHours = owner.reminder_lead_hours || 24;
    const now = Date.now();
    const targetMs = now + leadHours * 3600_000;
    const halfWindow = 30 * 60_000;
    const fromIso = new Date(targetMs - halfWindow).toISOString();
    const toIso = new Date(targetMs + halfWindow).toISOString();

    let query = supabase
      .from('appointments')
      .select(select)
      .in('status', statusList)
      .is('reminder_d1_sent_at', null)
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso);

    if (owner.user_id) query = query.eq('user_id', owner.user_id);
    const { data, error } = await query;
    if (error) {
      console.error('[reminder-dispatcher] loadAppointments D1 error:', error);
      return [];
    }
    return (data || []) as AppointmentRow[];
  }

  // D-0: HOJE no TZ São Paulo → janela [hoje 00:00 BRT, amanhã 00:00 BRT)
  const { startIso, endIso } = todayWindowSp();
  let query = supabase
    .from('appointments')
    .select(select)
    .in('status', statusList)
    .is('reminder_d0_sent_at', null)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso);

  if (owner.user_id) query = query.eq('user_id', owner.user_id);
  const { data, error } = await query;
  if (error) {
    console.error('[reminder-dispatcher] loadAppointments D0 error:', error);
    return [];
  }
  return (data || []) as AppointmentRow[];
}

async function resolveTemplate(
  supabase: any,
  ownerId: string | null,
  name: string,
): Promise<{ name: string; body: string; language: string } | null> {
  // Owner override
  if (ownerId) {
    const { data: ownerTpl } = await supabase
      .from('message_templates')
      .select('name, body, language')
      .eq('name', name)
      .eq('user_id', ownerId)
      .maybeSingle();
    if (ownerTpl) return ownerTpl as any;
  }
  // Seed fallback
  const { data: seedTpl } = await supabase
    .from('message_templates')
    .select('name, body, language')
    .eq('name', name)
    .eq('is_seed', true)
    .is('user_id', null)
    .maybeSingle();
  return (seedTpl as any) || null;
}

async function sendMetaHsm(args: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
}): Promise<{ ok: boolean; status?: number; error?: string; metaMessageId?: string }> {
  const url = `${META_API}/${args.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: args.to,
    type: 'template',
    template: {
      name: args.templateName,
      language: { code: args.language },
      components: [
        {
          type: 'body',
          parameters: args.bodyParams.map((p) => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, status: resp.status, error: txt.slice(0, 500) };
    }
    const j = await resp.json();
    const metaMessageId = j?.messages?.[0]?.id;
    return { ok: true, metaMessageId };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function isInQuietHours(startStr: string | null, endStr: string | null): boolean {
  if (!startStr || !endStr) return false;
  const nowParts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hh = parseInt(nowParts.find((p) => p.type === 'hour')!.value, 10);
  const mm = parseInt(nowParts.find((p) => p.type === 'minute')!.value, 10);
  const now = hh * 60 + mm;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false;
  if (s < e) return now >= s && now < e;
  // wraparound (ex: 22:00 → 08:00)
  return now >= s || now < e;
}

function formatDateTimePtBr(iso: string): { dataPtBr: string; horaPtBr: string } {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { dataPtBr: data, horaPtBr: hora };
}

function todayWindowSp(): { startIso: string; endIso: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  // 00:00 e 24:00 em BRT → UTC: BRT é UTC-3 (sem horário de verão atual).
  // Construímos como Date no offset -03:00 para serializar correto independente do host.
  const startIso = new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString();
  const endIso = new Date(`${y}-${m}-${d}T24:00:00-03:00`).toISOString();
  return { startIso, endIso };
}

function jsonErr(corsHeaders: Record<string, string>, msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
