import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/digest. H-44: el digest usa el mismo remitente que src/lib/email.ts
 * (EMAIL_FROM). 2026-10-16: plantilla de marca, idioma del suscriptor, sin datos internos.
 * Resend y Supabase se mockean: ninguna prueba manda correo ni lee la base.
 */

const { sendMock, ctorMock, tables, reads, updates } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  updates: [] as unknown[],
  ctorMock: vi.fn(),
  tables: {} as Record<string, { data: unknown; error: null }>,
  reads: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: sendMock };
    constructor(key: string) {
      ctorMock(key);
    }
  },
}));

/* Constructor de consultas falso: cada metodo encadena y al hacer await
 * resuelve lo que la tabla tenga en `tables`. */
type Chain = { [method: string]: unknown };
function chain(table: string): Chain {
  const c: Chain = {};
  for (const m of ["select", "eq", "gte", "lt", "order", "limit", "in", "or"]) c[m] = () => c;
  c.update = (v: unknown) => {
    updates.push(v);
    return c;
  };
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(tables[table] ?? { data: null, error: null }).then(resolve, reject);
  return c;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      reads.push(table);
      return chain(table);
    },
  }),
}));
vi.mock("@/lib/email-config", () => ({ getWelcomeContent: async () => ({}) }));

async function freshRoute() {
  vi.resetModules();
  const route = await import("./route");
  const email = await import("@/lib/email");
  return { GET: route.GET, EMAIL_FROM: email.EMAIL_FROM };
}

function get(GET: (req: NextRequest) => Promise<Response>) {
  return GET(
    new NextRequest("http://localhost/api/cron/digest", {
      headers: { authorization: "Bearer secreto-de-prueba" },
    })
  );
}

