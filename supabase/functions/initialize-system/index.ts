import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a unique verify token
function generateVerifyToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'nina-rh-';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Default pipeline stages — Nina RH (funil de recrutamento)
const DEFAULT_PIPELINE_STAGES = [
  {
    position: 1, title: 'Novo Candidato', color: '#94A3B8',
    is_system: false, is_ai_managed: true,
    ai_trigger_criteria: 'Candidato acabou de entrar — primeiro contato ainda não respondido. Nina abordou ou está pra abordar pela primeira vez. Default no início da conversa.',
  },
  {
    position: 2, title: 'Triando', color: '#3B82F6',
    is_system: false, is_ai_managed: true,
    ai_trigger_criteria: 'Nina está em conversa ativa coletando os 5 eixos de qualificação RH (experiência, modalidade contrato, pretensão salarial, disponibilidade, localização). Candidato respondeu ao menos 1 turno mas não completou todos os eixos.',
  },
  {
    position: 3, title: 'Qualificado', color: '#10B981',
    is_system: false, is_ai_managed: true,
    ai_trigger_criteria: 'Candidato tem perfil compatível com alguma vaga aberta — pelo menos 3 dos 5 eixos coletados E nenhum red_flag identificado E há vaga matching no catálogo. Nina pode oferecer entrevista.',
  },
  {
    position: 4, title: 'Entrevista Agendada', color: '#8B5CF6',
    is_system: false, is_ai_managed: true,
    ai_trigger_criteria: 'Nina já criou appointment de entrevista com vacancy_id + recruiter_id reais. Status do appointment é agendamento_pendente, agendado ou confirmado. Trigger SQL costuma mover automaticamente.',
  },
  {
    position: 5, title: 'Entrevistado', color: '#F59E0B',
    is_system: false, is_ai_managed: false,
    ai_trigger_criteria: null,
  },
  {
    position: 6, title: 'Aprovado', color: '#22C55E',
    is_system: true, is_ai_managed: false,
    ai_trigger_criteria: null,
  },
  {
    position: 7, title: 'Banco de Talentos', color: '#64748B',
    is_system: true, is_ai_managed: false,
    ai_trigger_criteria: null,
  },
];

// Default tag definitions — Nina RH (5 categorias × ~4 valores)
const DEFAULT_TAG_DEFINITIONS = [
  // modalidade_contrato
  { key: 'clt',       label: 'CLT',       color: '#3B82F6', category: 'modalidade_contrato' },
  { key: 'pj',        label: 'PJ',        color: '#8B5CF6', category: 'modalidade_contrato' },
  { key: 'estagio',   label: 'Estágio',   color: '#10B981', category: 'modalidade_contrato' },
  { key: 'freelance', label: 'Freelance', color: '#F59E0B', category: 'modalidade_contrato' },

  // senioridade
  { key: 'junior',       label: 'Júnior',             color: '#94A3B8', category: 'senioridade' },
  { key: 'pleno',        label: 'Pleno',              color: '#3B82F6', category: 'senioridade' },
  { key: 'senior',       label: 'Sênior',             color: '#22C55E', category: 'senioridade' },
  { key: 'especialista', label: 'Especialista/Lead',  color: '#F97316', category: 'senioridade' },

  // regime_trabalho
  { key: 'remoto',     label: 'Remoto',     color: '#10B981', category: 'regime_trabalho' },
  { key: 'hibrido',    label: 'Híbrido',    color: '#8B5CF6', category: 'regime_trabalho' },
  { key: 'presencial', label: 'Presencial', color: '#64748B', category: 'regime_trabalho' },

  // area_atuacao
  { key: 'tecnologia', label: 'Tecnologia', color: '#3B82F6', category: 'area_atuacao' },
  { key: 'comercial',  label: 'Comercial',  color: '#22C55E', category: 'area_atuacao' },
  { key: 'marketing',  label: 'Marketing',  color: '#F97316', category: 'area_atuacao' },
  { key: 'operacoes',  label: 'Operações',  color: '#64748B', category: 'area_atuacao' },
  { key: 'financeiro', label: 'Financeiro', color: '#10B981', category: 'area_atuacao' },

  // origem_candidato
  { key: 'linkedin',  label: 'LinkedIn',     color: '#0A66C2', category: 'origem_candidato' },
  { key: 'indeed',    label: 'Indeed',       color: '#2164F3', category: 'origem_candidato' },
  { key: 'indicacao', label: 'Indicação',    color: '#22C55E', category: 'origem_candidato' },
  { key: 'site',      label: 'Site próprio', color: '#64748B', category: 'origem_candidato' },
];

