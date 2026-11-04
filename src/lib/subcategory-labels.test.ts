import { describe, expect, it } from "vitest";
import { SUBCATEGORY_LABEL_ES, subcategoryLabel } from "./subcategory-labels";

describe("subcategoryLabel", () => {
  it("traduce un slug conocido al espanol", () => {
    expect(subcategoryLabel("product_launch", "es")).toBe("Lanzamiento de producto");
  });

  it("en ingles humaniza y respeta siglas", () => {
    expect(subcategoryLabel("product_launch", "en")).toBe("Product Launch");
    expect(subcategoryLabel("seo_strategy", "en")).toBe("SEO Strategy");
  });

  it("un slug sin traduccion se humaniza en espanol, no en ingles con mayusculas de titulo", () => {
    expect(subcategoryLabel("nuevo_slug_raro", "es")).toBe("Nuevo slug raro");
  });

  it("ninguna etiqueta en espanol lleva em dash ni guion bajo", () => {
    for (const label of Object.values(SUBCATEGORY_LABEL_ES)) {
      expect(label).not.toMatch(/[—_]/);
    }
  });
});
