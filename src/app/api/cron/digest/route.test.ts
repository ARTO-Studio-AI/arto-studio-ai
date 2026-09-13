import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/digest (H-44): el digest usa el mismo remitente que
 * src/lib/email.ts (EMAIL_FROM), no uno escrito a mano. Resend y Supabase se
 * mockean: ninguna prueba manda correo ni lee la base.
 */

const { sendMock, ctorMock, tables } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  ctorMock: vi.fn(),
  tables: {} as Record<string, { data: unknown; error: null }>,
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
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
  for (const m of ["select", "eq", "gte", "lt", "order", "limit", "update"]) c[m] = () => c;
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(tables[table] ?? { data: null, error: null }).then(resolve, reject);
  return c;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => chain(table) }),
}));

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

describe("GET /api/cron/digest remitente", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "correo-falso" }, error: null });
    ctorMock.mockClear();
    process.env.CRON_SECRET = "secreto-de-prueba";
    process.env.RESEND_API_KEY = "re_prueba_no_real";
    tables.prompts = { data: [], error: null };
    tables.search_queries = { data: [], error: null };
    tables.newsletter_subscribers = {
      data: [{ email: "suscriptor@ejemplo.com", unsubscribe_token: "t1" }],
      error: null,
    };
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
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      from: "Prueba ARTO <prueba@ejemplo.com>",
      to: "suscriptor@ejemplo.com",
    });
  });

  it("sin EMAIL_FROM usa el mismo default que email.ts, no noreply@artostudio.ai", async () => {
    delete process.env.EMAIL_FROM;
    const { GET, EMAIL_FROM } = await freshRoute();
    expect(EMAIL_FROM).toBe("ARTO Studio AI <onboarding@resend.dev>");

    await get(GET);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const from = sendMock.mock.calls[0][0].from;
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
});
