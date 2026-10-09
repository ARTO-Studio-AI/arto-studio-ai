import { describe, expect, it } from "vitest";
import { listChangeFor } from "./resend-webhook";

describe("listChangeFor (webhook de Resend)", () => {
  it("rebote permanente -> bounced, en minusculas y sin repetidos", () => {
    expect(
      listChangeFor({ type: "email.bounced", data: { to: ["Ana@Ejemplo.com", "ana@ejemplo.com"], bounce: { type: "Permanent", subType: "General" } } }),
    ).toEqual({ emails: ["ana@ejemplo.com"], status: "bounced", reason: "bounce:General" });
  });

  it("rebote temporal no saca a nadie", () => {
    expect(listChangeFor({ type: "email.bounced", data: { to: ["ana@ejemplo.com"], bounce: { type: "Transient" } } })).toBeNull();
  });

  it("queja de spam -> unsubscribed", () => {
    expect(listChangeFor({ type: "email.complained", data: { to: ["ana@ejemplo.com"] } })?.status).toBe("unsubscribed");
  });

  it("suprimido -> bounced", () => {
    expect(listChangeFor({ type: "email.suppressed", data: { to: ["ana@ejemplo.com"], suppressed: { type: "OnAccountSuppressionList" } } })?.status).toBe("bounced");
  });

  it("baja desde un Broadcast (contact.updated) -> unsubscribed; sin baja no hace nada", () => {
    expect(listChangeFor({ type: "contact.updated", data: { email: "ana@ejemplo.com", unsubscribed: true } })?.status).toBe("unsubscribed");
    expect(listChangeFor({ type: "contact.updated", data: { email: "ana@ejemplo.com", unsubscribed: false } })).toBeNull();
  });

  it("eventos que no tocan la lista se ignoran", () => {
    expect(listChangeFor({ type: "email.delivered", data: { to: ["ana@ejemplo.com"] } })).toBeNull();
    expect(listChangeFor({ type: "email.opened" })).toBeNull();
    expect(listChangeFor({})).toBeNull();
  });
});
