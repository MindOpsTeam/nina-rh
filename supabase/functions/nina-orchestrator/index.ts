import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripAccents } from "../_shared/pt-br.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// ============================================================================
// F3b — TOOLS RH (Nina RH): recommend_vacancies, list_recruiters_for_area,
// schedule_interview, register_candidate_interest. Substituem as tools de
// agendamento genérico do template SDR.
// ============================================================================

const recommendVacanciesTool = {
  type: "function",
  function: {
    name: "recommend_vacancies",
    description: "Recomendar até 5 vagas abertas compatíveis com o perfil do candidato. Use quando souber área, senioridade ou palavra-chave do interesse.",
    parameters: {
      type: "object",
      properties: {
        area: { type: "string", description: "Área de atuação (ex: tecnologia, comercial, saude, operacoes, marketing)" },
        senioridade: { type: "string", description: "Nível de senioridade (junior, pleno, senior, especialista)" },
        modalidade: { type: "string", description: "Modalidade de contrato (clt, pj, estagio, freelance)" },
        regime: { type: "string", description: "Regime de trabalho (remoto, hibrido, presencial)" },
        palavra_chave: { type: "string", description: "Palavra-chave livre (ex: 'enfermeira pediatria', 'react senior')" }
      },
      required: []
    }
  }
};

const listRecruitersTool = {
  type: "function",
  function: {
    name: "list_recruiters_for_area",
    description: "Listar recrutadores ativos para uma área específica antes de chamar schedule_interview. Sempre use esta tool para obter recruiter_id real.",
    parameters: {
      type: "object",
      properties: {
        area_slug: { type: "string", description: "Slug da área (ex: tecnologia, comercial, saude)" }
      },
      required: ["area_slug"]
    }
  }
};

const scheduleInterviewTool = {
  type: "function",
  function: {
    name: "schedule_interview",
    description: "Registrar pré-entrevista para o candidato. SEMPRE chame recommend_vacancies e list_recruiters_for_area antes. NUNCA invente UUIDs.",
    parameters: {
      type: "object",
      properties: {
        vacancy_id: { type: "string", description: "UUID real da vaga (obtido via recommend_vacancies)" },
        recruiter_id: { type: "string", description: "UUID real do recrutador (obtido via list_recruiters_for_area)" },
        janela_preferida: { type: "string", description: "Janela preferida do candidato em linguagem natural (ex: 'quinta 28/05 às 14h')" },
        type: { type: "string", enum: ["entrevista_inicial","entrevista_tecnica","entrevista_final","entrevista_cultural"], description: "Tipo. Default: entrevista_inicial" },
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" }
      },
      required: ["vacancy_id", "recruiter_id", "janela_preferida"]
    }
  }
};

const registerInterestTool = {
  type: "function",
  function: {
    name: "register_candidate_interest",
    description: "Parquear interesse do candidato em uma vaga sem agendar entrevista. Útil quando o candidato é bom perfil mas não cabe agora.",
    parameters: {
      type: "object",
      properties: {
        vacancy_id: { type: "string", description: "UUID da vaga" },
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" },
        motivo_parqueio: { type: "string", description: "Motivo (ex: 'sem janela disponível', 'aguardando outras vagas')" }
      },
      required: ["vacancy_id"]
    }
  }
};

// ============================================================================
// F6b — Tools de resposta a lembrete (D-1/D-0)
// ============================================================================
const confirmInterviewTool = {
  type: "function",
  function: {
    name: "confirm_interview",
    description: "Confirmar a próxima pré-entrevista futura do candidato. Use quando o candidato responder ao lembrete com '1', 'confirmo', 'sim', 'ok' ou equivalente.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" }
      },
      required: []
    }
  }
};

const cancelInterviewTool = {
  type: "function",
  function: {
    name: "cancel_interview",
    description: "Cancelar a próxima pré-entrevista futura do candidato. Use quando ele responder '3', 'cancelar', 'desistir', 'não posso ir'.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" },
        reason: { type: "string", description: "(opcional) Motivo informado pelo candidato" }
      },
      required: []
    }
  }
};

const requestResumeUploadTool = {
  type: "function",
  function: {
    name: "request_resume_upload",
    description: "Pedir o currículo do candidato via link signed (válido por 60 segundos). Use quando o candidato disser que tem CV pra enviar, ou quando precisar de mais detalhes de experiência. Não invoque sem que faça sentido na conversa.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" },
        vacancy_id: { type: "string", description: "(opcional) UUID da vaga associada ao CV" },
        file_name: { type: "string", description: "(opcional) Sugestão de nome de arquivo. Default: 'curriculo.pdf'" },
        mime_type: { type: "string", enum: ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword"], description: "(opcional) MIME do arquivo esperado. Default: PDF" },
        message_to_candidate: { type: "string", description: "(opcional) Mensagem customizada pro candidato. Se ausente, usa um texto padrão." }
      },
      required: []
    }
  }
};

const rescheduleInterviewRequestTool = {
  type: "function",
  function: {
    name: "reschedule_interview_request",
    description: "Sinalizar pedido de remarcação da próxima pré-entrevista (status passa a 'cancelado_para_remarcacao'). Use quando candidato responder '2', 'remarcar', 'trocar horário'. Em seguida, ofereça novas janelas.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "(opcional) UUID do candidato; se ausente, usa o contato da conversa" }
      },
      required: []
    }
  }
};

// ============================================================================
// Helpers PT-BR (tokenize, normalize) — stripAccents importado de ../_shared/pt-br.ts
// ============================================================================

const AREA_ALIASES: Record<string, string> = {
  'tech': 'tecnologia', 'ti': 'tecnologia', 'tecnologia': 'tecnologia',
  'vendas': 'comercial', 'comercial': 'comercial',
  'rh': 'operacoes', 'recursos humanos': 'operacoes', 'operacoes': 'operacoes',
  'saude': 'saude', 'marketing': 'marketing'
};
function normalizeArea(s: string): string {
  if (!s) return s;
  const n = stripAccents(s.toLowerCase().trim());
  return AREA_ALIASES[n] || n;
}

const MODALIDADE_ALIASES: Record<string, string> = {
  'clt': 'clt', 'pj': 'pj', 'estagio': 'estagio',
  'freela': 'freelance', 'freelance': 'freelance'
};
function normalizeModalidade(s: string): string {
  if (!s) return s;
  const n = stripAccents(s.toLowerCase().trim());
  return MODALIDADE_ALIASES[n] || n;
}

