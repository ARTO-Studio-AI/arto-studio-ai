import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/mailer";
import { digestEmail, type DigestPrompt } from "@/lib/email-templates/digest";
import { Resend } from "resend";
import { createHash } from "node:crypto";
import { DIGEST_STRATEGY, selectDigestPrompts, type DigestCandidate } from "@/lib/digest-selection";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Resumen semanal (cron de los martes a las 14:00 UTC, vercel.json; Victor lo movio del
 * lunes el 16 oct). Usa la plantilla de marca de src/lib/email-templates/digest.ts: cinco
 * prompts de la biblioteca, linea editorial y biblioteca, en el idioma del suscriptor. Ya
 * no lee search_queries: las busquedas de los usuarios y la brecha del catalogo son datos
 * internos y no van a la lista.
 *
 * Seleccion (src/lib/digest-selection.ts): nunca se repite un prompt. Cada envio deja su
 * fila en digest_sends (migracion 0019) ANTES de mandar, una por dia: una relanzada el
 * mismo dia reutiliza la seleccion, y si el envio falla esos prompts se dan por usados
 * (preferimos saltar un prompt a repetirlo).
 *
 * Envio por lotes (auditoria de Fable): resend.batch.send de hasta 100 correos por
 * llamada con una pausa entre lotes (Resend admite 2 solicitudes por segundo), clave de
 * idempotencia por lote y dia, y solo a quien no recibio el digest en los ultimos 6 dias:
 * si la funcion se corta o se relanza a mano, no se repite a nadie. */

/** Ventana de «publicados esta semana». prompts no tiene published_at: se usa created_at. */
const RECENT_DAYS = 7;
const PAGE = 1000;
const BATCH = 100;
const PAUSE_MS = 600;
const RESEND_EVERY_DAYS = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Tamano de cada `in(...)`: PostgREST lo manda en la URL y una lista larga la rompe. */
const CHUNK = 150;

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

/** Idioma guardado del suscriptor: el del registro (profiles.signup_locale) o el de la
 *  lista de espera (waitlist.locale). Sin dato, espanol. */
