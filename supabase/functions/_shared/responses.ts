// Helpers de response JSON com CORS já aplicado.
import { corsHeaders } from './cors.ts';

export function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function jsonErr(error: string, status = 400, extras?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error, ...(extras ?? {}) }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