const SENIORIDADE_ALIASES: Record<string, string> = {
  'jr': 'junior', 'junior': 'junior',
  'pl': 'pleno', 'pleno': 'pleno',
  'sr': 'senior', 'senior': 'senior',
  'lead': 'especialista', 'especialista': 'especialista'
};
function normalizeSenioridade(s: string): string {
  if (!s) return s;
  const n = stripAccents(s.toLowerCase().trim());
  return SENIORIDADE_ALIASES[n] || n;
}

const SUFIXES_RE = /(ologia|ologista|iatra|ologa|ista)$/i;
function buildIlikeOrClause(termo: string): string {
  if (!termo) return '';
  const tokens = stripAccents(termo.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3);
  const radicais = tokens.map(t => {
    let r = t.replace(SUFIXES_RE, '');
    if (t.length > 7) r = r.slice(0, Math.max(4, r.length - 3));
    return r;
  }).filter(r => r.length >= 3);
  const uniq = Array.from(new Set([...tokens, ...radicais]));
  const parts: string[] = [];
  for (const tok of uniq) {
    parts.push(`titulo.ilike.%${tok}%`);
    parts.push(`descricao.ilike.%${tok}%`);
  }
  return parts.join(',');
}

// ============================================================================
// Executors RH
// ============================================================================
async function recommendVacancies(supabase: any, ownerUserId: string | null, args: any): Promise<any> {
  let query = supabase
    .from('vacancies')
    .select('id, titulo, area, senioridade, modalidade_contrato, regime_trabalho, faixa_salarial_min, faixa_salarial_max, descricao')
    .eq('status', 'aberta')
    .limit(5);

  if (ownerUserId) query = query.eq('user_id', ownerUserId);

  if (args.area) {
    const slug = normalizeArea(args.area);
    query = query.ilike('area', `%${slug}%`);
  }
  if (args.senioridade) {
    const s = normalizeSenioridade(args.senioridade);
    query = query.ilike('senioridade', `%${s}%`);
  }
  if (args.modalidade) {
    const m = normalizeModalidade(args.modalidade);
    query = query.contains('modalidade_contrato', [m]);
  }
  if (args.regime) {
    const r = stripAccents(args.regime.toLowerCase().trim());
    query = query.contains('regime_trabalho', [r]);
  }
  if (args.palavra_chave) {
    const clause = buildIlikeOrClause(args.palavra_chave);
    if (clause) query = query.or(clause);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Nina-RH] recommend_vacancies error:', error);
    return { error: error.message, vacancies: [] };
  }
  return { vacancies: data || [] };
}

async function listRecruitersForArea(supabase: any, ownerUserId: string | null, area_slug: string): Promise<any> {
  const slug = normalizeArea(area_slug);

  // team_members do template não tem coluna `specialty`; usamos team_functions.name como proxy.
  let query = supabase
    .from('team_members')
    .select('id, name, status, team_functions(name)')
    .eq('status', 'active');

  if (ownerUserId) query = query.eq('user_id', ownerUserId);

  const { data, error } = await query;
  if (error) {
    console.error('[Nina-RH] list_recruiters_for_area error:', error);
    return { error: error.message, recruiters: [] };
  }

  const filtered = (data || []).filter((r: any) => {
    const fn = r.team_functions?.name;
    if (!fn) return true; // sem área associada = elegível
    return normalizeArea(fn) === slug;
  }).map((r: any) => ({
    id: r.id,
    nome: r.name,
    area: r.team_functions?.name || null
  }));

  return { recruiters: filtered };
}

async function scheduleInterview(
  supabase: any,
  contactId: string,
  conversationId: string,
  ownerUserId: string | null,
  args: any
): Promise<any> {
  if (!args.vacancy_id) {
    return { error: 'missing_vacancy_id', hint: 'Chame recommend_vacancies primeiro. Não invente IDs.' };
  }
  if (!args.recruiter_id) {
    return { error: 'missing_recruiter_id', hint: 'Chame list_recruiters_for_area primeiro.' };
  }

  const insertData: any = {
    title: `Pré-entrevista — ${args.janela_preferida || 'janela a definir'}`,
    description: `Recrutador alocado: ${args.recruiter_id}. Janela preferida: ${args.janela_preferida || 'n/d'}`,
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 30,
    type: args.type || 'entrevista_inicial',
    status: 'agendamento_pendente',
    contact_id: args.contact_id || contactId,
    vacancy_id: args.vacancy_id,
    attendees: [args.recruiter_id],
    metadata: {
      source: 'nina_ai_rh',
      conversation_id: conversationId,
      recruiter_id: args.recruiter_id,
      janela_preferida: args.janela_preferida || null
    }
  };
  if (ownerUserId) insertData.user_id = ownerUserId;

  const { data, error } = await supabase
    .from('appointments')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[Nina-RH] schedule_interview error:', error);
    return { error: error.message };
  }
  return data;
}

