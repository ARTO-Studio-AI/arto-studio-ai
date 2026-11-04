import { describe, expect, it } from "vitest";
import {
  APP_NAV_GROUPS,
  activeNavId,
  activeVertical,
  allNavItems,
  localeHref,
  mobileDrawerGroups,
  mobilePrimaryItems,
  shouldShowAppNav,
  stripLocale,
} from "./app-nav";

describe("shouldShowAppNav", () => {
  it("no aparece sin sesion", () => {
    expect(shouldShowAppNav("/es/prompts", "es", false)).toBe(false);
    expect(shouldShowAppNav("/en/favorites", "en", false)).toBe(false);
  });

  it("no aparece en la home publica aunque haya sesion", () => {
    expect(shouldShowAppNav("/es", "es", true)).toBe(false);
    expect(shouldShowAppNav("/es/", "es", true)).toBe(false);
    expect(shouldShowAppNav("/en", "en", true)).toBe(false);
  });

  it("aparece con sesion en las demas rutas", () => {
    expect(shouldShowAppNav("/es/prompts", "es", true)).toBe(true);
    expect(shouldShowAppNav("/en/account", "en", true)).toBe(true);
    expect(shouldShowAppNav("/es/learn/branding", "es", true)).toBe(true);
  });

  it("sin ruta no aparece", () => {
    expect(shouldShowAppNav(null, "es", true)).toBe(false);
  });
});

describe("stripLocale", () => {
  it("quita el locale y la barra final", () => {
    expect(stripLocale("/es/prompts/", "es")).toBe("/prompts");
    expect(stripLocale("/es", "es")).toBe("/");
    expect(stripLocale("/en/skills/x?y=1", "en")).toBe("/skills/x");
  });

  it("no confunde un prefijo parecido con el locale", () => {
    expect(stripLocale("/especial", "es")).toBe("/especial");
  });
});

describe("activeNavId", () => {
  it("marca el destino por prefijo de ruta", () => {
    expect(activeNavId("/es/prompts", "es")).toBe("prompts");
    expect(activeNavId("/es/prompts/BR-001", "es")).toBe("prompts");
    expect(activeNavId("/en/favorites", "en")).toBe("favorites");
    expect(activeNavId("/es/collections/abc", "es")).toBe("collections");
    expect(activeNavId("/es/roast", "es")).toBe("roast");
    expect(activeNavId("/es/tools", "es")).toBe("ai_tools");
    expect(activeNavId("/es/skills/edit-1", "es")).toBe("skills");
    expect(activeNavId("/es/mods", "es")).toBe("mods");
    expect(activeNavId("/es/account", "es")).toBe("account");
  });

  it("en /learn marca Tutoriales, no el atajo Lo nuevo", () => {
    expect(activeNavId("/es/learn", "es")).toBe("tutorials");
    expect(activeNavId("/es/learn/branding", "es")).toBe("tutorials");
  });

  it("no marca nada en rutas fuera del menu", () => {
    expect(activeNavId("/es/pricing", "es")).toBeNull();
    expect(activeNavId("/es", "es")).toBeNull();
    expect(activeNavId("/es/promptsx", "es")).toBeNull();
  });
});

describe("activeVertical", () => {
  it("lee la vertical solo en /prompts", () => {
    expect(activeVertical("/es/prompts", "es", "branding")).toBe("branding");
    expect(activeVertical("/es/prompts/BR-001", "es", "branding")).toBeNull();
    expect(activeVertical("/es/favorites", "es", "branding")).toBeNull();
  });

  it("ignora categorias que no existen", () => {
    expect(activeVertical("/es/prompts", "es", "nope")).toBeNull();
    expect(activeVertical("/es/prompts", "es", null)).toBeNull();
  });
});

describe("estructura del menu", () => {
  it("tiene los tres grupos del criterio de cierre, en orden", () => {
    expect(APP_NAV_GROUPS.map((g) => g.id)).toEqual(["home", "tools", "library"]);
    const ids = (g: string) => APP_NAV_GROUPS.find((x) => x.id === g)!.items.map((i) => i.id);
    expect(ids("home")).toEqual(expect.arrayContaining(["new", "favorites"]));
    expect(ids("tools")).toEqual(expect.arrayContaining(["smart_search", "roast"]));
    expect(ids("library")).toEqual(["prompts", "tutorials", "skills", "mods"]);
  });

  it("en celular hay cuatro destinos fijos y el resto va al cajon sin repetirse", () => {
    const primary = mobilePrimaryItems().map((i) => i.id);
    expect(primary).toHaveLength(4);
    const drawer = mobileDrawerGroups().flatMap((g) => g.items.map((i) => i.id));
    for (const id of primary) expect(drawer).not.toContain(id);
    const everything = allNavItems().map((i) => i.id);
    for (const id of everything) expect([...primary, ...drawer]).toContain(id);
  });

  it("antepone el locale a los enlaces", () => {
    expect(localeHref("es", "/prompts#catalog-q")).toBe("/es/prompts#catalog-q");
    expect(localeHref("en", "favorites")).toBe("/en/favorites");
  });
});