async function languages(
  admin: ReturnType<typeof createAdminClient>,
  subs: { email: string; user_id: string | null }[],
): Promise<Map<string, "es" | "en">> {
  const out = new Map<string, "es" | "en">();
  const userIds = subs.map((s) => s.user_id).filter((v): v is string => !!v);
  const byUser = new Map<string, string>();
  for (const ids of chunks(userIds)) {
    const { data, error } = await admin.from("profiles").select("id, signup_locale").in("id", ids);
    if (error) console.warn("[digest] idioma de profiles:", error.message);
    for (const p of (data ?? []) as { id: string; signup_locale: string | null }[]) {
      if (p.signup_locale) byUser.set(p.id, p.signup_locale);
    }
  }
  const byEmail = new Map<string, string>();
  // waitlist guarda el correo en minusculas; filas viejas de la lista pueden no estarlo.
  for (const emails of chunks(subs.map((s) => s.email.toLowerCase()))) {
    const { data, error } = await admin.from("waitlist").select("email, locale").in("email", emails);
    if (error) console.warn("[digest] idioma de waitlist:", error.message);
    for (const w of (data ?? []) as { email: string; locale: string | null }[]) {
      if (w.locale) byEmail.set(w.email.toLowerCase(), w.locale);
    }
  }
  for (const s of subs) {
    const raw = (s.user_id && byUser.get(s.user_id)) || byEmail.get(s.email.toLowerCase());
    out.set(s.email, raw === "en" ? "en" : "es");
  }
  return out;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Los prompts de esta semana. Si ya hay fila de hoy en digest_sends, la reutiliza; si no,
 *  sortea con la regla de digest-selection.ts y la guarda antes de devolverla. Lanza ante
 *  cualquier error de base: la ruta responde 500 y no manda nada. */
async function weeklyPrompts(admin: Admin): Promise<DigestPrompt[]> {
  const today = new Date().toISOString().slice(0, 10);
  const todays = await admin.from("digest_sends").select("prompt_ids").eq("sent_on", today).maybeSingle();
  if (todays.error) throw new Error(`digest_sends: ${todays.error.message}`);
  let ids = (todays.data?.prompt_ids as string[] | undefined) ?? null;

  if (!ids) {
    const past = await admin.from("digest_sends").select("prompt_ids");
    if (past.error) throw new Error(`digest_sends: ${past.error.message}`);
    const sentBefore = new Set(((past.data ?? []) as { prompt_ids: string[] }[]).flatMap((r) => r.prompt_ids));
    const fresh = (p: DigestCandidate) => !sentBefore.has(p.id);

    const recentSince = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
    const recent = await admin
      .from("prompts")
      .select("id, category, tier, created_at")
      .eq("is_published", true)
      .gte("created_at", recentSince)
      .order("created_at", { ascending: false })
      .limit(50);
    if (recent.error) throw new Error(`prompts recientes: ${recent.error.message}`);

    // Paginacion por cursor (id): no depende del tope de filas que tenga PostgREST.
    const pool: DigestCandidate[] = [];
    let after = "";
    for (let round = 0; round < 50; round++) {
      let q = admin.from("prompts").select("id, category, tier, created_at").eq("is_published", true);
      if (after) q = q.gt("id", after);
      const page = await q.order("id").limit(PAGE);
      if (page.error) throw new Error(`prompts: ${page.error.message}`);
      const rows = (page.data ?? []) as DigestCandidate[];
      if (rows.length === 0) break;
      pool.push(...rows);
      after = rows[rows.length - 1].id;
    }

    // Gancho apagado: «los mas usados de la semana» (por ejemplo, prompt_opens de los
    // ultimos 7 dias) entraria como `mostUsed`. Victor lo decide despues.
    const chosen = selectDigestPrompts({
      recent: ((recent.data ?? []) as DigestCandidate[]).filter(fresh),
      pool: pool.filter(fresh),
    });
    if (chosen.length === 0) return [];

    const ins = await admin.from("digest_sends").insert({ sent_on: today, prompt_ids: chosen.map((p) => p.id), strategy: DIGEST_STRATEGY });
    if (ins.error) {
      // Otra ejecucion de hoy guardo primero: se usa la suya.
      if (ins.error.code !== "23505") throw new Error(`digest_sends insert: ${ins.error.message}`);
      const again = await admin.from("digest_sends").select("prompt_ids").eq("sent_on", today).maybeSingle();
      if (again.error || !again.data) throw new Error("digest_sends: no se pudo releer la fila de hoy");
      ids = again.data.prompt_ids as string[];
    } else {
      ids = chosen.map((p) => p.id);
    }
  }

  const details = await admin.from("prompts").select("id, title_es, title_en, category, tier").eq("is_published", true).in("id", ids);
  if (details.error) throw new Error(`prompts detalle: ${details.error.message}`);
  const byId = new Map(((details.data ?? []) as DigestPrompt[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is DigestPrompt => !!p);
}

export async function GET(request: NextRequest) {
  // Auth del cron: Vercel manda `Authorization: Bearer <CRON_SECRET>`. Falla cerrado:
  // sin CRON_SECRET configurado la ruta responde 401 y no manda nada, en vez de quedar
  // abierta a cualquiera que la llame. CRON_SECRET se crea en Vercel el 2026-09-11 (D5).
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const admin = createAdminClient();

  const since = new Date(Date.now() - RESEND_EVERY_DAYS * 86_400_000).toISOString();
  const { data: subscribers, error: subsError } = await admin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token, user_id")
    .eq("status", "active")
    .or(`last_sent_at.is.null,last_sent_at.lt."${since}"`)
    // Orden estable: en una relanzada el mismo lote da la misma clave de idempotencia.
    .order("email");
  if (subsError) {
    console.error("[digest] suscriptores:", subsError.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no active subscribers" });
  }

  let prompts: DigestPrompt[];
  try {
    prompts = await weeklyPrompts(admin);
  } catch (err) {
    console.error("[digest] seleccion:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  // Sin prompts que no se hayan mandado nunca, el correo no tiene nada que decir.
  if (prompts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no prompts left" });
  }

  const subs = subscribers as { email: string; unsubscribe_token: string; user_id: string | null }[];
  const langOf = await languages(admin, subs);

  const day = new Date().toISOString().slice(0, 10);
  let sent = 0, failed = 0;
  for (let i = 0; i < subs.length; i += BATCH) {
    const group = subs.slice(i, i + BATCH);
    const payload = group.map((sub) => {
      const lang = langOf.get(sub.email) ?? "es";
      const unsub = unsubscribeUrl(sub.unsubscribe_token, lang);
      const m = digestEmail({ lang, prompts, unsubscribeUrl: unsub });
      return {
        // Mismo remitente que src/lib/email.ts (H-44); antes estaba escrito a mano.
        from: EMAIL_FROM,
        to: sub.email,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "kind", value: "digest" }],
      };
    });
    // Misma clave para el mismo lote el mismo dia: Resend no lo manda dos veces.
    const idempotencyKey = `digest-${day}-${createHash("sha256").update(group.map((g) => g.email).join(",")).digest("hex").slice(0, 32)}`;
    // permissive: una direccion que Resend rechaza no tumba a los otros 99.
    const opts = { idempotencyKey, batchValidation: "permissive" as const };
    let res = await resend.batch.send(payload, opts);
    if (res.error?.name === "rate_limit_exceeded") {
      await sleep(1500);
      res = await resend.batch.send(payload, opts);
    }
    if (res.error) {
      console.error("[digest] lote fallo:", res.error.name, res.error.message);
      failed += group.length;
    } else {
      const bad = new Set((res.data?.errors ?? []).map((e) => e.index));
      for (const e of res.data?.errors ?? []) console.error("[digest] correo rechazado:", e.index, e.message);
      const ok = group.filter((_, k) => !bad.has(k)).map((g) => g.email);
      if (ok.length) {
        const { error } = await admin
          .from("newsletter_subscribers")
          .update({ last_sent_at: new Date().toISOString() })
          .in("email", ok);
        if (error) console.error("[digest] last_sent_at:", error.message);
      }
      sent += ok.length;
      failed += group.length - ok.length;
    }
    if (i + BATCH < subs.length) await sleep(PAUSE_MS);
  }

  // Un martes con fallos no se reintenta solo (Vercel no reintenta el cron): queda en el log.
  if (failed > 0) console.error(JSON.stringify({ event: "digest_failed", sent, failed, total: subs.length }));
  return NextResponse.json({ ok: true, sent, failed });
}
