import { describe, expect, it } from "vitest";
import { applyFilter, describePatch, embedSource, nextId, nextValues, parseFilter, parsePatch, parsePromptInput, safeSearch } from "./catalog";

describe("parseFilter", () => {
  it("ignora valores fuera de lista", () => {
    expect(parseFilter({ category: "hacking", tier: "enterprise", published: "tal vez", pending: "x" })).toEqual({});
  });
  it("acepta un filtro completo", () => {
    expect(parseFilter({ q: " marca ", category: "branding", tier: "pro", published: "no", ai_model: "claude_opus", difficulty: "expert", featured: "si", pending: "sin_embedding" })).toEqual({
      q: "marca", category: "branding", tier: "pro", published: "no", ai_model: "claude_opus", difficulty: "expert", featured: "si", pending: "sin_embedding",
    });
  });
  it("rechaza un modelo con caracteres raros", () => {
    expect(parseFilter({ ai_model: "claude),is_published.eq.true" }).ai_model).toBeUndefined();
  });
});

describe("safeSearch", () => {
  it("quita lo que el or() de PostgREST interpreta", () => {
    expect(safeSearch('marca%,(x)"*_\\')).toBe("marcax");
  });
});

describe("applyFilter", () => {
  it("encadena las condiciones esperadas", () => {
    const calls: string[] = [];
    const q = {
      eq(c: string, v: unknown) { calls.push(`eq ${c} ${v}`); return q; },
      is(c: string, v: null) { calls.push(`is ${c} ${v}`); return q; },
      or(e: string) { calls.push(`or ${e.split(",").length}`); return q; },
    };
    applyFilter(q, { q: "marca", category: "branding", published: "no", pending: "sin_embedding" });
    expect(calls).toEqual(["or 7", "eq category branding", "eq is_published false", "is embedding null"]);
  });
});

describe("parsePatch", () => {
  it("solo deja pasar campos permitidos", () => {
    expect(parsePatch({ tier: "pro", is_admin: true, prompt_en: "x" })).toEqual({ tier: "pro" });
    expect(parsePatch({ tier: "enterprise" })).toBeNull();
    expect(parsePatch(null)).toBeNull();
  });
  it("limpia etiquetas", () => {
    expect(parsePatch({ add_tags: [" Marca ", "marca", "<script>", ""] })).toEqual({ add_tags: ["marca"] });
  });
  it("describe el cambio en espanol", () => {
    expect(describePatch({ is_published: false, tier: "pro" })).toBe("despublicar · pasar a Pro");
  });
});

describe("nextValues", () => {
  const now = "2026-10-12T00:00:00.000Z";
  it("agrega y quita etiquetas sin duplicar", () => {
    expect(nextValues({ tags: ["a", "b"] }, { add_tags: ["b", "c"], remove_tags: ["a"] }, now)).toEqual({ tags: ["b", "c"] });
  });
  it("conserva la fecha de destacado si ya lo estaba", () => {
    expect(nextValues({ is_featured: true, featured_at: "2026-01-01" }, { is_featured: true }, now)).toEqual({ is_featured: true, featured_at: "2026-01-01" });
    expect(nextValues({ is_featured: false }, { is_featured: true }, now)).toEqual({ is_featured: true, featured_at: now });
    expect(nextValues({ is_featured: true }, { is_featured: false }, now)).toEqual({ is_featured: false, featured_at: null });
  });
});

describe("embedSource", () => {
  it("sigue la receta original de embed-prompts.ts", () => {
    expect(
      embedSource({ title_en: "Find tension", title_es: "Encontrar tension", category: "branding", subcategory: "brand_strategy", use_case: "Kickoff", tags: ["a", "b"] }),
    ).toBe("Find tension\nEncontrar tension\nCategory: branding / brand strategy.\nUse case: Kickoff\nTags: a, b");
  });
});

describe("nextId", () => {
  it("sigue la numeracion de la vertical", () => {
    expect(nextId("branding", "BR-0251")).toBe("BR-0252");
    expect(nextId("photography", null)).toBe("FT-0001");
  });
});

describe("parsePromptInput", () => {
  const ok = {
    title_en: "T", title_es: "T", prompt_en: "P", prompt_es: "P", category: "branding", subcategory: "Brand Strategy",
    ai_model: "claude", difficulty: "beginner", tier: "free", tags: ["x"], use_case: "", expected_output: "", is_published: true,
  };
  it("normaliza y acepta", () => {
    const r = parsePromptInput(ok);
    expect(r.ok && r.value.subcategory).toBe("brand_strategy");
    expect(r.ok && r.value.use_case).toBeNull();
  });
  it("rechaza lo invalido con un mensaje claro", () => {
    expect(parsePromptInput({ ...ok, title_es: "" })).toEqual({ ok: false, error: "Falta «title_es»." });
    expect(parsePromptInput({ ...ok, tier: "enterprise" }).ok).toBe(false);
  });
});
