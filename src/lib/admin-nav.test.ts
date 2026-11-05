import { describe, expect, it } from "vitest";
import {
  ADMIN_MOBILE_PRIMARY_IDS,
  ADMIN_NAV_GROUPS,
  ADMIN_QUICK_IDS,
  activeAdminNavId,
  adminMobileDrawerGroups,
  adminMobilePrimaryItems,
  allAdminNavItems,
} from "./admin-nav";

describe("ADMIN_NAV_GROUPS", () => {
  it("tiene los grupos en orden", () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.label)).toEqual(["Inicio", "Catálogo", "Usuarios", "Comunicación", "Medición"]);
  });

  it("ids y rutas unicos, todas bajo /admin", () => {
    const items = allAdminNavItems();
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    for (const i of items) expect(i.href === "/admin" || i.href.startsWith("/admin/")).toBe(true);
  });

  it("incluye Revisión en Catálogo aunque la pagina venga de otra rama", () => {
    const catalog = ADMIN_NAV_GROUPS.find((g) => g.id === "catalog")!;
    expect(catalog.items.map((i) => i.href)).toContain("/admin/revision");
  });

  it("el copy no lleva em dashes", () => {
    for (const g of ADMIN_NAV_GROUPS) {
      expect(g.label).not.toContain("\u2014");
      for (const i of g.items) expect(`${i.label}${i.short ?? ""}`).not.toContain("\u2014");
    }
  });

  it("los accesos rapidos existen", () => {
    const ids = allAdminNavItems().map((i) => i.id);
    for (const q of ADMIN_QUICK_IDS) expect(ids).toContain(q);
  });
});

describe("activeAdminNavId", () => {
  it("Resumen solo en /admin exacto", () => {
    expect(activeAdminNavId("/admin")).toBe("home");
    expect(activeAdminNavId("/admin/")).toBe("home");
    expect(activeAdminNavId("/admin/usuarios")).not.toBe("home");
  });

  it("gana el prefijo mas largo", () => {
    expect(activeAdminNavId("/admin/catalogo")).toBe("prompts");
    expect(activeAdminNavId("/admin/catalogo/abc-123")).toBe("prompts");
    expect(activeAdminNavId("/admin/catalogo/nuevo")).toBe("new_prompt");
    expect(activeAdminNavId("/admin/catalogo/importar")).toBe("import");
    expect(activeAdminNavId("/admin/catalogo/historial")).toBe("history");
  });

  it("marca cada pagina existente", () => {
    expect(activeAdminNavId("/admin/revision")).toBe("review");
    expect(activeAdminNavId("/admin/skills")).toBe("skills");
    expect(activeAdminNavId("/admin/usuarios?p=2")).toBe("users");
    expect(activeAdminNavId("/admin/pro")).toBe("pro");
    expect(activeAdminNavId("/admin/concesiones")).toBe("grants");
    expect(activeAdminNavId("/admin/lista")).toBe("waitlist");
    expect(activeAdminNavId("/admin/clients")).toBe("api_clients");
    expect(activeAdminNavId("/admin/emails")).toBe("emails");
    expect(activeAdminNavId("/admin/canales")).toBe("channels");
    expect(activeAdminNavId("/admin/busquedas")).toBe("searches");
    expect(activeAdminNavId("/admin/roasts")).toBe("roasts");
    expect(activeAdminNavId("/admin/traces/skills")).toBe("skill_traces");
  });

  it("no confunde prefijos parciales", () => {
    expect(activeAdminNavId("/admin/prorrateo")).toBeNull();
    expect(activeAdminNavId("/admin/listas")).toBeNull();
  });

  it("fuera del admin o sin ruta no marca nada", () => {
    expect(activeAdminNavId(null)).toBeNull();
    expect(activeAdminNavId("/es/prompts")).toBeNull();
    expect(activeAdminNavId("/administrador")).toBeNull();
  });
});

describe("celular", () => {
  it("cuatro destinos fijos abajo", () => {
    expect(adminMobilePrimaryItems().map((i) => i.id)).toEqual(ADMIN_MOBILE_PRIMARY_IDS);
    expect(ADMIN_MOBILE_PRIMARY_IDS).toHaveLength(4);
  });

  it("el cajon lleva todo lo demas, sin repetir y sin grupos vacios", () => {
    const drawer = adminMobileDrawerGroups();
    const ids = drawer.flatMap((g) => g.items.map((i) => i.id));
    for (const p of ADMIN_MOBILE_PRIMARY_IDS) expect(ids).not.toContain(p);
    expect(ids.length + ADMIN_MOBILE_PRIMARY_IDS.length).toBe(allAdminNavItems().length);
    expect(drawer.every((g) => g.items.length > 0)).toBe(true);
    expect(drawer.map((g) => g.id)).not.toContain("home");
  });
});
