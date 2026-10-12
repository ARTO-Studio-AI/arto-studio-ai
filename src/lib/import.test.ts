import { describe, expect, it } from "vitest";
import { csvValue, IMPORT_MAX_ROWS, readImport } from "./catalog";
import { parseCsv } from "./csv";

const HEAD = "id,title_es,title_en,prompt_es,prompt_en,category,subcategory,ai_model,difficulty,tier,tags,use_case,expected_output,is_published";

describe("csvValue", () => {
  it("normaliza y valida cada columna", () => {
    expect(csvValue("subcategory", "Brand Strategy")).toEqual({ ok: true, value: "brand_strategy" });
    expect(csvValue("tags", "Marca| naming |marca")).toEqual({ ok: true, value: ["marca", "naming"] });
    expect(csvValue("is_published", "Sí")).toEqual({ ok: true, value: true });
    expect(csvValue("tier", "enterprise").ok).toBe(false);
    expect(csvValue("category", "hacking").ok).toBe(false);
  });
});

describe("readImport", () => {
  it("una fila con id es edicion y solo lleva las celdas con valor", () => {
    const { rows } = readImport(parseCsv(`${HEAD}\nbr-0012,,,,,,,,,pro,,,,no`));
    expect(rows[0]).toMatchObject({ id: "BR-0012", values: { tier: "pro", is_published: false }, errors: [] });
    expect(Object.keys(rows[0].values)).toEqual(["tier", "is_published"]);
  });
  it("una fila sin id es alta, siempre no disponible, y pide lo obligatorio", () => {
    const ok = readImport(parseCsv(`${HEAD}\n,Título,Title,Prompt ES,Prompt EN,branding,naming,claude,beginner,free,a|b,,,sí`));
    expect(ok.rows[0].errors).toEqual([]);
    expect(ok.rows[0].values.is_published).toBe(false);
    const bad = readImport(parseCsv(`${HEAD}\n,Título,,,,branding,,,,,,,,`));
    expect(bad.rows[0].errors[0]).toMatch(/para un alta faltan: title_en, prompt_es, prompt_en, subcategory, ai_model, difficulty, tier/);
  });
  it("reporta columnas desconocidas y la de solo lectura", () => {
    const { warnings } = readImport(parseCsv("id,tier,color,is_featured\nBR-0001,pro,rojo,sí"));
    expect(warnings).toEqual(["Columnas ignoradas: color.", "La columna is_featured solo se exporta; para destacar usa el Catálogo."]);
  });
  it("rechaza un id con formato raro", () => {
    expect(readImport(parseCsv("id,tier\nBR-12;drop,pro")).rows[0].errors[0]).toMatch(/id/);
  });
  it("pone tope de filas", () => {
    const many = [HEAD, ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => "BR-0001,,,,,,,,,pro,,,,")].join("\n");
    expect(() => readImport(parseCsv(many))).toThrow(/máximo/);
  });
});
