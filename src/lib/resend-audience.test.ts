import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Resend } from "resend";

/* Helper de la audiencia de Resend: sin RESEND_AUDIENCE_ID no toca el SDK y
 * avisa una sola vez; con id, crea y si el contacto ya existe, actualiza. */

const { ctorMock } = vi.hoisted(() => ({ ctorMock: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) {
      ctorMock(key);
    }
  },
}));

async function fresh() {
  vi.resetModules();
  return await import("./resend-audience");
}

function fakeResend(create: unknown, update?: unknown): Resend {
  return {
    contacts: {
      create: vi.fn().mockResolvedValue(create),
      update: vi.fn().mockResolvedValue(update ?? { data: { id: "c1" }, error: null }),
    },
  } as unknown as Resend;
}

describe("upsertAudienceContact", () => {
  const env = { ...process.env };
  let warn: MockInstance<typeof console.warn>;
  let log: MockInstance<typeof console.log>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    ctorMock.mockClear();
    delete process.env.RESEND_AUDIENCE_ID;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
    process.env.RESEND_AUDIENCE_ID = env.RESEND_AUDIENCE_ID;
    process.env.RESEND_API_KEY = env.RESEND_API_KEY;
    if (env.RESEND_AUDIENCE_ID === undefined) delete process.env.RESEND_AUDIENCE_ID;
    if (env.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
  });

  it("sin RESEND_AUDIENCE_ID no hace nada, no construye Resend y avisa una sola vez", async () => {
    process.env.RESEND_API_KEY = "re_prueba";
    const m = await fresh();
    const a = await m.upsertAudienceContact({ email: "a@b.co" });
    const b = await m.upsertAudienceContact({ email: "c@d.co", firstName: "C" });
    expect(a).toEqual({ ok: false, skipped: true, reason: "no_audience_id" });
    expect(b).toEqual({ ok: false, skipped: true, reason: "no_audience_id" });
    expect(ctorMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("RESEND_AUDIENCE_ID");
  });

  it("con id pero sin API key tampoco hace nada", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_1";
    const m = await fresh();
    expect(await m.upsertAudienceContact({ email: "a@b.co" })).toEqual({ ok: false, skipped: true, reason: "no_api_key" });
    expect(ctorMock).not.toHaveBeenCalled();
  });

  it("rechaza correos invalidos sin llamar a Resend", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_1";
    const resend = fakeResend({ data: { id: "c1" }, error: null });
    const m = await fresh();
    expect(await m.upsertAudienceContact({ email: "sin-arroba" }, { resend })).toEqual({
      ok: false,
      skipped: true,
      reason: "invalid_email",
    });
    expect(resend.contacts.create).not.toHaveBeenCalled();
  });

  it("crea el contacto en la audiencia con nombre y sin desuscribir", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_1";
    const resend = fakeResend({ data: { id: "c1" }, error: null });
    const m = await fresh();
    const r = await m.upsertAudienceContact({ email: " Victor@ARTO.mx ", firstName: "Victor", lastName: "Celaya" }, { resend });
    expect(r).toEqual({ ok: true, action: "created" });
    expect(resend.contacts.create).toHaveBeenCalledWith({
      audienceId: "aud_1",
      email: "victor@arto.mx",
      firstName: "Victor",
      lastName: "Celaya",
      unsubscribed: false,
    });
    expect(resend.contacts.update).not.toHaveBeenCalled();
  });

  it("si ya existe, actualiza en vez de fallar", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_1";
    const resend = fakeResend({ data: null, error: { name: "validation_error", message: "Contact already exists" } });
    const m = await fresh();
    const r = await m.upsertAudienceContact({ email: "a@b.co", firstName: "A" }, { resend });
    expect(r).toEqual({ ok: true, action: "updated" });
    expect(resend.contacts.update).toHaveBeenCalledWith({ audienceId: "aud_1", email: "a@b.co", firstName: "A", lastName: undefined });
  });

  it("un error distinto se devuelve sin lanzar", async () => {
    process.env.RESEND_AUDIENCE_ID = "aud_1";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const resend = fakeResend({ data: null, error: { name: "application_error", message: "boom" } });
    const m = await fresh();
    expect(await m.upsertAudienceContact({ email: "a@b.co" }, { resend })).toEqual({ ok: false, skipped: false, error: "boom" });
    err.mockRestore();
  });
});

describe("splitName", () => {
  it("separa nombre y apellidos", async () => {
    const { splitName } = await fresh();
    expect(splitName("Victor Hugo Celaya")).toEqual({ firstName: "Victor", lastName: "Hugo Celaya" });
    expect(splitName("Victor")).toEqual({ firstName: "Victor" });
    expect(splitName("  ")).toEqual({});
    expect(splitName(null)).toEqual({});
  });
});