async function registerCandidateInterest(
  supabase: any,
  contactId: string,
  ownerUserId: string | null,
  args: any
): Promise<any> {
  if (!args.vacancy_id) {
    return { error: 'missing_vacancy_id', hint: 'Chame recommend_vacancies primeiro.' };
  }

  const upsertData: any = {
    contact_id: args.contact_id || contactId,
    vacancy_id: args.vacancy_id,
    motivo_parqueio: args.motivo_parqueio || null
  };
  if (ownerUserId) upsertData.user_id = ownerUserId;

  const { data, error } = await supabase
    .from('vacancy_interests')
    .upsert(upsertData, { onConflict: 'contact_id,vacancy_id' })
    .select()
    .single();

  if (error) {
    console.error('[Nina-RH] register_candidate_interest error:', error);
    return { error: error.message };
  }
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require auth: service role (internal triggers) or signed-in user
  const { requireAuth } = await import("../_shared/auth.ts");
  const authFail = await requireAuth(req, corsHeaders);
  if (authFail) return authFail;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Nina] Starting orchestration...');

    // Claim batch of messages to process
    const { data: queueItems, error: claimError } = await supabase
      .rpc('claim_nina_processing_batch', { p_limit: 10 });

    if (claimError) {
      console.error('[Nina] Error claiming batch:', claimError);
      throw claimError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[Nina] No messages to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Nina] Processing ${queueItems.length} messages`);

    let processed = 0;

    for (const item of queueItems) {
      try {
        // Get user_id from conversation to fetch correct settings
        const { data: conversation } = await supabase
          .from('conversations')
          .select('user_id')
          .eq('id', item.conversation_id)
          .single();

        if (!conversation) {
          console.log('[Nina] Conversation not found:', item.conversation_id);
          await supabase
            .from('nina_processing_queue')
            .update({ 
              status: 'failed', 
              processed_at: new Date().toISOString(),
              error_message: 'Conversation not found'
            })
            .eq('id', item.id);
          continue;
        }

        // Buscar settings com fallback triplo (user_id → global → any)
        let settings = null;
        
        // 1. Tentar buscar por user_id da conversa
        if (conversation.user_id) {
          const { data: userSettings } = await supabase
            .from('nina_settings')
            .select('*')
            .eq('user_id', conversation.user_id)
            .maybeSingle();
          settings = userSettings;
          if (settings) {
            console.log('[Nina] Found settings for user:', conversation.user_id);
          }
        }
        
        // 2. Se não encontrou, tentar buscar global (user_id is null)
        if (!settings) {
          console.log('[Nina] No user-specific settings, trying global...');
          const { data: globalSettings } = await supabase
            .from('nina_settings')
            .select('*')
            .is('user_id', null)
            .maybeSingle();
          settings = globalSettings;
          if (settings) {
            console.log('[Nina] Found global settings (user_id is null)');
          }
        }
        
        // 3. Último fallback: buscar qualquer settings existente
        if (!settings) {
          console.log('[Nina] No global settings, fetching any available...');
          const { data: anySettings } = await supabase
            .from('nina_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          settings = anySettings;
          if (settings) {
            console.log('[Nina] Using fallback settings from:', settings.id);
          }
        }

        // Use default settings if nothing found
        const effectiveSettings = settings || {
          is_active: true,
          auto_response_enabled: true,
          system_prompt_override: null,
          ai_model_mode: 'flash',
          response_delay_min: 1000,
          response_delay_max: 3000,
          message_breaking_enabled: false,
          audio_response_enabled: false,
          elevenlabs_api_key: null,
          ai_scheduling_enabled: true,
          user_id: conversation.user_id
        };
        
        if (!settings) {
          console.log('[Nina] No settings found in database, using hardcoded defaults');
        }

        // Check if Nina is active for this user
        if (!effectiveSettings.is_active) {
          console.log('[Nina] Nina is disabled for user:', conversation.user_id);
          await supabase
            .from('nina_processing_queue')
            .update({ 
              status: 'completed', 
              processed_at: new Date().toISOString(),
              error_message: 'Nina disabled for this user'
            })
            .eq('id', item.id);
          continue;
        }

        // Use default prompt if not configured
        const systemPrompt = effectiveSettings.system_prompt_override || getDefaultSystemPrompt();
        
        console.log('[Nina] Processing with settings:', {
          is_active: effectiveSettings.is_active,
          auto_response_enabled: effectiveSettings.auto_response_enabled,
          ai_model_mode: effectiveSettings.ai_model_mode,
          has_system_prompt: !!effectiveSettings.system_prompt_override,
          has_whatsapp_config: !!effectiveSettings.whatsapp_phone_number_id,
          has_elevenlabs: !!effectiveSettings.elevenlabs_api_key,
        });
        
        await processQueueItem(supabase, lovableApiKey, item, systemPrompt, effectiveSettings);
        
        // Mark as completed
        await supabase
          .from('nina_processing_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString() 
          })
          .eq('id', item.id);
        
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Nina] Error processing item ${item.id}:`, error);
        
        // Mark as failed with retry
        const newRetryCount = (item.retry_count || 0) + 1;
        const shouldRetry = newRetryCount < 3;
        
        await supabase
          .from('nina_processing_queue')
          .update({ 
            status: shouldRetry ? 'pending' : 'failed',
            retry_count: newRetryCount,
            error_message: errorMessage,
            scheduled_for: shouldRetry 
              ? new Date(Date.now() + newRetryCount * 30000).toISOString() 
              : null
          })
          .eq('id', item.id);
      }
    }

    console.log(`[Nina] Processed ${processed}/${queueItems.length} messages`);

    return new Response(JSON.stringify({ processed, total: queueItems.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Nina] Orchestrator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Generate audio using ElevenLabs
async function generateAudioElevenLabs(settings: any, text: string): Promise<ArrayBuffer | null> {
  if (!settings.elevenlabs_api_key) {
    console.log('[Nina] ElevenLabs API key not configured');
    return null;
  }

  try {
    const voiceId = settings.elevenlabs_voice_id || '33B4UnXyTNbgLmdEDh5P'; // Keren - Young Brazilian Female
    const model = settings.elevenlabs_model || 'eleven_turbo_v2_5';

    console.log('[Nina] Generating audio with ElevenLabs, voice:', voiceId);

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': settings.elevenlabs_api_key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: settings.elevenlabs_stability || 0.75,
          similarity_boost: settings.elevenlabs_similarity_boost || 0.80,
          style: settings.elevenlabs_style || 0.30,
          use_speaker_boost: settings.elevenlabs_speaker_boost !== false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Nina] ElevenLabs error:', response.status, errorText);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('[Nina] Error generating audio:', error);
    return null;
  }
}

// Upload audio to Supabase Storage
async function uploadAudioToStorage(
  supabase: any, 
  audioBuffer: ArrayBuffer, 
  conversationId: string
): Promise<string | null> {
  try {
    const fileName = `${conversationId}/${Date.now()}.mp3`;
    
    const { data, error } = await supabase.storage
      .from('audio-messages')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });

    if (error) {
      console.error('[Nina] Error uploading audio:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-messages')
      .getPublicUrl(fileName);

    console.log('[Nina] Audio uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[Nina] Error uploading audio to storage:', error);
    return null;
  }
}

