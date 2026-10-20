import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeConsent } from "./consent";

/* Google Analytics 4: sin ID, sin consentimiento o con DNT no se carga el script ni se
 * escribe nada. Con todo en orden carga gtag.js una sola vez, con lo de anuncios en
 * "denied", y revokeGA() borra _ga y _ga_<id>. */

const ID = "G-TEST1234";

function fakeDom(cookies: string) {
  const jar = new Map<string, string>();
  for (const part of cookies.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) jar.set(k, v.join("="));
  }
  const scripts: Array<{ id: string; src: string; async: boolean }> = [];
  const document = {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(";");
      const [k, ...v] = pair.trim().split("=");
      if (attrs.some((a) => a.trim() === "max-age=0")) jar.delete(k);
      else jar.set(k, v.join("="));
    },
    getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
    createElement: () => ({ id: "", src: "", async: false }),
    head: { appendChild: (s: { id: string; src: string; async: boolean }) => scripts.push(s) },
  };
  return { document, scripts, jar };
}

async function setup(opts: { cookies?: string; id?: string | null; dnt?: string | null }) {
  vi.resetModules();
  if (opts.id === null) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = opts.id ?? ID;
  const dom = fakeDom(opts.cookies ?? `asai_consent=${serializeConsent("all")}`);
  const win: Record<string, unknown> = {};
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("window", win);
  vi.stubGlobal("location", { hostname: "creative.artostudio.ai" });
  vi.stubGlobal("navigator", { doNotTrack: opts.dnt ?? null });
  const mod = await import("./ga");
  return { mod, dom, win };
}

describe("ga (cliente)", () => {
  const original = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = original;
  });

  it("valida el ID: sin valor o con forma rara no hay GA", async () => {
    const { mod } = await setup({ id: null });
    expect(mod.gaMeasurementId()).toBeNull();
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "UA-123-1";
    expect(mod.gaMeasurementId()).toBeNull();
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = " g-abc12345 ";
    expect(mod.gaMeasurementId()).toBe("G-ABC12345");
  });

  it("sin ID no carga nada", async () => {
    const { mod, dom } = await setup({ id: null });
    expect(mod.initGA()).toBe(false);
    expect(dom.scripts).toHaveLength(0);
  });

  it("sin consentimiento de analitica no carga nada", async () => {
    for (const cookies of ["", `asai_consent=${serializeConsent("essential")}`, "asai_consent=all.v0-viejo"]) {
      const { mod, dom, win } = await setup({ cookies });
      expect(mod.initGA()).toBe(false);
      expect(dom.scripts).toHaveLength(0);
      expect(win.dataLayer).toBeUndefined();
    }
  });

  it("con doNotTrack no carga nada", async () => {
    const { mod, dom } = await setup({ dnt: "1" });
    expect(mod.initGA()).toBe(false);
    expect(dom.scripts).toHaveLength(0);
  });

  it("con consentimiento carga gtag.js una vez, con anuncios apagados", async () => {
    const { mod, dom, win } = await setup({});
    expect(mod.initGA()).toBe(true);
    expect(mod.initGA()).toBe(true);
    expect(dom.scripts).toHaveLength(1);
    expect(dom.scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
    const calls = (win.dataLayer as IArguments[]).map((a) => Array.from(a));
    const consent = calls.find((c) => c[0] === "consent" && c[1] === "default");
    expect(consent?.[2]).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    const config = calls.find((c) => c[0] === "config");
    expect(config?.[1]).toBe(ID);
    expect(config?.[2]).toMatchObject({ allow_google_signals: false, allow_ad_personalization_signals: false });
  });

  it("gaEvent solo manda con GA cargado", async () => {
    const { mod, win } = await setup({});
    mod.gaEvent("roast_completed", { overall: 7 });
    expect(win.dataLayer).toBeUndefined();
    mod.initGA();
    mod.gaEvent("roast_completed", { overall: 7 });
    const last = Array.from((win.dataLayer as IArguments[]).at(-1)!);
    expect(last).toEqual(["event", "roast_completed", { overall: 7 }]);
  });

  it("revokeGA apaga la medicion y borra _ga y _ga_<id>", async () => {
    const { mod, dom, win } = await setup({
      cookies: `asai_consent=${serializeConsent("all")}; _ga=GA1.1.1; _ga_TEST1234=GS1.1; otra=1`,
    });
    mod.initGA();
    mod.revokeGA();
    expect(win[`ga-disable-${ID}`]).toBe(true);
    expect([...dom.jar.keys()].sort()).toEqual(["asai_consent", "otra"]);
    const last = Array.from((win.dataLayer as IArguments[]).at(-1)!);
    expect(last).toEqual(["consent", "update", { analytics_storage: "denied" }]);
  });
});
