import { describe, expect, it } from "vitest";
import { EDIT_BUNDLE_FREE_UNTIL, downloadAccess, isPromoActive, isProTier, priceLabel, type Viewer } from "./access";

/* Corte de la promocion del ARTO Edit Bundle #1 (Victor, 27 oct 2026): gratis con cuenta hasta el 2 nov de
 * 2026 inclusive en hora de Ciudad de Mexico; desde el 3 nov 00:00 CDMX (06:00 UTC), solo Pro. */

const BEFORE = new Date("2026-11-03T05:59:59.999Z"); // 2 nov 23:59:59.999 en CDMX
const CUTOFF = new Date("2026-11-03T06:00:00.000Z"); // 3 nov 00:00 en CDMX
const AFTER = new Date("2026-11-10T12:00:00Z");
const LAUNCH = new Date("2026-10-27T15:00:00Z");

const anon: Viewer = { signedIn: false };
const free: Viewer = { signedIn: true, userId: "u-free", tier: "free" };
const pro: Viewer = { signedIn: true, userId: "u-pro", tier: "pro" };
const enterprise: Viewer = { signedIn: true, userId: "u-ent", tier: "enterprise" };
const weird: Viewer = { signedIn: true, userId: "u-x", tier: "Pro " };

describe("EDIT_BUNDLE_FREE_UNTIL", () => {
  it("es el 3 nov de 2026 a las 00:00 de Ciudad de Mexico (06:00 UTC)", () => {
    expect(EDIT_BUNDLE_FREE_UNTIL).toBe("2026-11-03T06:00:00Z");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(EDIT_BUNDLE_FREE_UNTIL));
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    expect(`${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`).toBe("2026-11-03 00:00");
  });
});

describe("isPromoActive", () => {
  it("activa el dia del lanzamiento y hasta el ultimo milisegundo del 2 nov en CDMX", () => {
    expect(isPromoActive(LAUNCH)).toBe(true);
    expect(isPromoActive(BEFORE)).toBe(true);
  });
  it("apagada justo en el corte y despues", () => {
    expect(isPromoActive(CUTOFF)).toBe(false);
    expect(isPromoActive(AFTER)).toBe(false);
  });
  it("una fecha invalida cuenta como fuera de promocion (falla cerrado)", () => {
    expect(isPromoActive(new Date("no es fecha"))).toBe(false);
  });
});

describe("downloadAccess antes del corte", () => {
  it("sin sesion manda a crear cuenta o entrar", () => {
    expect(downloadAccess(anon, BEFORE)).toBe("signin");
  });
  it("cuenta gratis descarga", () => {
    expect(downloadAccess(free, LAUNCH)).toBe("download");
    expect(downloadAccess(free, BEFORE)).toBe("download");
  });
  it("Pro y Enterprise descargan", () => {
    expect(downloadAccess(pro, BEFORE)).toBe("download");
    expect(downloadAccess(enterprise, BEFORE)).toBe("download");
  });
});

describe("downloadAccess desde el corte", () => {
  it("sin sesion sigue mandando a crear cuenta o entrar", () => {
    expect(downloadAccess(anon, CUTOFF)).toBe("signin");
  });
  it("cuenta gratis va a Pro", () => {
    expect(downloadAccess(free, CUTOFF)).toBe("upgrade");
    expect(downloadAccess(free, AFTER)).toBe("upgrade");
  });
  it("Pro y Enterprise descargan siempre", () => {
    expect(downloadAccess(pro, CUTOFF)).toBe("download");
    expect(downloadAccess(pro, AFTER)).toBe("download");
    expect(downloadAccess(enterprise, AFTER)).toBe("download");
  });
  it("un tier desconocido o mal escrito no cuenta como Pro", () => {
    expect(downloadAccess(weird, AFTER)).toBe("upgrade");
    expect(isProTier(null)).toBe(false);
    expect(isProTier("free")).toBe(false);
  });
});

describe("priceLabel", () => {
  it("dice Gratis hasta el 2 nov antes del corte y Pro despues", () => {
    expect(priceLabel(BEFORE)).toBe("free");
    expect(priceLabel(CUTOFF)).toBe("pro");
  });
});
