import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/* Wrapper de PostHog: sin key es no-op con un solo aviso; con DNT no inicializa.
 * posthog-js se mockea para comprobar que ni siquiera se carga en esos casos.
 * Desde H-48 (9 oct 2026) tampoco inicializa sin la cookie asai_consent = all. */

const CONSENT_ALL = "asai_consent=all.v1-2026-10-09";

/* document minimo: un cookie jar de strings, suficiente para consent.ts y revokeAnalytics. */
function fakeDocument(initial: string) {
  const jar = new Map<string, string>();
  for (const part of initial.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) jar.set(k, v.join("="));
  }
  return {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(";");
      const [k, ...v] = pair.trim().split("=");
      if (attrs.some((a) => a.trim() === "max-age=0")) jar.delete(k);
      else jar.set(k, v.join("="));
    },
  };
}

const { initMock, captureMock, optOutMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  captureMock: vi.fn(),
  optOutMock: vi.fn(),
}));
vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
    capture: captureMock,
    identify: vi.fn(),
    reset: vi.fn(),
    opt_out_capturing: optOutMock,
    get_distinct_id: () => "anon",
  },
}));

async function freshModule() {
  vi.resetModules();
  return await import("./analytics");
}

describe("analytics (cliente)", () => {
  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    initMock.mockClear();
    captureMock.mockClear();
    optOutMock.mockClear();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  afterEach(() => {
    warn.mockRestore();
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    if (originalHost === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
  });

  it("sin key: no inicializa, no truena y avisa una sola vez", async () => {
    const a = await freshModule();
    expect(a.analyticsKey()).toBeNull();
    expect(await a.initAnalytics()).toBeNull();
    expect(() => a.track("pricing_viewed", { locale: "en", signed_in: false })).not.toThrow();
    a.track("favorite_added", { prompt_id: "BR-0001" });
    a.identifyUser("user-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(initMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("NEXT_PUBLIC_POSTHOG_KEY");
  });

  it("key vacia cuenta como ausente (Vercel manda '' en las sensibles)", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "   ";
    const a = await freshModule();
    expect(a.analyticsKey()).toBeNull();
    expect(await a.initAnalytics()).toBeNull();
  });

  it("host por defecto es US Cloud y se limpia la barra final", async () => {
    const a = await freshModule();
    expect(a.analyticsHost()).toBe("https://us.i.posthog.com");
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com/";
    expect(a.analyticsHost()).toBe("https://eu.i.posthog.com");
  });

  it("con doNotTrack activo no inicializa aunque haya key", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    try {
      const a = await freshModule();
      expect(a.doNotTrack()).toBe(true);
      expect(await a.initAnalytics()).toBeNull();
      expect(initMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("doNotTrack");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fuera del navegador (sin window) no inicializa ni avisa aunque haya key", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
    const a = await freshModule();
    expect(a.doNotTrack()).toBe(false);
    expect(await a.initAnalytics()).toBeNull();
    expect(initMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("con key y navegador inicializa con identified_only y manda el evento", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", fakeDocument(CONSENT_ALL));
    vi.stubGlobal("navigator", { doNotTrack: null });
    try {
      const a = await freshModule();
      const ph = await a.initAnalytics();
      expect(ph).not.toBeNull();
      expect(initMock).toHaveBeenCalledTimes(1);
      const [key, config] = initMock.mock.calls[0];
      expect(key).toBe("phc_prueba");
      expect(config.person_profiles).toBe("identified_only");
      // H-47: sin grabacion de sesiones ni autocapture hasta decision de Victor (D9, H-48).
      expect(config.disable_session_recording).toBe(true);
      expect(config.autocapture).toBe(false);
      // Lighthouse Fase 6: surveys.js no se descarga.
      expect(config.disable_surveys).toBe(true);
      expect(config.api_host).toBe("https://us.i.posthog.com");
      a.track("pricing_viewed", { locale: "es", signed_in: true });
      expect(captureMock).toHaveBeenCalledWith("pricing_viewed", { locale: "es", signed_in: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sin consentimiento no inicializa; al aceptar despues si", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
    const doc = fakeDocument("NEXT_LOCALE=es");
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", doc);
    vi.stubGlobal("navigator", { doNotTrack: null });
    try {
      const a = await freshModule();
      expect(await a.initAnalytics()).toBeNull();
      a.track("pricing_viewed", { locale: "es", signed_in: false });
      await new Promise((r) => setTimeout(r, 0));
      expect(initMock).not.toHaveBeenCalled();
      expect(captureMock).not.toHaveBeenCalled();
      // "Solo esenciales" o una version vieja del aviso no cuentan como si.
      doc.cookie = "asai_consent=essential.v1-2026-10-09; path=/";
      expect(await a.initAnalytics()).toBeNull();
      doc.cookie = "asai_consent=all.v0-viejo; path=/";
      expect(await a.initAnalytics()).toBeNull();
      expect(initMock).not.toHaveBeenCalled();
      doc.cookie = `${CONSENT_ALL}; path=/`;
      expect(await a.initAnalytics()).not.toBeNull();
      expect(initMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("revokeAnalytics apaga la captura y borra cookies y claves ph_*", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
    const doc = fakeDocument(`${CONSENT_ALL}; ph_phc_prueba_posthog=x; NEXT_LOCALE=es`);
    const store = new Map<string, string>([["ph_phc_prueba_posthog", "x"], ["otra", "y"]]);
    const localStorageStub = {
      removeItem: (k: string) => store.delete(k),
    };
    for (const k of store.keys()) Object.defineProperty(localStorageStub, k, { value: store.get(k), enumerable: true, configurable: true });
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", doc);
    vi.stubGlobal("localStorage", localStorageStub);
    vi.stubGlobal("navigator", { doNotTrack: null });
    try {
      const a = await freshModule();
      expect(await a.initAnalytics()).not.toBeNull();
      a.revokeAnalytics();
      expect(optOutMock).toHaveBeenCalledTimes(1);
      expect(doc.cookie).not.toContain("ph_phc_prueba_posthog");
      expect(doc.cookie).toContain("NEXT_LOCALE=es");
      expect(store.has("ph_phc_prueba_posthog")).toBe(false);
      expect(store.has("otra")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("analytics (servidor)", () => {
  it("sin key es no-op, devuelve false y avisa una sola vez", async () => {
    const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      vi.resetModules();
      const s = await import("./analytics-server");
      expect(await s.captureServer("user-1", "login_completed", { provider: "google" })).toBe(false);
      expect(await s.captureServer("user-1", "login_completed", { provider: "email" })).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      if (originalKey !== undefined) process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });
});
