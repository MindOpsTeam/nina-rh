import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthKind = 'service' | 'user' | 'cron';
export interface AuthResult {
  kind: AuthKind;
  userId?: string;
}

/**
 * Cascata 3-vias unificada (ATALHO #11):
 *   1) Bearer SUPABASE_SERVICE_ROLE_KEY → {kind:'service'}
 *   2) Bearer <JWT> válido → {kind:'user', userId}
 *   3) Header x-cron-secret == CRON_SHARED_SECRET → {kind:'cron'}
 * Retorna null se nenhuma autenticação válida foi apresentada.
 */
export async function authenticateRequest(
  req: Request,
  supabaseAdmin?: SupabaseClient,
): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (authHeader && serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return { kind: 'service' };
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const client =
        supabaseAdmin ??
        createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
        );
      const { data } = await client.auth.getUser(token);
      if (data?.user) return { kind: 'user', userId: data.user.id };
    } catch {
      // fallthrough
    }
  }

  const sharedSecret = Deno.env.get('CRON_SHARED_SECRET');
  const cronSecret = req.headers.get('x-cron-secret');
  if (sharedSecret && cronSecret && cronSecret === sharedSecret) {
    return { kind: 'cron' };
  }

  return null;
}

/**
 * Require either a valid user JWT or the service role key.
 * Returns null on success, or a Response (401) to short-circuit the request.
 */
export async function requireAuth(req: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
}

/**
 * Require the service role key (for internal/server-to-server endpoints).
 */
export function requireServiceRole(req: Request, corsHeaders: Record<string, string>): Response | null {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !serviceKey || token !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
}