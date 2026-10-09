import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Webhook } from "svix";

/* POST /api/resend/webhook: 503 sin secreto, 400 con firma mala, y con firma buena solo
 * baja de active/pending a quien corresponde. Supabase se mockea. */

const db = vi.hoisted(() => ({ calls: [] as unknown[][], error: null as null | { message: string } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const q: Record<string, (...a: unknown[]) => unknown> = {};
    for (const m of ["from", "update", "in"]) q[m] = (...a: unknown[]) => (db.calls.push([m, ...a]), q);
    q.select = async () => ({ data: db.error ? null : [{ email: "ana@ejemplo.com" }], error: db.error });
    return q;
  },
}));

const SECRET = "whsec_" + Buffer.from("secreto-de-prueba-para-svix-123").toString("base64");

function signed(body: object, secret = SECRET): NextRequest {
  const payload = JSON.stringify(body);
  const id = "msg_prueba";
  const ts = new Date();
  const signature = new Webhook(secret).sign(id, ts, payload);
  return new NextRequest("http://localhost/api/resend/webhook", {
    method: "POST",
    body: payload,
    headers: { "svix-id": id, "svix-timestamp": String(Math.floor(ts.getTime() / 1000)), "svix-signature": signature },
  });
}

describe("POST /api/resend/webhook", () => {
  beforeEach(() => {
    db.calls = [];
    db.error = null;
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("503 sin secreto configurado, sin tocar la base", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const res = await POST(signed({ type: "email.complained", data: { to: ["ana@ejemplo.com"] } }));
    expect(res.status).toBe(503);
    expect(db.calls).toHaveLength(0);
  });

  it("400 con firma de otro secreto", async () => {
    const { POST } = await import("./route");
    const otro = "whsec_" + Buffer.from("otro-secreto-cualquiera-0000000").toString("base64");
    const res = await POST(signed({ type: "email.complained", data: { to: ["ana@ejemplo.com"] } }, otro));
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("queja firmada: baja solo desde active o pending", async () => {
    const { POST } = await import("./route");
    const res = await POST(signed({ type: "email.complained", data: { to: ["Ana@Ejemplo.com"] } }));
    expect(res.status).toBe(200);
    expect(db.calls).toContainEqual(["from", "newsletter_subscribers"]);
    expect(db.calls).toContainEqual(["in", "email", ["ana@ejemplo.com"]]);
    expect(db.calls).toContainEqual(["in", "status", ["active", "pending"]]);
    const update = db.calls.find((c) => c[0] === "update")?.[1] as Record<string, string>;
    expect(update.status).toBe("unsubscribed");
    expect(update.unsubscribed_at).toBeTruthy();
  });

  it("evento que no toca la lista: 200 sin tocar la base", async () => {
    const { POST } = await import("./route");
    const res = await POST(signed({ type: "email.delivered", data: { to: ["ana@ejemplo.com"] } }));
    expect(res.status).toBe(200);
    expect(db.calls).toHaveLength(0);
  });

  it("500 si la base falla, para que Resend reintente", async () => {
    db.error = { message: "db down" };
    const { POST } = await import("./route");
    const res = await POST(signed({ type: "email.complained", data: { to: ["ana@ejemplo.com"] } }));
    expect(res.status).toBe(500);
  });
});