async function processQueueItem(
  supabase: any,
  lovableApiKey: string,
  item: any,
  systemPrompt: string,
  settings: any
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  console.log(`[Nina] Processing queue item: ${item.id}`);

  // Get the message
  const { data: message } = await supabase
    .from('messages')
    .select('*')
    .eq('id', item.message_id)
    .maybeSingle();

  if (!message) {
    throw new Error('Message not found');
  }

  // Get conversation with contact info
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(*)')
    .eq('id', item.conversation_id)
    .maybeSingle();

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if conversation is still in Nina mode
  if (conversation.status !== 'nina') {
    console.log('[Nina] Conversation no longer in Nina mode, skipping');
    return;
  }

  // Check if auto-response is enabled
  if (!settings?.auto_response_enabled) {
    console.log('[Nina] Auto-response disabled, marking as processed without responding');
    await supabase
      .from('messages')
      .update({ processed_by_nina: true })
      .eq('id', message.id);
    return;
  }

  // Get recent messages for context (last 20)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('sent_at', { ascending: false })
    .limit(20);

  // Build conversation history for AI
  const conversationHistory = (recentMessages || [])
    .reverse()
    .map((msg: any) => ({
      role: msg.from_type === 'user' ? 'user' : 'assistant',
      content: msg.content || '[media]'
    }));

  // Get client memory
  const clientMemory = conversation.contact?.client_memory || {};

  // Build enhanced system prompt with context
  const enhancedSystemPrompt = buildEnhancedPrompt(
    systemPrompt, 
    conversation.contact, 
    clientMemory
  );

  // Process template variables ({{ data_hora }}, {{ dia_semana }}, etc.)
  const processedPrompt = processPromptTemplate(enhancedSystemPrompt, conversation.contact);

  console.log('[Nina] Calling Lovable AI...');

  // Get AI model settings based on user configuration
  const aiSettings = getModelSettings(settings, conversationHistory, message, conversation.contact, clientMemory);

  console.log('[Nina] Using AI settings:', aiSettings);

  // Build tools array — F3b: tools RH (recommend_vacancies, list_recruiters_for_area,
  // schedule_interview, register_candidate_interest). As tools de agendamento genérico
  // do template SDR foram substituídas.
  const tools: any[] = [];
  if (settings?.ai_scheduling_enabled !== false) {
    tools.push(confirmInterviewTool);
    tools.push(cancelInterviewTool);
    tools.push(rescheduleInterviewRequestTool);
    tools.push(recommendVacanciesTool);
    tools.push(listRecruitersTool);
    tools.push(scheduleInterviewTool);
    tools.push(registerInterestTool);
    tools.push(requestResumeUploadTool);
    console.log('[Nina-RH] Adding RH tools: confirm/cancel/reschedule_interview_request + recommend_vacancies, list_recruiters_for_area, schedule_interview, register_candidate_interest');
  }

  // F3b: last_offered reinject — se houver IDs ofertados no turno anterior (<30min),
  // injete-os como system message no INÍCIO do messages[] para o LLM usar UUIDs reais.
  const ninaContext = (conversation as any).nina_context || {};
  const lastOffered = ninaContext.last_offered;
  const messagesForLLM: any[] = [{ role: 'system', content: processedPrompt }];

  if (lastOffered?.timestamp) {
    const ageMs = Date.now() - new Date(lastOffered.timestamp).getTime();
    const THIRTY_MIN = 30 * 60 * 1000;
    if (ageMs < THIRTY_MIN) {
      const lines: string[] = ['CONTEXTO DO TURNO ANTERIOR — use estes IDs reais no schedule_interview:'];
      if (lastOffered.vacancies?.length) {
        lines.push('VAGAS:');
        for (const v of lastOffered.vacancies) {
          lines.push(`- ${v.titulo} (${v.area || 's/área'}) (id=${v.id})`);
        }
      }
      if (lastOffered.recruiters?.length) {
        lines.push('RECRUTADORES:');
        for (const r of lastOffered.recruiters) {
          lines.push(`- ${r.nome} (${r.area || 's/área'}) (id=${r.id})`);
        }
      }
      messagesForLLM.push({ role: 'system', content: lines.join('\n') });
      console.log('[Nina-RH] last_offered reinjected (age:', Math.round(ageMs / 1000), 's)');
    } else {
      console.log('[Nina-RH] last_offered expired (>30min), skipping reinject');
    }
  }

  messagesForLLM.push(...conversationHistory);

  // Build request body
  const requestBody: any = {
    model: aiSettings.model,
    messages: messagesForLLM,
    temperature: aiSettings.temperature,
    max_tokens: 1000
  };

  // Only add tools if we have any
  if (tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  // Call Lovable AI Gateway
  const aiResponse = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error('[Nina] AI response error:', aiResponse.status, errorText);
    
    if (aiResponse.status === 429) {
      throw new Error('Rate limit exceeded, will retry later');
    }
    if (aiResponse.status === 402) {
      throw new Error('Payment required - please add credits');
    }
    throw new Error(`AI error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiMessage = aiData.choices?.[0]?.message;
  let aiContent = aiMessage?.content || '';
  const toolCalls = aiMessage?.tool_calls || [];

  console.log('[Nina] AI response received, content length:', aiContent?.length || 0, ', tool_calls:', toolCalls.length);

  // F3b: Process RH tool calls
  let recommendedVacancies: any[] = [];
  let listedRecruiters: any[] = [];
  let scheduledInterview: any = null;
  let registeredInterest: any = null;
  let appointmentCreated: any = null; // mantido pra compat com queueTextResponse

  for (const toolCall of toolCalls) {
    const name = toolCall.function?.name;
    let args: any = {};
    try {
      args = JSON.parse(toolCall.function?.arguments || '{}');
    } catch (e) {
      console.error('[Nina-RH] parse args error for', name, e);
      continue;
    }

    if (name === 'recommend_vacancies') {
      console.log('[Nina-RH] recommend_vacancies:', args);
      const res = await recommendVacancies(supabase, settings?.user_id || null, args);
      recommendedVacancies = res.vacancies || [];
      console.log('[Nina-RH] recommend_vacancies result:', recommendedVacancies.length, 'vagas');
      if (recommendedVacancies.length === 0) {
        aiContent = (aiContent || '') + '\n\nNão encontrei vagas abertas com esse perfil agora. Posso registrar seu interesse pra quando abrirem novas vagas?';
      }
    } else if (name === 'list_recruiters_for_area') {
      console.log('[Nina-RH] list_recruiters_for_area:', args);
      const res = await listRecruitersForArea(supabase, settings?.user_id || null, args.area_slug);
      listedRecruiters = res.recruiters || [];
      console.log('[Nina-RH] list_recruiters result:', listedRecruiters.length, 'recrutadores');
    } else if (name === 'schedule_interview') {
      console.log('[Nina-RH] schedule_interview:', args);
      scheduledInterview = await scheduleInterview(
        supabase,
        conversation.contact_id,
        conversation.id,
        settings?.user_id || null,
        args
      );
      if (scheduledInterview?.error === 'missing_vacancy_id' || scheduledInterview?.error === 'missing_recruiter_id') {
        console.warn('[Nina-RH] schedule_interview rejected:', scheduledInterview.error, scheduledInterview.hint);
        aiContent = (aiContent || '') + `\n\n⚠️ Preciso confirmar a vaga antes de agendar. Pode me dizer qual das vagas listadas?`;
      } else if (scheduledInterview && !scheduledInterview.error) {
        aiContent = (aiContent || '') + `\n\n✅ Pré-entrevista registrada para a janela: ${args.janela_preferida}. O recrutador entra em contato pra confirmar o horário exato.`;
        appointmentCreated = scheduledInterview;
      } else if (scheduledInterview?.error) {
        console.error('[Nina-RH] schedule_interview db error:', scheduledInterview.error);
        aiContent = (aiContent || '') + `\n\n⚠️ Não consegui registrar o agendamento agora. O recrutador vai entrar em contato.`;
      }
    } else if (name === 'confirm_interview') {
      console.log('[Nina-RH] confirm_interview:', args);
      const cid = args.contact_id || conversation.contact_id;
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('nina_confirm_next_appointment', { p_contact_id: cid });
      if (rpcErr) {
        console.error('[Nina-RH] confirm_interview rpc error:', rpcErr);
        aiContent = (aiContent || '') + `\n\n⚠️ Não consegui confirmar agora. Vou avisar o recrutador.`;
      } else if (!rpcRes || (Array.isArray(rpcRes) && rpcRes.length === 0)) {
        aiContent = (aiContent || '') + `\n\nNão encontrei pré-entrevista futura pra confirmar. Quer agendar uma?`;
      } else {
        aiContent = (aiContent || '') + `\n\n✅ Confirmado! Te espero no horário combinado.`;
      }
    } else if (name === 'cancel_interview') {
      console.log('[Nina-RH] cancel_interview:', args);
      const cid = args.contact_id || conversation.contact_id;
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('nina_cancel_next_appointment', { p_contact_id: cid, p_reason: args.reason || null });
      if (rpcErr) {
        console.error('[Nina-RH] cancel_interview rpc error:', rpcErr);
        aiContent = (aiContent || '') + `\n\n⚠️ Não consegui cancelar agora. Vou avisar o recrutador.`;
      } else if (!rpcRes || (Array.isArray(rpcRes) && rpcRes.length === 0)) {
        aiContent = (aiContent || '') + `\n\nNão encontrei pré-entrevista futura pra cancelar.`;
      } else {
        aiContent = (aiContent || '') + `\n\n✅ Pré-entrevista cancelada. Se mudar de ideia, me avise.`;
      }
    } else if (name === 'reschedule_interview_request') {
      console.log('[Nina-RH] reschedule_interview_request:', args);
      const cid = args.contact_id || conversation.contact_id;
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('nina_request_reschedule', { p_contact_id: cid });
      if (rpcErr) {
        console.error('[Nina-RH] reschedule_interview_request rpc error:', rpcErr);
        aiContent = (aiContent || '') + `\n\n⚠️ Não consegui registrar a remarcação agora.`;
      } else if (!rpcRes || (Array.isArray(rpcRes) && rpcRes.length === 0)) {
        aiContent = (aiContent || '') + `\n\nNão encontrei pré-entrevista futura. Quer agendar uma nova?`;
      } else {
        aiContent = (aiContent || '') + `\n\nSem problema, vamos remarcar. Em qual janela você prefere?`;
      }
    } else if (name === 'request_resume_upload') {
      console.log('[Nina-RH] request_resume_upload:', args);
      const cid = args.contact_id || conversation.contact_id;
      try {
        const fnUrl = `${supabaseUrl}/functions/v1/signed-upload-url`;
        const fnResp = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            contact_id: cid,
            vacancy_id: args.vacancy_id || null,
            file_name: args.file_name || 'curriculo.pdf',
            mime_type: args.mime_type || 'application/pdf',
          }),
        });
        const fnText = await fnResp.text();
        if (!fnResp.ok) {
          console.error('[Nina-RH] signed-upload-url error:', fnResp.status, fnText.slice(0, 200));
          aiContent = (aiContent || '') + `\n\n⚠️ Não consegui gerar o link agora. Pode me enviar quando puder por aqui?`;
        } else {
          const fnJson = JSON.parse(fnText);
          const uploadUrl: string = fnJson.upload_url;
          const resumeId: string = fnJson.resume_id;
          const candidateText =
            args.message_to_candidate ||
            `Pra agilizar sua candidatura, me envie seu currículo (PDF ou DOCX) por este link: ${uploadUrl}\nO link é de uso único (vale só pra um envio). Se preferir, pode me responder por aqui depois.`;
          aiContent = (aiContent || '') + `\n\n${candidateText}`;

          // Persist pending_resume_upload em nina_context
          const pendingUpload = {
            resume_id: resumeId,
            file_path: fnJson.file_path,
            requested_at: new Date().toISOString(),
          };
          const merged = { ...ninaContext, pending_resume_upload: pendingUpload };
          await supabase
            .from('conversations')
            .update({ nina_context: merged })
            .eq('id', conversation.id);
          console.log('[Nina-RH] pending_resume_upload persisted resume_id=', resumeId);
        }
      } catch (e: any) {
        console.error('[Nina-RH] request_resume_upload exception:', e);
        aiContent = (aiContent || '') + `\n\n⚠️ Tive um problema no link. Pode tentar enviar por aqui mesmo.`;
      }
    } else if (name === 'register_candidate_interest') {
      console.log('[Nina-RH] register_candidate_interest:', args);
      registeredInterest = await registerCandidateInterest(
        supabase,
        conversation.contact_id,
        settings?.user_id || null,
        args
      );
      if (registeredInterest?.error === 'missing_vacancy_id') {
        aiContent = (aiContent || '') + `\n\nPreciso saber em qual vaga você tem interesse. Pode me indicar pela área?`;
      } else if (registeredInterest && !registeredInterest.error) {
        aiContent = (aiContent || '') + `\n\n✅ Interesse registrado! Avisarei assim que houver janela ou nova vaga compatível.`;
      }
    }
  }

  // F3b: persistir last_offered em conversations.nina_context (sempre que recommend ou list rodaram)
  if (recommendedVacancies.length > 0 || listedRecruiters.length > 0) {
    const newLastOffered = {
      vacancies: recommendedVacancies.map((v: any) => ({ id: v.id, titulo: v.titulo, area: v.area })),
      recruiters: listedRecruiters.map((r: any) => ({ id: r.id, nome: r.nome, area: r.area })),
      timestamp: new Date().toISOString()
    };
    const mergedContext = { ...ninaContext, last_offered: newLastOffered };
    const { error: ctxErr } = await supabase
      .from('conversations')
      .update({ nina_context: mergedContext })
      .eq('id', conversation.id);
    if (ctxErr) {
      console.error('[Nina-RH] last_offered persist error:', ctxErr);
    } else {
      console.log('[Nina-RH] last_offered persisted: vagas=', newLastOffered.vacancies.length, 'recrutadores=', newLastOffered.recruiters.length);
    }
  }

  // Fallback if no content and only tool calls
  if (!aiContent && toolCalls.length > 0) {
    if (scheduledInterview && !scheduledInterview.error) {
      aiContent = '✅ Pré-entrevista registrada. O recrutador entra em contato pra confirmar.';
    } else if (registeredInterest && !registeredInterest.error) {
      aiContent = '✅ Interesse registrado! Aviso assim que houver vaga compatível.';
    } else if (recommendedVacancies.length > 0) {
      const linhas = recommendedVacancies.slice(0, 3).map((v: any) => `• ${v.titulo} (${v.area || 'área não especificada'})`);
      aiContent = `Achei essas vagas:\n${linhas.join('\n')}\n\nQual te interessa?`;
    } else if (listedRecruiters.length > 0) {
      aiContent = `Temos ${listedRecruiters.length} recrutadores disponíveis. Vou agendar pra você.`;
    } else {
      aiContent = 'Entendi! Como posso ajudar?';
    }
  }

  // Fallback for empty AI response - use default greeting instead of throwing error
  if (!aiContent) {
    console.warn('[Nina] Empty AI response received, using fallback');
    aiContent = 'Olá! Como posso ajudar você hoje? 😊';
  }

  console.log('[Nina] Final response length:', aiContent.length);

  // Calculate response time
  const responseTime = Date.now() - new Date(message.sent_at).getTime();

  // Update original message as processed
  await supabase
    .from('messages')
    .update({ 
      processed_by_nina: true,
      nina_response_time: responseTime
    })
    .eq('id', message.id);

  // Add response delay if configured
  const delayMin = settings?.response_delay_min || 1000;
  const delayMax = settings?.response_delay_max || 3000;
  const delay = Math.random() * (delayMax - delayMin) + delayMin;

  // Check if audio response should be sent - pure mirroring: only respond with audio if incoming was audio
  const incomingWasAudio = message.type === 'audio';
  const shouldSendAudio = incomingWasAudio && settings?.elevenlabs_api_key;

  if (shouldSendAudio) {
    console.log(`[Nina] Audio response enabled (incoming was audio: ${incomingWasAudio})`);
    
    const audioBuffer = await generateAudioElevenLabs(settings, aiContent);
    
    if (audioBuffer) {
      const audioUrl = await uploadAudioToStorage(supabase, audioBuffer, conversation.id);
      
      if (audioUrl) {
        const { error: sendQueueError } = await supabase
          .from('send_queue')
          .insert({
            conversation_id: conversation.id,
            contact_id: conversation.contact_id,
            content: aiContent,
            from_type: 'nina',
            message_type: 'audio',
            media_url: audioUrl,
            priority: 1,
            scheduled_at: new Date(Date.now() + delay).toISOString(),
            metadata: {
              response_to_message_id: message.id,
              ai_model: aiSettings.model,
              audio_generated: true,
              text_content: aiContent,
              appointment_created: appointmentCreated?.id || null
            }
          });

        if (sendQueueError) {
          console.error('[Nina] Error queuing audio response:', sendQueueError);
          throw sendQueueError;
        }

        console.log('[Nina] Audio response queued for sending');
      } else {
        console.log('[Nina] Failed to upload audio, falling back to text');
        await queueTextResponse(supabase, conversation, message, aiContent, settings, aiSettings, delay, appointmentCreated);
      }
    } else {
      console.log('[Nina] Failed to generate audio, falling back to text');
      await queueTextResponse(supabase, conversation, message, aiContent, settings, aiSettings, delay, appointmentCreated);
    }
  } else {
    await queueTextResponse(supabase, conversation, message, aiContent, settings, aiSettings, delay, appointmentCreated);
  }

  // Trigger whatsapp-sender (fire-and-forget intencional: não bloqueia resposta ao candidato).
  // FIX-A review: removido try/catch morto (fetch async nunca lança síncrono); .catch() real cobre a rejeição.
  const senderUrl = `${supabaseUrl}/functions/v1/whatsapp-sender`;
  console.log('[Nina] Triggering whatsapp-sender at:', senderUrl);
  fetch(senderUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ triggered_by: 'nina-orchestrator' })
  }).catch(err => console.error('[Nina] Error triggering whatsapp-sender:', err));

  // Trigger analyze-conversation (fire-and-forget intencional)
  fetch(`${supabaseUrl}/functions/v1/analyze-conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      user_message: message.content,
      ai_response: aiContent,
      current_memory: clientMemory
    })
  }).catch(err => console.error('[Nina] Error triggering analyze-conversation:', err));
}

