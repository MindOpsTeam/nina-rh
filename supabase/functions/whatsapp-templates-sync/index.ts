// F10a — Edge Function: integração de message_templates com Meta Cloud API.
// 3 actions: submit (cria/registra template HSM na Meta), sync-status (atualiza
// meta_status dos templates pending/approved/rejected), delete (remove na Meta + DB).
//
// Cascata auth 2-vias:
//   1) Service role direto (Bearer SUPABASE_SERVICE_ROLE_KEY) — usado também pelo pg_cron
//   2) User JWT (Bearer <user-jwt>)
//
// Off-limits: NÃO usa whatsapp-sender/webhook/grouper. Chama Meta direto via fetch.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonOk, jsonErr } from "../_shared/responses.ts";

const META_API = "https://graph.facebook.com/v18.0";
const TOKEN_SCOPE_ERROR = 'token_lacks_management_scope';

type Action = 'submit' | 'sync-status' | 'delete';
type AuthResult = 'SERVICE_ROLE' | { user_id: string };

interface NinaSettingsRow {
  user_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_access_token: string | null;
}

interface TemplateRow {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  language: string;
  body: string;
  variables_count: number;
  is_seed: boolean;
  meta_template_id: string | null;
  meta_status: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ---- AUTH cascata 3-vias ----
  const authResult = await authenticate(req, supabase);
  if (!authResult) return jsonErr('Unauthorized', 401);

  let body: { action?: Action; template_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid_body', 400);
  }
  const action = body.action;

  console.log(`[wa-templates-sync] action=${action} auth=${typeof authResult === 'string' ? authResult : 'JWT:' + authResult.user_id}`);

  try {
    if (action === 'submit') {
      if (!body.template_id) return jsonErr('missing_template_id', 400);
      return await handleSubmit(supabase, body.template_id, authResult, corsHeaders);
    }
    if (action === 'sync-status') {
      return await handleSyncStatus(supabase, authResult, body.template_id || null, corsHeaders);
    }
    if (action === 'delete') {
      if (!body.template_id) return jsonErr('missing_template_id', 400);
      return await handleDelete(supabase, body.template_id, authResult, corsHeaders);
    }
    return jsonErr('invalid_action', 400);
  } catch (e: any) {
    console.error('[wa-templates-sync] unexpected error:', e);
    return jsonErr(e?.message || String(e), 500);
  }
});

// ----------------------------------------------------------------------------
async function authenticate(req: Request, supabase: SupabaseClient): Promise<AuthResult | null> {
  // 1) Service role direto
  const auth = req.headers.get('Authorization') || req.headers.get('authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (auth && serviceKey && auth === `Bearer ${serviceKey}`) return 'SERVICE_ROLE';

  // 2) User JWT
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
      );
      const { data } = await anonClient.auth.getUser(token);
      if (data?.user) return { user_id: data.user.id };
    } catch {
      // fallthrough
    }
  }

  // pg_cron agora chama com Bearer service_role (ver migration crons_use_app_config),
  // tratado pelo ramo 1. x-cron-secret/CRON_SHARED_SECRET foram removidos.
  return null;
}

async function loadOwnerSettings(
  supabase: SupabaseClient,
  ownerId: string | null,
): Promise<NinaSettingsRow | null> {
  // ownerId NULL → primeiro settings (modo single-tenant fallback)
  let query = supabase
    .from('nina_settings')
    .select('user_id, whatsapp_business_account_id, whatsapp_access_token');

  if (ownerId) query = query.eq('user_id', ownerId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error('[wa-templates-sync] settings load error:', error);
    return null;
  }
  return (data as NinaSettingsRow) || null;
}

async function loadTemplate(supabase: SupabaseClient, id: string): Promise<TemplateRow | null> {
  const { data, error } = await supabase
    .from('message_templates')
    .select('id, user_id, name, category, language, body, variables_count, is_seed, meta_template_id, meta_status')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[wa-templates-sync] template load error:', error);
    return null;
  }
  return (data as TemplateRow) || null;
}

function metaErrorIsScope(status: number, errPayload: string): boolean {
  if (status !== 401 && status !== 403) return false;
  const lower = errPayload.toLowerCase();
  return (
    lower.includes('manage permissions') ||
    lower.includes('whatsapp_business_management') ||
    lower.includes('does not have permission')
  );
}

function buildExamples(variablesCount: number): string[] {
  const pool = ['João Silva', 'Frontend Sr', '28/05/2026', '14:00', 'São Paulo', 'CLT'];
  const slice = pool.slice(0, Math.max(1, variablesCount || 1));
  while (slice.length < (variablesCount || 0)) slice.push('exemplo');
  return slice;
}

