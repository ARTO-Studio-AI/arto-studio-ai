import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/* Wrapper de PostHog: sin key es no-op con un solo aviso; con DNT no inicializa.
 * posthog-js se mockea para comprobar que ni siquiera se carga en esos casos. */

const { initMock, captureMock } = vi.hoisted(() => ({ initMock: vi.fn(), captureMock: vi.fn() }));
vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
    capture: captureMock,
    identify: vi.fn(),
    reset: vi.fn(),
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
    vi.stubGlobal("navigator", { doNotTrack: null });
    try {
      const a = await freshModule();
      const ph = await a.initAnalytics();
      expect(ph).not.toBeNull();
      expect(initMock).toHaveBeenCalledTimes(1);
      const [key, config] = initMock.mock.calls[0];
      expect(key).toBe("phc_prueba");
      expect(config.person_profiles).toBe("identified_only");
      expect(config.api_host).toBe("https://us.i.posthog.com");
      a.track("pricing_viewed", { locale: "es", signed_in: true });
      expect(captureMock).toHaveBeenCalledWith("pricing_viewed", { locale: "es", signed_in: true });
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