describe("GET /api/cron/digest", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { data: [{ id: "correo-falso" }], errors: [] }, error: null });
    ctorMock.mockClear();
    reads.length = 0;
    updates.length = 0;
    process.env.CRON_SECRET = "secreto-de-prueba";
    process.env.RESEND_API_KEY = "re_prueba_no_real";
    tables.prompts = {
      data: [{ id: "VD-0001", title_es: "Guion de 60 segundos", title_en: "60-Second Script", category: "video" }],
      error: null,
    };
    tables.newsletter_subscribers = {
      data: [{ email: "suscriptor@ejemplo.com", unsubscribe_token: "t1", user_id: null }],
      error: null,
    };
    tables.profiles = { data: [], error: null };
    tables.waitlist = { data: [], error: null };
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("manda con EMAIL_FROM cuando esta definida", async () => {
    process.env.EMAIL_FROM = "Prueba ARTO <prueba@ejemplo.com>";
    const { GET, EMAIL_FROM } = await freshRoute();
    expect(EMAIL_FROM).toBe("Prueba ARTO <prueba@ejemplo.com>");

    const res = await get(GET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(ctorMock).toHaveBeenCalledWith("re_prueba_no_real");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0][0]).toMatchObject({
      from: "Prueba ARTO <prueba@ejemplo.com>",
      to: "suscriptor@ejemplo.com",
    });
    expect(sendMock.mock.calls[0][1].batchValidation).toBe("permissive");
    expect(sendMock.mock.calls[0][1].idempotencyKey).toMatch(/^digest-\d{4}-\d{2}-\d{2}-[0-9a-f]{32}$/);
    expect(updates).toHaveLength(1);
  });

  it("sin EMAIL_FROM usa el mismo default que email.ts, no noreply@artostudio.ai", async () => {
    delete process.env.EMAIL_FROM;
    const { GET, EMAIL_FROM } = await freshRoute();
    expect(EMAIL_FROM).toBe("ARTO Studio AI <onboarding@resend.dev>");

    await get(GET);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const from = sendMock.mock.calls[0][0][0].from;
    expect(from).toBe(EMAIL_FROM);
    expect(from).not.toContain("noreply@artostudio.ai");
  });

  it("401 sin secreto y sin tocar Resend", async () => {
    const { GET } = await freshRoute();
    const res = await GET(new NextRequest("http://localhost/api/cron/digest"));
    expect(res.status).toBe(401);
    expect(ctorMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("plantilla de marca en espanol por defecto, con texto plano y baja de un clic", async () => {
    const { GET } = await freshRoute();
    await get(GET);
    const msg = sendMock.mock.calls[0][0][0];
    expect(msg.html).toContain('lang="es"');
    expect(msg.html).toContain("Guion de 60 segundos");
    expect(msg.text).toContain("Darme de baja:");
    expect(msg.headers["List-Unsubscribe"]).toContain("token=t1&lang=es");
    expect(msg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(msg.html).not.toMatch(/Top searches|Gap|similarity/);
    expect(reads).not.toContain("search_queries");
  });

  it("usa el idioma guardado: registro primero, luego lista de espera", async () => {
    tables.newsletter_subscribers = {
      data: [
        { email: "a@ejemplo.com", unsubscribe_token: "ta", user_id: "u1" },
        { email: "b@ejemplo.com", unsubscribe_token: "tb", user_id: null },
        { email: "c@ejemplo.com", unsubscribe_token: "tc", user_id: null },
      ],
      error: null,
    };
    tables.profiles = { data: [{ id: "u1", signup_locale: "en" }], error: null };
    tables.waitlist = { data: [{ email: "b@ejemplo.com", locale: "en" }], error: null };
    const { GET } = await freshRoute();
    await get(GET);
    const byTo = Object.fromEntries(sendMock.mock.calls[0][0].map((m: { to: string }) => [m.to, m]));
    expect(byTo["a@ejemplo.com"].html).toContain("60-Second Script");
    expect(byTo["b@ejemplo.com"].html).toContain('lang="en"');
    expect(byTo["c@ejemplo.com"].html).toContain('lang="es"');
  });

  it("sin destacados no manda nada", async () => {
    tables.prompts = { data: [], error: null };
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(await res.json()).toMatchObject({ ok: true, sent: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("un error de Resend cuenta como fallo, no como enviado, y no marca last_sent_at", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "rechazado" } });
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(await res.json()).toEqual({ ok: true, sent: 0, failed: 1 });
    expect(updates).toHaveLength(0);
  });

  it("ante el limite de Resend espera y reintenta una vez con la misma clave", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", message: "despacio" } });
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(await res.json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][1].idempotencyKey).toBe(sendMock.mock.calls[0][1].idempotencyKey);
  });

  it("un correo rechazado en el lote no tumba a los demas", async () => {
    tables.newsletter_subscribers = {
      data: [
        { email: "a@ejemplo.com", unsubscribe_token: "ta", user_id: null },
        { email: "malo", unsubscribe_token: "tb", user_id: null },
        { email: "c@ejemplo.com", unsubscribe_token: "tc", user_id: null },
      ],
      error: null,
    };
    sendMock.mockResolvedValueOnce({ data: { data: [{ id: "1" }, { id: "3" }], errors: [{ index: 1, message: "invalid to" }] }, error: null });
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(await res.json()).toEqual({ ok: true, sent: 2, failed: 1 });
    expect(updates).toHaveLength(1);
  });

  it("manda en lotes de 100", async () => {
    tables.newsletter_subscribers = {
      data: Array.from({ length: 150 }, (_, i) => ({ email: `s${i}@ejemplo.com`, unsubscribe_token: `t${i}`, user_id: null })),
      error: null,
    };
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(await res.json()).toEqual({ ok: true, sent: 150, failed: 0 });
    expect(sendMock.mock.calls.map((c) => c[0].length)).toEqual([100, 50]);
  });

  it("un error de base responde 500 y no manda", async () => {
    tables.newsletter_subscribers = { data: null, error: { message: "caida" } } as never;
    const { GET } = await freshRoute();
    const res = await get(GET);
    expect(res.status).toBe(500);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
