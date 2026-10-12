import { afterEach, describe, expect, it } from "vitest";
import { isAdminEmail, isAdminEmailAsync } from "./auth";

/* ADMIN_EMAILS es la unica puerta al panel (D14, 2026-10-12): estos casos no deben cambiar. */
describe("isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("falla cerrado sin lista o sin correo", async () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("ana@artogroup.com")).toBe(false);
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("ana@artogroup.com")).toBe(false);
    process.env.ADMIN_EMAILS = "ana@artogroup.com";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(await isAdminEmailAsync(undefined)).toBe(false);
  });

  it("normaliza mayusculas, espacios y comas de mas", async () => {
    process.env.ADMIN_EMAILS = " Ana@ArtoGroup.com ,, beto@artogroup.com ";
    expect(isAdminEmail("ana@artogroup.com")).toBe(true);
    expect(isAdminEmail("  BETO@artogroup.com ")).toBe(true);
    expect(await isAdminEmailAsync("ana@artogroup.com")).toBe(true);
  });

  it("no acepta coincidencias parciales", () => {
    process.env.ADMIN_EMAILS = "ana@artogroup.com";
    expect(isAdminEmail("ana@artogroup.co")).toBe(false);
    expect(isAdminEmail("xana@artogroup.com")).toBe(false);
    expect(isAdminEmail("ana@artogroup.com.mx")).toBe(false);
  });
});