// Helper function to queue text response with chunking
async function queueTextResponse(
  supabase: any,
  conversation: any,
  message: any,
  aiContent: string,
  settings: any,
  aiSettings: any,
  delay: number,
  appointmentCreated?: any
) {
  // Break message into chunks if enabled
  const messageChunks = settings?.message_breaking_enabled 
    ? breakMessageIntoChunks(aiContent)
    : [aiContent];

  console.log(`[Nina] Sending ${messageChunks.length} text message chunk(s)`);

  // Queue each chunk for sending
  for (let i = 0; i < messageChunks.length; i++) {
    const chunkDelay = delay + (i * 1500);
    
    const { error: sendQueueError } = await supabase
      .from('send_queue')
      .insert({
        conversation_id: conversation.id,
        contact_id: conversation.contact_id,
        content: messageChunks[i],
        from_type: 'nina',
        message_type: 'text',
        priority: 1,
        scheduled_at: new Date(Date.now() + chunkDelay).toISOString(),
        metadata: {
          response_to_message_id: message.id,
          ai_model: aiSettings.model,
          chunk_index: i,
          total_chunks: messageChunks.length,
          appointment_created: appointmentCreated?.id || null
        }
      });

    if (sendQueueError) {
      console.error('[Nina] Error queuing response chunk:', sendQueueError);
      throw sendQueueError;
    }
  }

  console.log('[Nina] Text response(s) queued for sending');
}

