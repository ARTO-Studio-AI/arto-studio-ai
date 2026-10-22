import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeConsent } from "./consent";

/* Pixel de Meta (D19): sin ID, sin publicidad aceptada o con DNT no se carga nada. Con
 * «Solo analitica» tampoco. En URLs con parametros que no son utm_* no sale nada hacia
 * Meta, y revokeMetaPixel() borra _fbp y _fbc. */

const ID = "1786082372609082";

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

async function setup(opts: { cookies?: string; id?: string | null; dnt?: string | null; href?: string }) {
  vi.resetModules();
  if (opts.id === null) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  else process.env.NEXT_PUBLIC_META_PIXEL_ID = opts.id ?? ID;
  const dom = fakeDom(opts.cookies ?? `asai_consent=${serializeConsent("all")}`);
  const win: Record<string, unknown> = {};
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("window", win);
  const url = new URL(opts.href ?? "https://creative.artostudio.ai/es/roast?utm_source=ig");
  vi.stubGlobal("location", { hostname: url.hostname, href: url.href, pathname: url.pathname });
  vi.stubGlobal("navigator", { doNotTrack: opts.dnt ?? null });
  const mod = await import("./meta-pixel");
  const calls = () => ((win.fbq as { queue?: unknown[][] } | undefined)?.queue ?? []).map((c) => c.slice(0, 2).join(" "));
  return { mod, dom, win, calls };
}

describe("meta-pixel (cliente)", () => {
  const original = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = original;
  });

  it("valida el ID: sin valor o con forma rara no hay pixel", async () => {
    for (const id of [null, "abc", "123"]) {
      const { mod, dom } = await setup({ id });
      expect(mod.initMetaPixel()).toBe(false);
      expect(dom.scripts).toHaveLength(0);
    }
  });

  it("no carga sin publicidad aceptada, con «Solo analitica» ni con DNT", async () => {
    for (const cookies of ["", `asai_consent=${serializeConsent("essential")}`, `asai_consent=${serializeConsent("analytics")}`, "asai_consent=all.v2-2026-10-20"]) {
      const { mod, dom, win } = await setup({ cookies });
      expect(mod.initMetaPixel()).toBe(false);
      expect(dom.scripts).toHaveLength(0);
      expect(win.fbq).toBeUndefined();
    }
    const { mod, dom } = await setup({ dnt: "1" });
    expect(mod.initMetaPixel()).toBe(false);
    expect(dom.scripts).toHaveLength(0);
  });

  it("con todo aceptado carga fbevents.js una vez, sin autoConfig, y manda un PageView", async () => {
    const { mod, dom, calls } = await setup({});
    expect(mod.initMetaPixel()).toBe(true);
    expect(mod.initMetaPixel()).toBe(true);
    expect(dom.scripts).toHaveLength(1);
    expect(dom.scripts[0].src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(calls()).toEqual(["set autoConfig", "consent grant", "init " + ID, "track PageView", "consent grant"]);
  });

  it("traduce solo los eventos de la lista", async () => {
    const { mod, calls } = await setup({});
    mod.initMetaPixel();
    mod.metaEvent("roast_completed", { industry: "cafe", overall: 7, source: "ai" });
    mod.metaEvent("roast_completed", { industry: "cafe", overall: 0, source: "error" });
    mod.metaEvent("roast_email_submitted", { industry: "cafe", overall: 7 });
    mod.metaEvent("prompt_opened", { prompt_id: "BR-0042" });
    expect(calls().slice(-2)).toEqual(["trackCustom RoastCompleted", "track Lead"]);
  });

  it("no manda nada en URLs con parametros que no son utm_*", async () => {
    expect((await setup({})).mod.metaSafeUrl("https://creative.artostudio.ai/es/roast?utm_source=x")).toBe(true);
    const { mod, calls } = await setup({ href: "https://creative.artostudio.ai/es/roast?b=Mi%20Marca&h=titular" });
    mod.initMetaPixel();
    mod.metaEvent("roast_email_submitted", { industry: "cafe", overall: 7 });
    expect(calls().filter((c) => c.startsWith("track"))).toEqual([]);
  });

  it("revokeMetaPixel corta el envio y borra _fbp y _fbc", async () => {
    const { mod, dom, calls } = await setup({
      cookies: `asai_consent=${serializeConsent("all")}; _fbp=fb.1.1; _fbc=fb.1.2; otra=1`,
    });
    mod.initMetaPixel();
    mod.revokeMetaPixel();
    expect(calls().at(-1)).toBe("consent revoke");
    expect(dom.jar.has("_fbp")).toBe(false);
    expect(dom.jar.has("_fbc")).toBe(false);
    expect(dom.jar.has("otra")).toBe(true);
  });
});
