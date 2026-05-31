// F10.5 — Edge Function: gera signed upload URL para o candidato enviar CV.
//
// Fluxo:
//   POST { contact_id, vacancy_id?, file_name, mime_type }
//   → resolve owner via contacts.user_id
//   → path: <user_id>/<contact_id>/<uuid>_<slugify(file_name)>
//   → supabase.storage.from('resumes').createSignedUploadUrl(path, 60)
//   → INSERT resumes { user_id, contact_id, vacancy_id?, file_path, file_name, mime_type, parse_status='pending' }
//   → retorna { upload_url, resume_id, file_path, expires_in: 60 }
//
// Auth cascata: service_role (interno via tool) ou user JWT (UI).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonOk, jsonErr } from "../_shared/responses.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { slugify as baseSlugify } from "../_shared/pt-br.ts";

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// Preserva caractere `.` no nome (preserva extensão); fallback p/ pt-br helper.
function slugifyFileName(s: string): string {
  const cleaned = (s || 'cv').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
  return cleaned || baseSlugify(s, 80);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authResult = await authenticateRequest(req, supabase);
  if (!authResult || authResult.kind === 'cron') return jsonErr('Unauthorized', 401);

  let body: { contact_id?: string; vacancy_id?: string; file_name?: string; mime_type?: string };
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid_body', 400);
  }

  if (!body.contact_id) return jsonErr('missing_contact_id', 400);
  if (!body.file_name || body.file_name.length > 200) return jsonErr('invalid_file_name', 400);
  if (!body.mime_type || !ALLOWED_MIME.has(body.mime_type)) {
    return jsonErr('invalid_mime_type', 400);
  }

  // Resolve owner via contacts
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, user_id')
    .eq('id', body.contact_id)
    .maybeSingle();

  if (contactErr || !contact) return jsonErr('contact_not_found', 404);
  const ownerId = (contact as any).user_id;
  if (!ownerId) return jsonErr('contact_has_no_owner', 400);

  // Authz: user JWT só pode pedir upload pra contato próprio
  if (authResult.kind === 'user' && authResult.userId !== ownerId) {
    return jsonErr('forbidden_owner_mismatch', 403);
  }

  // Build path
  const objectId = crypto.randomUUID();
  const path = `${ownerId}/${body.contact_id}/${objectId}_${slugifyFileName(body.file_name)}`;

  // Create signed upload URL (TTL 60s)
  const { data: signed, error: signedErr } = await (supabase.storage.from('resumes') as any)
    .createSignedUploadUrl(path);

  if (signedErr || !signed) {
    console.error('[signed-upload-url] createSignedUploadUrl error:', signedErr);
    return jsonErr(signedErr?.message || 'sign_failed', 500);
  }

  const uploadUrl = (signed as any).signedUrl || (signed as any).signed_url;

  // Insert resumes row
  const { data: row, error: insErr } = await supabase
    .from('resumes')
    .insert({
      user_id: ownerId,
      contact_id: body.contact_id,
      vacancy_id: body.vacancy_id || null,
      file_path: path,
      file_name: body.file_name,
      mime_type: body.mime_type,
      parse_status: 'pending',
    })
    .select('id, file_path')
    .single();

  if (insErr || !row) {
    console.error('[signed-upload-url] resumes insert error:', insErr);
    return jsonErr(insErr?.message || 'insert_failed', 500);
  }

  console.log(`[signed-upload-url] ok resume=${(row as any).id} path=${path}`);

  return jsonOk({
    upload_url: uploadUrl,
    resume_id: (row as any).id,
    file_path: (row as any).file_path,
    // SDK Supabase v2 não aceita TTL custom em createSignedUploadUrl;
    // token é one-shot (válido por ~2h, único uso).
    one_shot: true,
  });
});
