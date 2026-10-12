import { describe, expect, it } from "vitest";
import { cleanEmail } from "./grants";

describe("cleanEmail", () => {
  it("normaliza y acepta correos normales", () => {
    expect(cleanEmail("  Ana.Lopez+asai@ArtoGroup.com ")).toBe("ana.lopez+asai@artogroup.com");
  });
  it("rechaza lo que no es un correo o trae caracteres de filtro", () => {
    for (const bad of ["", "ana", "ana@", "a@b", "a,b@c.com", "a@b.com)", 'a"b@c.com', null, 42]) expect(cleanEmail(bad)).toBeNull();
  });
});