// Default teams — Nina RH
const DEFAULT_TEAMS = [
  { name: 'Triagem',        description: 'Primeira filtragem de candidatos (Nina IA + apoio humano)', color: '#3B82F6', is_active: true },
  { name: 'Agendamento',    description: 'Coordenação de horários de entrevistas',                     color: '#8B5CF6', is_active: true },
  { name: 'Coordenação RH', description: 'Liderança e fechamento de processos',                       color: '#22C55E', is_active: true },
  { name: 'Pós-Entrevista', description: 'Feedback, follow-up e onboarding',                          color: '#F59E0B', is_active: true },
];

// Default team functions — Nina RH
const DEFAULT_TEAM_FUNCTIONS = [
  { name: 'Recrutador(a)',        description: 'Conduz triagem e entrevistas iniciais',         is_active: true },
  { name: 'Coordenador(a) de RH', description: 'Lidera processos e fechamento de contratação', is_active: true },
  { name: 'Headhunter',           description: 'Caça ativa de candidatos para vagas-chave',     is_active: true },
  { name: 'Analista de RH',       description: 'Apoio operacional em triagem e documentação',   is_active: true },
];

// Default system prompt for Nina RH
const DEFAULT_SYSTEM_PROMPT = `Você é a Nina, recrutadora virtual brasileira, simpática, profissional e empática. Você atende candidatos via WhatsApp em nome da empresa contratante. Seu papel é qualificar candidatos para vagas em aberto e agendar a primeira entrevista com o(a) recrutador(a) humano(a).

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

// Default nina_settings values for a fresh system
const DEFAULT_NINA_SETTINGS = {
  is_active: true,
  auto_response_enabled: true,
  ai_model_mode: 'pro3',
  timezone: 'America/Sao_Paulo',
  business_hours_start: '09:00:00',
  business_hours_end: '18:00:00',
  business_days: [1, 2, 3, 4, 5],
  audio_response_enabled: false,
  response_delay_min: 1000,
  response_delay_max: 3000,
  message_breaking_enabled: true,
  adaptive_response_enabled: true,
  ai_scheduling_enabled: true,
  route_all_to_receiver_enabled: false,
  company_name: 'Nina RH',
  sdr_name: 'Nina',
  system_prompt_override: DEFAULT_SYSTEM_PROMPT,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Bootstrap de config de ambiente pros crons (DB→Edge). Idempotente — roda
    // toda vez que initialize-system roda. Elimina a necessidade de setar GUCs
    // app.* à mão (impossível no Lovable Cloud).
    try {
      await supabase.rpc('set_app_config', {
        p_key: 'edge_base_url',
        p_value: `${supabaseUrl}/functions/v1`,
      });
      await supabase.rpc('set_app_config', {
        p_key: 'service_role_key',
        p_value: supabaseServiceKey,
      });
      console.log('[initialize-system] app_config bootstrap ok');
    } catch (e) {
      console.error('[initialize-system] app_config bootstrap failed (non-fatal):', e);
    }

    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body.user_id || null;
    } catch {
      // Body might be empty
    }

    if (!userId) {
      console.error('[initialize-system] No user_id provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id is required in request body',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('[initialize-system] Initializing for user:', userId);

    const results = {
      profile: { initialized: false, existed: false },
      user_role: { assigned: false, role: '', existed: false },
      nina_settings: { initialized: false, existed: false, isFirstUser: false },
      pipeline_stages: { initialized: false, existed: false, count: 0 },
      tag_definitions: { initialized: false, existed: false, count: 0 },
      teams: { initialized: false, existed: false, count: 0 },
      team_functions: { initialized: false, existed: false, count: 0 },
      verify_token: { generated: false, token: '' },
    };

    // 0. Ensure profile exists for this user
    console.log('[initialize-system] Checking profile for user...');
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingProfile) {
      console.log('[initialize-system] Profile already exists for user');
      results.profile.existed = true;
    } else {
      console.log('[initialize-system] Creating profile for user...');
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const fullName = userData?.user?.user_metadata?.full_name || 
                       userData?.user?.email?.split('@')[0] || 
                       'Usuário';
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
        });

      if (profileError) {
        if (profileError.code === '23505') {
          console.log('[initialize-system] Profile already exists (race condition)');
          results.profile.existed = true;
        } else {
          console.error('[initialize-system] Error creating profile:', profileError);
        }
      } else {
        results.profile.initialized = true;
        console.log('[initialize-system] Profile created successfully');
      }
    }

    // Check if this is the FIRST user (no existing global settings)
    console.log('[initialize-system] Checking if global nina_settings exist...');
    const { data: existingGlobalSettings } = await supabase
      .from('nina_settings')
      .select('id, whatsapp_verify_token')
      .limit(1)
      .maybeSingle();

    if (existingGlobalSettings) {
      // System already configured - this is NOT the first user
      console.log('[initialize-system] Global settings already exist - not first user');
      results.nina_settings.existed = true;
      results.nina_settings.isFirstUser = false;
      
      // Just return the existing verify token
      results.verify_token.token = existingGlobalSettings.whatsapp_verify_token || '';
      
      // Don't create any more default data - system is already configured
      console.log('[initialize-system] System already initialized, skipping default data creation');

      // Assign 'user' role if user doesn't have any role yet
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        console.log('[initialize-system] User already has role:', existingRole.role);
        results.user_role.existed = true;
        results.user_role.role = existingRole.role;
      } else {
        console.log('[initialize-system] Assigning user role to subsequent user...');
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'user',
          });

        if (roleError) {
          if (roleError.code === '23505') {
            console.log('[initialize-system] User already has role (race condition)');
            results.user_role.existed = true;
          } else {
            console.error('[initialize-system] Error assigning user role:', roleError);
          }
        } else {
          results.user_role.assigned = true;
          results.user_role.role = 'user';
          console.log('[initialize-system] User role assigned');
        }
      }
      
    } else {
      // This IS the first user - create all default data (globally, without user_id)
      console.log('[initialize-system] No global settings found - this is the FIRST user!');
      results.nina_settings.isFirstUser = true;

      // Assign 'admin' role to the first user
      console.log('[initialize-system] Assigning admin role to first user...');
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
        });

      if (roleError) {
        if (roleError.code === '23505') {
          console.log('[initialize-system] User already has admin role (race condition)');
          results.user_role.existed = true;
          results.user_role.role = 'admin';
        } else {
          console.error('[initialize-system] Error assigning admin role:', roleError);
        }
      } else {
        results.user_role.assigned = true;
        results.user_role.role = 'admin';
        console.log('[initialize-system] Admin role assigned to first user');
      }

      // Create global nina_settings (user_id = NULL for global access)
      const newToken = generateVerifyToken();
      const { error: settingsError } = await supabase
        .from('nina_settings')
        .insert({
          ...DEFAULT_NINA_SETTINGS,
          whatsapp_verify_token: newToken,
          user_id: null, // Global settings - no user_id
        });

      if (settingsError) {
        if (settingsError.code === '23505') {
          console.log('[initialize-system] Settings already exist (race condition)');
          results.nina_settings.existed = true;
        } else {
          console.error('[initialize-system] Error creating nina_settings:', settingsError);
          throw settingsError;
        }
      } else {
        results.nina_settings.initialized = true;
        results.verify_token.generated = true;
        results.verify_token.token = newToken;
        console.log('[initialize-system] Global nina_settings created');
      }

      // Create global pipeline_stages (user_id = NULL)
      console.log('[initialize-system] Creating global pipeline_stages...');
      const stagesWithoutUserId = DEFAULT_PIPELINE_STAGES.map(stage => ({
        ...stage,
        user_id: null,
      }));
      
      const { error: stagesError } = await supabase
        .from('pipeline_stages')
        .insert(stagesWithoutUserId);

      if (stagesError) {
        if (stagesError.code === '23505') {
          console.log('[initialize-system] pipeline_stages already exist (race condition)');
          results.pipeline_stages.existed = true;
        } else {
          console.error('[initialize-system] Error creating pipeline_stages:', stagesError);
        }
      } else {
        results.pipeline_stages.initialized = true;
        results.pipeline_stages.count = DEFAULT_PIPELINE_STAGES.length;
        console.log(`[initialize-system] Created ${DEFAULT_PIPELINE_STAGES.length} global pipeline stages`);
      }

      // Create global tag_definitions (user_id = NULL)
      console.log('[initialize-system] Creating global tag_definitions...');
      const tagsWithoutUserId = DEFAULT_TAG_DEFINITIONS.map(tag => ({
        ...tag,
        user_id: null,
      }));
      
      const { error: tagsError } = await supabase
        .from('tag_definitions')
        .insert(tagsWithoutUserId);

      if (tagsError) {
        if (tagsError.code === '23505') {
          console.log('[initialize-system] tag_definitions already exist (race condition)');
          results.tag_definitions.existed = true;
        } else {
          console.error('[initialize-system] Error creating tag_definitions:', tagsError);
        }
      } else {
        results.tag_definitions.initialized = true;
        results.tag_definitions.count = DEFAULT_TAG_DEFINITIONS.length;
        console.log(`[initialize-system] Created ${DEFAULT_TAG_DEFINITIONS.length} global tag definitions`);
      }

      // Create global teams (user_id = NULL)
      console.log('[initialize-system] Creating global teams...');
      const teamsWithoutUserId = DEFAULT_TEAMS.map(team => ({
        ...team,
        user_id: null,
      }));
      
      const { error: teamsError } = await supabase
        .from('teams')
        .insert(teamsWithoutUserId);

      if (teamsError) {
        if (teamsError.code === '23505') {
          console.log('[initialize-system] teams already exist (race condition)');
          results.teams.existed = true;
        } else {
          console.error('[initialize-system] Error creating teams:', teamsError);
        }
      } else {
        results.teams.initialized = true;
        results.teams.count = DEFAULT_TEAMS.length;
        console.log(`[initialize-system] Created ${DEFAULT_TEAMS.length} global teams`);
      }

      // Create global team_functions (user_id = NULL)
      console.log('[initialize-system] Creating global team_functions...');
      const functionsWithoutUserId = DEFAULT_TEAM_FUNCTIONS.map(func => ({
        ...func,
        user_id: null,
      }));
      
      const { error: functionsError } = await supabase
        .from('team_functions')
        .insert(functionsWithoutUserId);

      if (functionsError) {
        if (functionsError.code === '23505') {
          console.log('[initialize-system] team_functions already exist (race condition)');
          results.team_functions.existed = true;
        } else {
          console.error('[initialize-system] Error creating team_functions:', functionsError);
        }
      } else {
        results.team_functions.initialized = true;
        results.team_functions.count = DEFAULT_TEAM_FUNCTIONS.length;
        console.log(`[initialize-system] Created ${DEFAULT_TEAM_FUNCTIONS.length} global team functions`);
      }
    }

    console.log('[initialize-system] Initialization complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: results.nina_settings.isFirstUser 
          ? 'System initialized successfully (first user)' 
          : 'User profile initialized (system already configured)',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[initialize-system] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