function getDefaultSystemPrompt(): string {
  return `Você é a Nina, recrutadora virtual brasileira, simpática, profissional e empática. Você atende candidatos via WhatsApp em nome da empresa contratante. Seu papel é qualificar candidatos para vagas em aberto e agendar a primeira entrevista com o(a) recrutador(a) humano(a).

# Tom de voz
- Cordial, acolhedora, sem ser informal demais
- Português brasileiro, frases curtas
- Use o nome do candidato quando ele se apresentar
- NUNCA prometa que o candidato será aprovado, contratado ou chamado para entrevista antes de qualificar
- NUNCA dê parecer técnico sobre o currículo (deixe pro recrutador humano)

# 5 eixos de qualificação que você precisa descobrir
1. **Experiência relevante** (anos + área de atuação)
2. **Modalidade de contrato preferida** (CLT / PJ / Estágio)
3. **Pretensão salarial** (faixa, abordagem suave — explique que é pra alinhar expectativas)
4. **Disponibilidade de início** (imediata, 30 dias, 60+ dias)
5. **Localização / regime de trabalho** (remoto / híbrido / presencial; cidade)

Você NÃO precisa coletar todos os 5 numa única mensagem. Distribua ao longo da conversa, máximo 1-2 eixos por turno.

# FLUXO OBRIGATÓRIO (siga sempre nesta ordem)
1. Pergunte qual vaga interessou o candidato (ou se foi indicação espontânea, pergunte área de interesse)
2. Chame \`recommend_vacancies(...)\` quando tiver área/título mencionado — receba opções com recrutadores disponíveis
3. Apresente até 3 vagas que combinam ao candidato (ou confirme a vaga específica se ele citou nome exato)
4. Colete os 5 eixos de qualificação ao longo dos turnos (não pule, não invente respostas)
5. Após confirmação do candidato sobre uma vaga específica + qualificação mínima coletada, ofereça 3 janelas de horário pra entrevista inicial
6. Chame \`schedule_interview(vacancy_id, recruiter_id, ...)\` somente depois de candidato escolher horário
7. NUNCA chame schedule_interview sem vacancy_id e recruiter_id reais. NUNCA invente UUIDs.

# REGRA DE FECHAMENTO
Se o candidato confirmou vaga + janela em uma mensagem (ou em resposta direta a oferta de horários do turno anterior):
PULE recommend_vacancies/list e chame schedule_interview DIRETO com os IDs do turno anterior.
Re-listar vagas desperdiça o tempo do candidato.

EXEMPLO CORRETO:
Turno N Nina: "Achei essas 3 vagas que combinam: A (id=...), B (id=...), C (id=...). Qual te interessa?"
Turno N+1 Candidato: "A vaga A, quinta 28/05 às 14h funciona"
Sua ação: schedule_interview({vacancy_id: "<id-real-de-A-do-turno-N>", recruiter_id: "<id-real>", janela_preferida: "..."})
Sua resposta: "Pré-entrevista registrada com a recrutadora Ana. Você recebe lembrete um dia antes."

# Red flags — ESCALE para recrutador humano (não rejeite, não agende)
1. Candidato menciona processo trabalhista anterior ou conflito jurídico com empregador
2. Pretensão salarial está mais de 50% acima da faixa da vaga (ofenderia ou geraria expectativa quebrada)
3. Indisponibilidade total de horário (sem janela viável nas próximas 2 semanas)

Em qualquer um dos 3 casos, responda algo como:
"Entendi. Esse ponto vou repassar pro recrutador humano avaliar diretamente com você. Em breve alguém da equipe entra em contato."
E pare por aí (não chame schedule_interview, não pergunte mais nada relacionado a horário).

# Guardrails de produto
- Você NÃO promete vaga ("vou registrar seu perfil pro recrutador avaliar")
- Você NÃO dá feedback sobre o currículo ("o recrutador analisará no momento da entrevista")
- Você NÃO discute salário fixo ("vou registrar sua faixa e o recrutador alinha na entrevista")
- Você NÃO compara candidatos
- Você NÃO promete prazo de contratação

# Pretensão salarial — abordagem suave
Use exatamente uma destas frases na primeira vez:
- "Pra alinhar expectativas e não perder o seu tempo nem o da empresa, qual sua faixa de pretensão pra contratação CLT? (ou PJ, se for o caso)"
- "Você consegue me dar uma ideia da sua pretensão salarial? Isso evita desencontro lá na frente."

Se candidato resistir ("prefiro não dizer"), aceite e siga. Não insista.

# Ferramentas que você usa
- \`recommend_vacancies(area, senioridade, modalidade, ...)\`: lista vagas compatíveis com perfil
- \`list_recruiters_for_area(area_slug)\`: lista recrutadores disponíveis para uma área
- \`schedule_interview(vacancy_id, recruiter_id, janela_preferida, ...)\`: registra pré-entrevista
- \`register_candidate_interest(vacancy_id, ...)\`: parqueia perfil pra vaga sem agendar (útil quando candidato não cabe agora mas é bom perfil)
- \`confirm_interview(contact_id?)\`, \`cancel_interview(contact_id?, reason?)\`, \`reschedule_interview_request(contact_id?)\`: respondem a "1/confirmo", "2/remarcar", "3/cancelar" em resposta a lembretes D-1/D-0. Atuam SEMPRE sobre a PRÓXIMA pré-entrevista futura do contato.

# <reminder_response_protocol>
Quando o candidato responde a um lembrete (a mensagem prévia da Nina foi do tipo template HSM \`interview_reminder_d1\` ou \`interview_reminder_d0\`):
- "1", "confirmo", "sim", "ok", "vou comparecer", "estarei lá" → chame \`confirm_interview()\`
- "2", "remarcar", "preciso remarcar", "trocar horário", "outro horário" → chame \`reschedule_interview_request()\` e, em seguida, ofereça novas janelas
- "3", "cancelar", "não posso", "desistir", "não vou mais" → chame \`cancel_interview()\`; se o candidato deu motivo, passe como \`reason\`

Se a resposta for ambígua (ex: "tá", "talvez", "vamos ver"), pergunte: "Você quer confirmar (1), remarcar (2) ou cancelar (3)?"
NUNCA invoque schedule_interview neste fluxo — use somente as 3 tools acima.
# </reminder_response_protocol>

NUNCA invente parâmetros. NUNCA chame ferramenta sem dado real do turno atual ou anterior.

# Fechamento de turno
Toda mensagem sua termina com 1 pergunta clara OU 1 confirmação inequívoca. Nunca deixe o candidato sem saber o que responder.

Data e hora atual: {{ data_hora }} ({{ dia_semana }})`;
}

