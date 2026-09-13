import type { AnalyticsEvent, AnalyticsEvents } from "@/lib/analytics";
import { DEFAULT_POSTHOG_HOST } from "@/lib/analytics";

/* PostHog desde el servidor (posthog-node). Se usa donde no hay navegador:
 * /auth/callback dispara signup_completed y login_completed antes de redirigir.
 *
 * Mismas reglas que el wrapper de cliente: sin NEXT_PUBLIC_POSTHOG_KEY es no-op con
 * un solo aviso, y nunca lanza. En serverless no hay proceso vivo entre requests,
 * asi que se crea un cliente por llamada con flushAt: 1 y se espera shutdown()
 * para que el evento salga antes de que Vercel congele la funcion.
 *
 * distinctId es el id de Supabase: el mismo que usa identify() en el cliente, asi
 * PostHog junta la sesion anonima previa con la persona sin pasar por el email. */

let warned = false;

function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[analytics-server] ${message}`);
}

export async function captureServer<E extends AnalyticsEvent>(
  distinctId: string,
  event: E,
  props: AnalyticsEvents[E],
): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    warnOnce("NEXT_PUBLIC_POSTHOG_KEY ausente; eventos de servidor en modo no-op");
    return false;
  }
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  try {
    const { PostHog } = await import("posthog-node");
    const ph = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
    ph.capture({ distinctId, event, properties: { ...props, source_runtime: "server" } });
    await ph.shutdown();
    return true;
  } catch (error) {
    console.error(`[analytics-server] no se pudo mandar ${event}:`, error);
    return false;
  }
}

/** Solo para pruebas. */
export function __resetAnalyticsServerForTests(): void {
  warned = false;
}
