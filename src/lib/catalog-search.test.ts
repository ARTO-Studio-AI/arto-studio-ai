import { describe, expect, it } from "vitest";
import { buildIndex, normalize, queryTokens, searchCatalog, tokenMatch, type CatalogRow } from "./catalog-search";

const row = (r: Partial<CatalogRow> & Pick<CatalogRow, "id" | "title_es" | "title_en">): CatalogRow => ({
  category: "branding",
  subcategory: "identity",
  ai_model: "claude",
  difficulty: "beginner",
  tier: "free",
  tags: [],
  is_featured: false,
  ...r,
});

const ROWS: CatalogRow[] = [
  row({ id: "BR-0003", title_es: "Naming de marca para una startup", title_en: "Brand naming for a startup" }),
  row({ id: "BR-0010", title_es: "Manual de identidad visual", title_en: "Visual identity guidelines", tier: "pro" }),
  row({
    id: "CW-0001",
    title_es: "Correo de lanzamiento de un curso en línea",
    title_en: "Online course launch email",
    category: "copywriting",
    subcategory: "email",
    tags: ["newsletter"],
  }),
  row({
    id: "VD-0065",
    title_es: "Guion de video para lanzamiento",
    title_en: "Launch video script",
    category: "video",
    ai_model: "sora",
    difficulty: "expert",
  }),
];

const index = buildIndex(ROWS);
const ids = (q: string, f = {}, lang: "es" | "en" = "es") => searchCatalog(index, q, f, lang).map((r) => r.id);

describe("normalize y tokens", () => {
  it("quita acentos, mayusculas y signos", () => {
    expect(normalize("Línea  ÚNICA, ¿sí?")).toBe("linea unica si");
  });
  it("descarta palabras vacias salvo que no quede nada", () => {
    expect(queryTokens("correo para mi curso")).toEqual(["correo", "curso"]);
    expect(queryTokens("de la")).toEqual(["de", "la"]);
  });
  it("tolera errores de dedo segun el largo", () => {
    expect(tokenMatch("brnd", "brand")).toBeGreaterThan(0);
    expect(tokenMatch("lanzamineto", "lanzamiento")).toBeGreaterThan(0);
    expect(tokenMatch("xyz", "brand")).toBe(0);
  });
});

describe("searchCatalog", () => {
  it("encuentra sin acentos y en el otro idioma", () => {
    expect(ids("linea")).toEqual(["CW-0001"]);
    expect(ids("email")).toEqual(["CW-0001"]);
  });
  it("exige todas las palabras", () => {
    expect(ids("lanzamiento curso")).toEqual(["CW-0001"]);
    expect(ids("lanzamiento")).toEqual(expect.arrayContaining(["CW-0001", "VD-0065"]));
  });
  it("entiende el codigo con o sin guion", () => {
    expect(ids("BR-0003")[0]).toBe("BR-0003");
    expect(ids("br0003")[0]).toBe("BR-0003");
  });
  it("tolera un error de dedo", () => {
    expect(ids("brnd")).toContain("BR-0003");
  });
  it("respeta los filtros activos", () => {
    expect(ids("lanzamiento", { category: "video" })).toEqual(["VD-0065"]);
    expect(ids("identidad", { tier: "free" })).toEqual([]);
    expect(ids("guion", { aiGroup: "video" })).toEqual(["VD-0065"]);
  });
  it("busca en la categoria y las etiquetas", () => {
    expect(ids("newsletter")).toEqual(["CW-0001"]);
  });
  it("sin palabras utiles no devuelve nada", () => {
    expect(ids("   ")).toEqual([]);
  });
});