// ----------------------------------------------------------------------------
async function handleSubmit(
  supabase: SupabaseClient,
  templateId: string,
  auth: AuthResult,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const tpl = await loadTemplate(supabase, templateId);
  if (!tpl) return jsonErr('template_not_found', 404);
  if (tpl.is_seed) return jsonErr('cannot_submit_seed_template', 400);
  if (!tpl.body || tpl.body.length < 1) return jsonErr('empty_body', 400);

  // Authz: User JWT só pode submeter próprio template
  if (typeof auth !== 'string') {
    if (tpl.user_id && tpl.user_id !== auth.user_id) {
      return jsonErr('forbidden_owner_mismatch', 403);
    }
  }

  const settings = await loadOwnerSettings(supabase, tpl.user_id);
  if (!settings?.whatsapp_business_account_id || !settings?.whatsapp_access_token) {
    return jsonErr('missing_meta_credentials', 400);
  }

  const examples = buildExamples(tpl.variables_count || 0);
  const payload = {
    name: tpl.name,
    category: (tpl.category || 'UTILITY').toUpperCase(),
    language: tpl.language || 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: tpl.body,
        ...(examples.length > 0 ? { example: { body_text: [examples] } } : {}),
      },
    ],
  };

  const url = `${META_API}/${settings.whatsapp_business_account_id}/message_templates`;
  console.log(`[wa-templates-sync] submit ${tpl.name} → Meta ${url}`);

  const metaResp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.whatsapp_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const respText = await metaResp.text();

  if (!metaResp.ok) {
    if (metaErrorIsScope(metaResp.status, respText)) {
      console.warn('[wa-templates-sync] token lacks management scope:', respText);
      return new Response(
        JSON.stringify({
          error: TOKEN_SCOPE_ERROR,
          detail: respText.slice(0, 500),
          meta_status: metaResp.status,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.error('[wa-templates-sync] meta submit error:', metaResp.status, respText);
    return jsonErr(`meta_error_${metaResp.status}: ${respText.slice(0, 300)}`, 502);
  }

  let respJson: any = {};
  try {
    respJson = JSON.parse(respText);
  } catch {
    // shouldn't happen on ok
  }
  const metaTemplateId = respJson?.id || null;

  const { error: updErr } = await supabase
    .from('message_templates')
    .update({
      meta_template_id: metaTemplateId,
      meta_status: 'pending',
      meta_status_synced_at: new Date().toISOString(),
      meta_rejection_reason: null,
    })
    .eq('id', tpl.id);

  if (updErr) {
    console.error('[wa-templates-sync] db update after submit error:', updErr);
    return jsonErr(updErr.message, 500);
  }

  return jsonOk({ template_id: tpl.id, meta_template_id: metaTemplateId, meta_status: 'pending' });
}

// ----------------------------------------------------------------------------
async function handleSyncStatus(
  supabase: SupabaseClient,
  auth: AuthResult,
  onlyTemplateId: string | null,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Coletar templates a sincronizar
  let query = supabase
    .from('message_templates')
    .select('id, user_id, name, meta_template_id, meta_status')
    .not('meta_template_id', 'is', null)
    .in('meta_status', ['pending', 'approved', 'rejected', 'disabled']);

  if (onlyTemplateId) query = query.eq('id', onlyTemplateId);

  // User JWT só vê próprios
  if (typeof auth !== 'string') {
    query = query.eq('user_id', auth.user_id);
  }

  const { data: templatesRaw, error } = await query.limit(500);
  if (error) return jsonErr(error.message, 500);
  const templates = (templatesRaw || []) as Array<Pick<TemplateRow, 'id' | 'user_id' | 'name' | 'meta_template_id' | 'meta_status'>>;

  if (templates.length === 0) {
    return jsonOk({ synced: 0, errors: 0, scoped: typeof auth === 'string' ? auth : 'JWT' });
  }

  // Agrupar por owner (cada owner tem seus settings/WABA)
  const byOwner = new Map<string | null, typeof templates>();
  for (const t of templates) {
    const key = t.user_id;
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(t);
  }

  let synced = 0;
  let errors = 0;
  let scopeWarning: string | null = null;

  for (const [ownerId, batch] of byOwner) {
    const settings = await loadOwnerSettings(supabase, ownerId);
    if (!settings?.whatsapp_business_account_id || !settings?.whatsapp_access_token) {
      console.warn(`[wa-templates-sync] owner=${ownerId} missing credentials, skipping ${batch.length} templates`);
      continue;
    }

    // Meta API permite GET com fields=name,status,rejected_reason; iteramos por chunks de 100
    const chunks: typeof templates[] = [];
    for (let i = 0; i < batch.length; i += 100) chunks.push(batch.slice(i, i + 100));

    for (const chunk of chunks) {
      const url = `${META_API}/${settings.whatsapp_business_account_id}/message_templates?fields=id,name,status,rejected_reason&limit=200`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${settings.whatsapp_access_token}` },
      });
      const txt = await resp.text();

      if (!resp.ok) {
        errors += chunk.length;
        if (metaErrorIsScope(resp.status, txt)) {
          scopeWarning = TOKEN_SCOPE_ERROR;
          console.warn('[wa-templates-sync] sync token scope error:', txt);
        } else {
          console.error('[wa-templates-sync] meta sync error:', resp.status, txt.slice(0, 300));
        }
        continue;
      }

      let json: any = {};
      try {
        json = JSON.parse(txt);
      } catch {
        errors += chunk.length;
        continue;
      }

      const metaList: Array<{ id: string; name: string; status: string; rejected_reason?: string }> = json?.data || [];
      const byMetaId = new Map(metaList.map((m) => [m.id, m]));
      const byName = new Map(metaList.map((m) => [m.name, m]));

      // F #4 review fix: acumular updates e fazer UM upsert por chunk (em vez de N awaits seriados).
      const updates: Array<{
        id: string;
        meta_status: string;
        meta_rejection_reason: string | null;
        meta_status_synced_at: string;
      }> = [];
      const nowIso = new Date().toISOString();

      for (const local of chunk) {
        const found = (local.meta_template_id && byMetaId.get(local.meta_template_id)) || byName.get(local.name);
        if (!found) continue;

        const newStatus = (found.status || '').toLowerCase();
        const allowedStatus = ['pending', 'approved', 'rejected', 'disabled'].includes(newStatus) ? newStatus : 'pending';
        const rejection = found.rejected_reason || null;

        updates.push({
          id: local.id,
          meta_status: allowedStatus,
          meta_rejection_reason: rejection,
          meta_status_synced_at: nowIso,
        });
      }

      if (updates.length > 0) {
        const { error: upErr } = await supabase
          .from('message_templates')
          .upsert(updates, { onConflict: 'id' });
        if (upErr) {
          errors += updates.length;
          console.error('[wa-templates-sync] batch upsert error:', upErr);
        } else {
          synced += updates.length;
        }
      }
    }
  }

  return jsonOk({ synced, errors, ...(scopeWarning ? { warning: scopeWarning } : {}) });
}

// ----------------------------------------------------------------------------
async function handleDelete(
  supabase: SupabaseClient,
  templateId: string,
  auth: AuthResult,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const tpl = await loadTemplate(supabase, templateId);
  if (!tpl) return jsonErr('template_not_found', 404);
  if (tpl.is_seed) return jsonErr('cannot_delete_seed_template', 400);

  // Authz: User JWT só deleta próprio
  if (typeof auth !== 'string') {
    if (tpl.user_id && tpl.user_id !== auth.user_id) {
      return jsonErr('forbidden_owner_mismatch', 403);
    }
  }

  const settings = await loadOwnerSettings(supabase, tpl.user_id);

  // Tenta deletar na Meta (best-effort se faltarem credenciais)
  if (settings?.whatsapp_business_account_id && settings?.whatsapp_access_token && tpl.meta_template_id) {
    const url = `${META_API}/${settings.whatsapp_business_account_id}/message_templates?name=${encodeURIComponent(tpl.name)}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${settings.whatsapp_access_token}` },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      if (metaErrorIsScope(resp.status, txt)) {
        return new Response(
          JSON.stringify({ error: TOKEN_SCOPE_ERROR, detail: txt.slice(0, 500) }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Meta delete pode falhar mesmo OK no DB (template já removido lá); logamos e seguimos
      console.warn('[wa-templates-sync] meta delete non-ok:', resp.status, txt.slice(0, 200));
    } else {
      console.log(`[wa-templates-sync] meta delete ok name=${tpl.name}`);
    }
  }

  const { error: delErr } = await supabase.from('message_templates').delete().eq('id', tpl.id);
  if (delErr) return jsonErr(delErr.message, 500);

  return jsonOk({ template_id: tpl.id, deleted: true });
}

