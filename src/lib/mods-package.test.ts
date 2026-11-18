import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ALL_MODS } from "./mods";

/* El zip de cada mod con paquete esta en private/mods y es el auditado (18 nov 2026, D37). */
describe("paquetes de mods", () => {
  it("cada paquete declarado existe con su peso y su huella", () => {
    const withPkg = ALL_MODS.filter((m) => m.package);
    expect(withPkg.map((m) => m.code)).toContain("MOD01");
    for (const m of withPkg) {
      const buf = readFileSync(path.join(process.cwd(), "private", "mods", m.package!.file));
      expect(buf.byteLength, m.slug).toBe(m.package!.bytes);
      expect(createHash("sha256").update(buf).digest("hex"), m.slug).toBe(m.package!.sha256);
    }
  });
});
