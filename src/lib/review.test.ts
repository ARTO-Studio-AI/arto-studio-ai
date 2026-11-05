import { describe, expect, it } from "vitest";
import { countPending, decidedIds, needsConfirm, parseReviewAction, pendingBatches, REVIEW_MAX, type CreateChange } from "./review";

/* Que alta sigue pendiente en /admin/revision y que acciones se aceptan (2026-11-05). */

const c = (batch: string, id: string, at: string, extra: Partial<CreateChange> = {}): CreateChange => ({
  batch_id: batch,
  entity_id: id,
  summary: `alta ${batch}`,
  changed_by: "code-ronda",
  created_at: at,
  reverted_at: null,
  ...extra,
});

const RONDA_2 = [c("b2", "UX-0252", "2026-11-02T08:11:24Z"), c("b2", "BR-0252", "2026-11-02T08:11:25Z")];
const RONDA_4 = [c("b4", "VD-0252", "2026-11-04T08:10:20Z"), c("b4", "AR-0251", "2026-11-04T08:10:21Z")];

describe("pendingBatches", () => {
  it("sin revisiones, todo alta esta pendiente, por lote y el mas reciente primero", () => {
    const out = pendingBatches([...RONDA_2, ...RONDA_4], []);
    expect(out.map((b) => b.batchId)).toEqual(["b4", "b2"]);
    expect(out[0].ids).toEqual(["AR-0251", "VD-0252"]);
    expect(out[0].createdAt).toBe("2026-11-04T08:10:20Z");
    expect(out[1]).toMatchObject({ summary: "alta b2", changedBy: "code-ronda", ids: ["BR-0252", "UX-0252"] });
    expect(countPending(out)).toBe(4);
  });

  it("approved y unpublished salen de la lista; pending sigue", () => {
    const out = pendingBatches([...RONDA_2, ...RONDA_4], [
      { prompt_id: "AR-0251", status: "approved" },
      { prompt_id: "VD-0252", status: "unpublished" },
      { prompt_id: "BR-0252", status: "pending" },
    ]);
    expect(out.map((b) => b.batchId)).toEqual(["b2"]);
    expect(out[0].ids).toEqual(["BR-0252", "UX-0252"]);
  });

  it("un despublicado que volvio a estar disponible (deshacer) regresa a la lista", () => {
    const reviews = [{ prompt_id: "VD-0252", status: "unpublished" as const }];
    expect(countPending(pendingBatches(RONDA_4, reviews, new Map([["VD-0252", true]])))).toBe(2);
    expect(countPending(pendingBatches(RONDA_4, reviews, new Map([["VD-0252", false]])))).toBe(1);
    // Si el prompt ya no existe, la decision se respeta.
    expect(countPending(pendingBatches(RONDA_4, reviews, new Map()))).toBe(1);
  });

  it("un aprobado no regresa aunque cambie su publicacion", () => {
    expect(decidedIds([{ prompt_id: "AR-0251", status: "approved" }], new Map([["AR-0251", false]])).has("AR-0251")).toBe(true);
  });

  it("ignora altas deshechas, ids raros y cuenta cada prompt una vez, en su alta mas reciente", () => {
    const out = pendingBatches(
      [
        c("viejo", "AR-0251", "2026-10-20T00:00:00Z"),
        ...RONDA_4,
        c("b5", "MK-0300", "2026-11-05T00:00:00Z", { reverted_at: "2026-11-05T01:00:00Z" }),
        c("b5", "skill-x", "2026-11-05T00:00:00Z"),
      ],
      [],
    );
    expect(out.map((b) => b.batchId)).toEqual(["b4"]);
    expect(countPending(out)).toBe(2);
  });

  it("sin altas no hay lotes", () => {
    expect(pendingBatches([], [])).toEqual([]);
  });
});

describe("parseReviewAction", () => {
  it("acepta aprobar y despublicar con ids validos, sin duplicados", () => {
    const r = parseReviewAction({ action: "approve", ids: ["AR-0251", "AR-0251", "BR-0252"], note: "  ok  " });
    expect(r).toEqual({ ok: true, value: { action: "approve", ids: ["AR-0251", "BR-0252"], note: "ok", confirm: "" } });
  });

  it("rechaza acciones, ids y cuerpos raros", () => {
    expect(parseReviewAction(null).ok).toBe(false);
    expect(parseReviewAction({ action: "delete", ids: ["AR-0251"] }).ok).toBe(false);
    expect(parseReviewAction({ action: "approve", ids: [] }).ok).toBe(false);
    expect(parseReviewAction({ action: "approve", ids: "AR-0251" }).ok).toBe(false);
    expect(parseReviewAction({ action: "approve", ids: ["ar-0251"] }).ok).toBe(false);
    expect(parseReviewAction({ action: "approve", ids: ["AR-0251'); drop table prompts;--"] }).ok).toBe(false);
    const many = Array.from({ length: REVIEW_MAX + 1 }, (_, i) => `AR-${String(i).padStart(4, "0")}`);
    expect(parseReviewAction({ action: "approve", ids: many }).ok).toBe(false);
  });

  it("despublicar mas de uno pide el numero como confirmacion", () => {
    const one = parseReviewAction({ action: "unpublish", ids: ["AR-0251"] });
    const two = parseReviewAction({ action: "unpublish", ids: ["AR-0251", "BR-0252"] });
    const twoOk = parseReviewAction({ action: "unpublish", ids: ["AR-0251", "BR-0252"], confirm: 2 });
    const approve = parseReviewAction({ action: "approve", ids: ["AR-0251", "BR-0252"] });
    if (!one.ok || !two.ok || !twoOk.ok || !approve.ok) throw new Error("parse");
    expect(needsConfirm(one.value)).toBe(false);
    expect(needsConfirm(two.value)).toBe(true);
    expect(needsConfirm(twoOk.value)).toBe(false);
    expect(needsConfirm(approve.value)).toBe(false);
  });
});
