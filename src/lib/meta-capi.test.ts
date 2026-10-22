import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newMetaEventId } from "@/lib/meta-pixel";
import {
  buildMetaServerPayload,
  cleanEventId,
  eventSourceUrl,
  hashEmail,
  metaIndustry,
  queueMetaServerEvent,
  sendMetaServerEvent,
  serverAdsAllowed,
  type MetaRequestLike,
} from "@/lib/meta-capi";

/* API de conversiones de Meta (D19 fase 2, 22 oct 2026). */

const CONSENT_ALL = "all.v3-2026-10-22";
const PIXEL = "1786082372609082";
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

function fakeRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): MetaRequestLike {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => h[name.toLowerCase()] ?? null },
    cookies: { get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined) },
  };
}

describe("hashEmail y cleanEventId", () => {
  it("normaliza el correo antes de SHA-256 y rechaza lo que no es correo", () => {
    expect(hashEmail("  Ana@Empresa.COM ")).toBe(sha("ana@empresa.com"));
    expect(hashEmail("no-es-correo")).toBeNull();
    expect(hashEmail(null)).toBeNull();
  });

  it("solo acepta event_id de 8 a 64 caracteres seguros", () => {
    expect(cleanEventId("3f2b8c1e-aaaa-bbbb-cccc-123456789012")).toBe("3f2b8c1e-aaaa-bbbb-cccc-123456789012");
    expect(cleanEventId("corto")).toBeNull();
    expect(cleanEventId("con espacios y <html>")).toBeNull();
    expect(cleanEventId(42)).toBeNull();
  });

  it("acepta los ids que generan el navegador y el alta", () => {
    const id = newMetaEventId();
    expect(cleanEventId(id)).toBe(id);
    const signup = "signup-3f2b8c1e-aaaa-bbbb-cccc-123456789012";
    expect(cleanEventId(signup)).toBe(signup);
  });

  it("la industria solo sale si es de la lista del roast", () => {
    expect(metaIndustry("Agency")).toBe("Agency");
    expect(metaIndustry("Panaderia de Ana en Calle 5")).toBeUndefined();
    expect(metaIndustry(undefined)).toBeUndefined();
  });
});

describe("eventSourceUrl", () => {
  it("usa la pagina de origen si es del sitio y solo trae utm_*", () => {
    expect(eventSourceUrl(fakeRequest({ referer: "https://creative.artostudio.ai/es/roast?utm_source=ig" }).headers)).toBe(
      "https://creative.artostudio.ai/es/roast?utm_source=ig",
    );
  });

  it("cae a la raiz con la vista compartida, otro dominio o sin referer", () => {
    const root = "https://creative.artostudio.ai/";
    expect(eventSourceUrl(fakeRequest({ referer: "https://creative.artostudio.ai/es/roast?brand=Acme" }).headers)).toBe(root);
    expect(eventSourceUrl(fakeRequest({ referer: "https://accounts.google.com/x" }).headers)).toBe(root);
    expect(eventSourceUrl(fakeRequest().headers)).toBe(root);
  });
});

describe("serverAdsAllowed", () => {
  it("solo con asai_consent = all en la version vigente y sin DNT ni GPC", () => {
    expect(serverAdsAllowed(fakeRequest({}, { asai_consent: CONSENT_ALL }))).toBe(true);
    expect(serverAdsAllowed(fakeRequest({}, { asai_consent: "analytics.v3-2026-10-22" }))).toBe(false);
    expect(serverAdsAllowed(fakeRequest({}, { asai_consent: "all.v2-2026-10-20" }))).toBe(false);
    expect(serverAdsAllowed(fakeRequest())).toBe(false);
    expect(serverAdsAllowed(fakeRequest({ dnt: "1" }, { asai_consent: CONSENT_ALL }))).toBe(false);
    expect(serverAdsAllowed(fakeRequest({ "sec-gpc": "1" }, { asai_consent: CONSENT_ALL }))).toBe(false);
  });
});

describe("buildMetaServerPayload", () => {
  it("manda correo e id con SHA-256, IP, navegador, _fbp, _fbc y el event_id del navegador", () => {
    const request = fakeRequest(
      { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Prueba/1.0" },
      { asai_consent: CONSENT_ALL, _fbp: "fb.1.1.2", _fbc: "fb.1.1.abc" },
    );
    const payload = buildMetaServerPayload(
      {
        name: "Lead",
        request,
        eventId: "3f2b8c1e-aaaa-bbbb-cccc-123456789012",
        email: "Ana@Empresa.com",
        externalId: "user-1",
        customData: { content_name: "roast_report", content_category: "Agency", vacio: undefined },
      },
      1_700_000_000_000,
    );
    expect(payload).toEqual({
      event_name: "Lead",
      event_time: 1_700_000_000,
      event_id: "3f2b8c1e-aaaa-bbbb-cccc-123456789012",
      action_source: "website",
      event_source_url: "https://creative.artostudio.ai/",
      user_data: {
        em: [sha("ana@empresa.com")],
        external_id: [sha("user-1")],
        client_ip_address: "203.0.113.7",
        client_user_agent: "Prueba/1.0",
        fbp: "fb.1.1.2",
        fbc: "fb.1.1.abc",
      },
      custom_data: { content_name: "roast_report", content_category: "Agency" },
    });
    expect(JSON.stringify(payload)).not.toContain("ana@empresa.com");
  });

  it("genera un event_id si el del navegador no es valido", () => {
    const payload = buildMetaServerPayload({ name: "RoastCompleted", request: fakeRequest(), eventId: "x" });
    expect(cleanEventId(payload.event_id)).toBe(payload.event_id);
    expect(payload).not.toHaveProperty("custom_data");
  });
});

describe("sendMetaServerEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "token-de-prueba");
    vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const allowed = () => fakeRequest({}, { asai_consent: CONSENT_ALL });

  it("no manda nada sin token, sin pixel o sin publicidad aceptada", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    expect(await sendMetaServerEvent({ name: "Lead", request: allowed() })).toBe(false);
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "token-de-prueba");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    expect(await sendMetaServerEvent({ name: "Lead", request: allowed() })).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    expect(await sendMetaServerEvent({ name: "Lead", request: fakeRequest() })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda al conjunto de datos del pixel con el token y, si hay, el codigo de prueba", async () => {
    vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "TEST123");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));
    expect(await sendMetaServerEvent({ name: "CompleteRegistration", request: allowed(), email: "a@b.co" })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/v26.0/${PIXEL}/events`);
    const form = init.body as URLSearchParams;
    expect(form.get("access_token")).toBe("token-de-prueba");
    expect(form.get("test_event_code")).toBe("TEST123");
    expect(JSON.parse(form.get("data")!)[0].event_name).toBe("CompleteRegistration");
  });

  it("queueMetaServerEvent fuera de una peticion no lanza y manda igual", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(() => queueMetaServerEvent({ name: "Lead", request: allowed(), eventId: "abcdefgh-1234" })).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("nunca lanza: error de Meta o de red devuelve false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 }));
    expect(await sendMetaServerEvent({ name: "Lead", request: allowed() })).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("red caida"));
    expect(await sendMetaServerEvent({ name: "Lead", request: allowed() })).toBe(false);
  });
});
