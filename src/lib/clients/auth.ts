import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyApiKey, consumeTrialCall, type Client } from "./store";

/**
 * Client authentication + rate limiting for gated skill endpoints.
 * Public skills (e.g. brand-roast) bypass this.
 *
 * Desde el 2026-09-11 (Fase 1B) esta funcion tambien CONSUME la llamada del trial
 * de forma atomica (ver consumeTrialCall en store.ts). El engine ya no incrementa
 * el contador; llamar a requireClientAuth con ok:true equivale a haber gastado
 * una llamada. Por eso la ruta valida el body antes de llamar aqui: un 400 no
 * debe costar una llamada.
 */

export type AuthResult =
  | { ok: true; client: Client }
  | {
      ok: false;
      status: 401 | 403 | 429 | 503;
      error: string;
      /** Present on 429 when the limit is a lifetime trial exhaustion, not an hourly rate limit. */
      upgrade_url?: string;
    };

export async function requireClientAuth(
  request: NextRequest,
  skillSlug: string
): Promise<AuthResult> {
  const rawKey =
    request.headers.get("x-arto-api-key") ||
    request.headers.get("X-Arto-Api-Key") ||
    "";

  if (!rawKey) {
    return {
      ok: false,
      status: 401,
      error:
        "Missing API key. Include the header 'x-arto-api-key: arto_live_...' to call gated skills.",
    };
  }

  const client = await verifyApiKey(rawKey);
  if (!client) {
    return {
      ok: false,
      status: 401,
      error: "Invalid or revoked API key.",
    };
  }

  // Check skill access
  const allowed =
    client.allowed_skills.includes("*") || client.allowed_skills.includes(skillSlug);
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: `This API key does not have access to skill '${skillSlug}'. Contact your ARTO account manager to upgrade.`,
    };
  }

  const exhausted = (): AuthResult => ({
    ok: false,
    status: 429,
    error: `Trial exhausted — you've used all ${client.trial_calls_limit} free calls. Upgrade to continue.`,
    upgrade_url: `/upgrade?client_id=${client.id}`,
  });

  // Pre-check barato con la fila que ya leimos: mensaje claro y sin tocar el
  // rate limit cuando el trial ya esta agotado. La garantia real es el UPDATE de abajo.
  if (
    client.trial_calls_limit !== null &&
    client.trial_calls_used >= client.trial_calls_limit
  ) {
    return exhausted();
  }

  // Rate limit per client (hourly, persistente en Postgres). Va antes del consumo
  // para que un 429 por hora no gaste una llamada del trial.
  const rl = await checkRateLimit(`client:${client.id}`, client.rate_limit_per_hour);
  if (rl.limited) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded (${client.rate_limit_per_hour}/hour). Try again later.`,
    };
  }

  // Consumo atomico: UPDATE ... WHERE trial_calls_used < trial_calls_limit RETURNING.
  // Cierra la carrera entre el check y el increment (antes eran dos queries).
  const consumed = await consumeTrialCall(client.id);
  if (!consumed.ok) {
    if (consumed.reason === "exhausted") return exhausted();
    return {
      ok: false,
      status: 503,
      error: "Could not register the call. Try again in a few seconds.",
    };
  }

  return { ok: true, client: { ...client, trial_calls_used: consumed.used } };
}
