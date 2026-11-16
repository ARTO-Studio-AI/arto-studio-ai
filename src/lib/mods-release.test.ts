import { describe, expect, it } from "vitest";
import { releasePassed } from "./mods";

describe("releasePassed", () => {
  it("no ha pasado el mismo dia ni antes", () => {
    expect(releasePassed("2026-11-09", new Date("2026-11-08T23:00:00Z"))).toBe(false);
    expect(releasePassed("2026-11-09", new Date("2026-11-09T23:59:00Z"))).toBe(false);
  });
  it("ya paso al dia siguiente", () => {
    expect(releasePassed("2026-11-09", new Date("2026-11-10T00:00:00Z"))).toBe(true);
    expect(releasePassed("2026-11-09", new Date("2026-11-16T08:00:00Z"))).toBe(true);
  });
});