function processPromptTemplate(prompt: string, contact: any): string {
  const now = new Date();
  const brOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo' };
  
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { 
    ...brOptions, 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', { 
    ...brOptions, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false
  });
  const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { 
    ...brOptions, 
    weekday: 'long' 
  });
  
  const variables: Record<string, string> = {
    'data_hora': `${dateFormatter.format(now)} ${timeFormatter.format(now)}`,
    'data': dateFormatter.format(now),
    'hora': timeFormatter.format(now),
    'dia_semana': weekdayFormatter.format(now),
    'cliente_nome': contact?.name || contact?.call_name || 'Cliente',
    'cliente_telefone': contact?.phone_number || '',
  };
  
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
    return variables[varName] || match;
  });
}

function buildEnhancedPrompt(basePrompt: string, contact: any, memory: any): string {
  let contextInfo = '';

  if (contact) {
    contextInfo += `\n\nCONTEXTO DO CLIENTE:`;
    if (contact.name) contextInfo += `\n- Nome: ${contact.name}`;
    if (contact.call_name) contextInfo += ` (trate por: ${contact.call_name})`;
    if (contact.tags?.length) contextInfo += `\n- Tags: ${contact.tags.join(', ')}`;
  }

  if (memory && Object.keys(memory).length > 0) {
    contextInfo += `\n\nMEMÓRIA DO CLIENTE:`;
    
    if (memory.lead_profile) {
      const lp = memory.lead_profile;
      if (lp.interests?.length) contextInfo += `\n- Interesses: ${lp.interests.join(', ')}`;
      if (lp.products_discussed?.length) contextInfo += `\n- Produtos discutidos: ${lp.products_discussed.join(', ')}`;
      if (lp.lead_stage) contextInfo += `\n- Estágio: ${lp.lead_stage}`;
    }
    
    if (memory.sales_intelligence) {
      const si = memory.sales_intelligence;
      if (si.pain_points?.length) contextInfo += `\n- Dores: ${si.pain_points.join(', ')}`;
      if (si.next_best_action) contextInfo += `\n- Próxima ação sugerida: ${si.next_best_action}`;
    }
  }

  return basePrompt + contextInfo;
}

