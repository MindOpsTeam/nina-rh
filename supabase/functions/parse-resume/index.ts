// F10.5 — Edge Function: parseia CV via gateway Lovable AI (OpenAI-compat) com Gemini.
// O documento (PDF/DOCX) é enviado como data URL base64 num content part image_url;
// o gateway roteia pro Gemini, que lê o arquivo nativamente. Structured output é obtido
// via tool/function calling (tool extract_resume), mesmo padrão de analyze-conversation.
//
// Body: { resume_id }
//
// Auth: service_role direto OU user JWT (com checagem de ownership).
//
// Usa LOVABLE_API_KEY (auto-injetada pelo Lovable Cloud). Não requer secret manual.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonOk, jsonErr } from "../_shared/responses.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = 'google/gemini-2.5-flash';

interface ResumeRow {
  id: string;
  user_id: string | null;
  contact_id: string;
  file_path: string;
  mime_type: string | null;
}

// JSON schema dos parâmetros da tool extract_resume (function calling)
const RESUME_SCHEMA = {
  type: 'object',
  properties: {
    nome: { type: 'string' },
    email: { type: 'string' },
    telefone: { type: 'string' },
    experiencia_total_anos: { type: 'number' },
    cargos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          empresa: { type: 'string' },
          cargo: { type: 'string' },
          periodo: { type: 'string' },
          descricao: { type: 'string' },
        },
      },
    },
    formacao: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          instituicao: { type: 'string' },
          curso: { type: 'string' },
          ano_conclusao: { type: 'string' },
        },
      },
    },
    idiomas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          nivel: { type: 'string' },
        },
        required: ['nome'],
      },
    },
    certificacoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          ano: { type: 'string' },
        },
        required: ['nome'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    localizacao_cidade_estado: { type: 'string' },
  },
  required: [],
};

const EXTRACT_TOOL = {
  type: 'function',
  function: {
    name: 'extract_resume',
    description: 'Devolve os dados estruturados extraídos do currículo em anexo.',
    parameters: RESUME_SCHEMA,
  },
};

const PROMPT = `Você é um extrator estruturado de currículos. Analise o CV em anexo e chame a tool extract_resume com os dados. Regras:
- Em campos numéricos (experiencia_total_anos), retorne o melhor número inteiro. Se a pessoa tem 7 anos e 4 meses, retorne 7.
- Em períodos de cargos, use formato livre ("Jan/2020 - Dez/2022", "2018 - Atual", etc).
- skills: lista plana (sem categoria), até 30 itens, em minúsculas.
- localizacao_cidade_estado: "Cidade/UF" quando claro.
- Se um campo não está disponível, omita. Não invente.
`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authResult = await authenticateRequest(req, supabase);
  if (!authResult || authResult.kind === 'cron') return jsonErr('Unauthorized', 401);

  let body: { resume_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid_body', 400);
  }
  if (!body.resume_id) return jsonErr('missing_resume_id', 400);

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) return jsonErr('missing_lovable_api_key', 500);

  // Load resume row
  const { data: resumeRaw, error: rErr } = await supabase
    .from('resumes')
    .select('id, user_id, contact_id, file_path, mime_type')
    .eq('id', body.resume_id)
    .maybeSingle();

  if (rErr || !resumeRaw) return jsonErr('resume_not_found', 404);
  const resume = resumeRaw as ResumeRow;

  if (authResult.kind === 'user' && resume.user_id && resume.user_id !== authResult.userId) {
    return jsonErr('forbidden_owner_mismatch', 403);
  }

  // Mark parsing
  await supabase
    .from('resumes')
    .update({ parse_status: 'parsing', parse_error: null })
    .eq('id', resume.id);

  try {
    // Download from Storage
    const dlStart = Date.now();
    const { data: blob, error: dlErr } = await supabase.storage
      .from('resumes')
      .download(resume.file_path);
    if (dlErr || !blob) throw new Error(`storage_download: ${dlErr?.message || 'no blob'}`);
    console.log(`[parse-resume] downloaded ${resume.file_path} (${(blob.size / 1024).toFixed(1)}KB) in ${Date.now() - dlStart}ms`);

    // Encode base64
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const mime = resume.mime_type || 'application/pdf';

    // Gateway Lovable AI (OpenAI-compat). Documento vai como data URL base64
    // num content part image_url; o gateway roteia pro Gemini que lê o arquivo.
    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_resume' } },
      temperature: 0.1,
    };

    // FIX-B review: AbortController timeout 30s no fetch do gateway.
    const gController = new AbortController();
    const gTimeout = setTimeout(() => gController.abort(), 30000);
    let resp: Response;
    try {
      resp = await fetch(LOVABLE_AI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: gController.signal,
      });
    } finally {
      clearTimeout(gTimeout);
    }

    const respText = await resp.text();
    if (!resp.ok) {
      if (resp.status === 429) throw new Error('rate_limit: gateway 429');
      if (resp.status === 402) throw new Error('payment_required: gateway 402');
      throw new Error(`gateway_${resp.status}: ${respText.slice(0, 400)}`);
    }

    let respJson: any = {};
    try {
      respJson = JSON.parse(respText);
    } catch {
      throw new Error('gateway_response_not_json');
    }

    const toolCall = respJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) throw new Error('gateway_empty_tool_call');

    let parsed: any;
    try {
      parsed = JSON.parse(argsRaw);
    } catch (e) {
      throw new Error('parse_output_not_json: ' + String(e).slice(0, 200));
    }

    // Persist parsed_data
    const { error: updErr } = await supabase
      .from('resumes')
      .update({
        parsed_data: parsed,
        parse_status: 'parsed',
        parse_error: null,
      })
      .eq('id', resume.id);
    if (updErr) throw new Error('db_update: ' + updErr.message);

    // Sync best-effort: hidrata client_memory.experiencia se vazio
    await hydrateContactMemory(supabase, resume.contact_id, parsed);

    console.log(`[parse-resume] ok resume=${resume.id}`);
    return jsonOk({
      resume_id: resume.id,
      parse_status: 'parsed',
      parsed_data: parsed,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error(`[parse-resume] error resume=${resume.id}:`, msg);
    await supabase
      .from('resumes')
      .update({ parse_status: 'failed', parse_error: msg.slice(0, 1000) })
      .eq('id', resume.id);
    return jsonErr(msg, 500);
  }
});

async function hydrateContactMemory(
  supabase: SupabaseClient,
  contactId: string,
  parsed: any,
): Promise<void> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, client_memory')
      .eq('id', contactId)
      .maybeSingle();
    if (!contact) return;
    const memory = (contact as any).client_memory || {};

    const patch: Record<string, any> = {};

    if (!memory.experiencia && (parsed.experiencia_total_anos != null || (parsed.cargos?.length || 0) > 0)) {
      patch.experiencia = {
        anos: parsed.experiencia_total_anos ?? null,
        areas: Array.isArray(parsed.cargos)
          ? Array.from(new Set(parsed.cargos.map((c: any) => c?.cargo).filter(Boolean))).slice(0, 8)
          : [],
      };
    }
    if (!memory.localizacao && parsed.localizacao_cidade_estado) {
      patch.localizacao = { cidade_estado: parsed.localizacao_cidade_estado };
    }

    if (Object.keys(patch).length === 0) return;

    await supabase
      .from('contacts')
      .update({ client_memory: { ...memory, ...patch } })
      .eq('id', contactId);
  } catch (e) {
    console.warn('[parse-resume] hydrate client_memory non-fatal:', e);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // chunked to avoid call stack issues on large files
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