function breakMessageIntoChunks(content: string): string[] {
  const chunks = content
    .split(/\n\n+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
  
  return chunks.length > 0 ? chunks : [content];
}

function getModelSettings(
  settings: any,
  conversationHistory: any[],
  message: any,
  contact: any,
  clientMemory: any
): { model: string; temperature: number } {
  const modelMode = settings?.ai_model_mode || 'flash';
  
  switch (modelMode) {
    case 'flash':
      return { model: 'google/gemini-2.5-flash', temperature: 0.7 };
    case 'pro':
      return { model: 'google/gemini-2.5-pro', temperature: 0.7 };
    case 'pro3':
      return { model: 'google/gemini-3-pro-preview', temperature: 0.7 };
    case 'adaptive':
      return getAdaptiveSettings(conversationHistory, message, contact, clientMemory);
    default:
      return { model: 'google/gemini-2.5-flash', temperature: 0.7 };
  }
}

function getAdaptiveSettings(
  conversationHistory: any[], 
  message: any, 
  contact: any,
  clientMemory: any
): { model: string; temperature: number } {
  const defaultSettings = {
    model: 'google/gemini-2.5-flash',
    temperature: 0.7
  };

  const messageCount = conversationHistory.length;
  const userContent = message.content?.toLowerCase() || '';
  
  const isComplaintKeywords = ['problema', 'erro', 'não funciona', 'reclamação', 'péssimo', 'horrível'];
  const isSalesKeywords = ['preço', 'valor', 'desconto', 'comprar', 'contratar', 'plano'];
  const isTechnicalKeywords = ['como funciona', 'integração', 'api', 'configurar', 'instalar'];
  const isUrgentKeywords = ['urgente', 'agora', 'rápido', 'emergência'];

  const isComplaint = isComplaintKeywords.some(k => userContent.includes(k));
  const isSales = isSalesKeywords.some(k => userContent.includes(k));
  const isTechnical = isTechnicalKeywords.some(k => userContent.includes(k));
  const isUrgent = isUrgentKeywords.some(k => userContent.includes(k));
  
  const leadStage = clientMemory?.lead_profile?.lead_stage;
  const qualificationScore = clientMemory?.lead_profile?.qualification_score || 0;

  if (isComplaint || isUrgent) {
    return {
      model: 'google/gemini-2.5-pro',
      temperature: 0.3
    };
  }

  if (isSales && qualificationScore > 50) {
    return {
      model: 'google/gemini-2.5-flash',
      temperature: 0.5
    };
  }

  if (isTechnical) {
    return {
      model: 'google/gemini-2.5-pro',
      temperature: 0.4
    };
  }

  if (messageCount < 5) {
    return {
      model: 'google/gemini-2.5-flash',
      temperature: 0.8
    };
  }

  if (messageCount > 15) {
    return {
      model: 'google/gemini-2.5-flash',
      temperature: 0.5
    };
  }

  return defaultSettings;
}
