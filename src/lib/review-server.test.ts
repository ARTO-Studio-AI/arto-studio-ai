import { beforeEach, describe, expect, it, vi } from "vitest";

/* review-server (2026-11-05): despublicar usa la receta del Catalogo (applyBulk, con
 * historial) antes de guardar la decision; aprobar no toca el prompt. La base se mockea. */

const { tables, upserts, calls, applyBulk } = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  upserts: [] as { table: string; rows: unknown; opts: unknown }[],
  calls: [] as string[],
  applyBulk: vi.fn(),
}));

/* Constructor de consultas falso: encadena y al hacer await resuelve tables[tabla]. Para
 * prompts filtra por el .in("id", ...) para imitar la base. */
function chain(table: string) {
  const c: Record<string, unknown> = {};
  let inIds: string[] | null = null;
  for (const m of ["select", "eq", "order", "range"]) c[m] = () => c;
  c.in = (col: string, v: string[]) => {
    if (col === "id") inIds = v;
    return c;
  };
  c.upsert = (rows: unknown, opts: unknown) => {
    calls.push(`upsert:${table}`);
    upserts.push({ table, rows, opts });
    return Promise.resolve({ error: null });
  };
  c.then = (resolve: (v: unknown) => unknown) => {
    const t = tables[table] ?? { data: [], error: null };
    const data = inIds && Array.isArray(t.data) ? (t.data as { id: string }[]).filter((r) => inIds!.includes(r.id)) : t.data;
    return Promise.resolve({ data, error: t.error }).then(resolve);
  };
  return c;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => chain(t) }) }));
vi.mock("@/lib/catalog-server", async (orig) => ({
  ...(await orig<typeof import("@/lib/catalog-server")>()),
  applyBulk: (...a: unknown[]) => {
    calls.push("applyBulk");
    return applyBulk(...a);
  },
}));

const { approvePrompts, unpublishPrompts, pendingReviewCount, loadPendingBatches } = await import("./review-server");

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  upserts.length = 0;
  calls.length = 0;
  applyBulk.mockReset().mockResolvedValue({ batchId: "lote-1", changed: 2, summary: "revisión: despublicar", embeddingsPending: 0 });
  tables.prompts = { data: [{ id: "AR-0251", is_published: true }, { id: "BR-0252", is_published: true }], error: null };
});

describe("unpublishPrompts", () => {
  it("despublica con historial y luego marca unpublished; los que no existen se reportan", async () => {
    const res = await unpublishPrompts(["AR-0251", "BR-0252", "ZZ-9999"], "victor@artogroup.com");
    expect(applyBulk).toHaveBeenCalledWith(["AR-0251", "BR-0252"], { is_published: false }, "victor@artogroup.com", "revisión");
    expect(calls).toEqual(["applyBulk", "upsert:prompt_reviews"]);
    const rows = upserts[0].rows as Record<string, unknown>[];
    expect(rows.map((r) => [r.prompt_id, r.status, r.reviewed_by])).toEqual([
      ["AR-0251", "unpublished", "victor@artogroup.com"],
      ["BR-0252", "unpublished", "victor@artogroup.com"],
    ]);
    expect(typeof rows[0].reviewed_at).toBe("string");
    expect(upserts[0].opts).toEqual({ onConflict: "prompt_id" });
    expect(res).toEqual({ done: 2, missing: ["ZZ-9999"], batchId: "lote-1" });
  });

  it("si ya estaban despublicados no hay lote que deshacer, pero queda la decision", async () => {
    applyBulk.mockResolvedValue({ batchId: "lote-2", changed: 0, summary: "", embeddingsPending: 0 });
    const res = await unpublishPrompts(["AR-0251"], "v");
    expect(res.batchId).toBeNull();
    expect(upserts).toHaveLength(1);
  });

  it("si despublicar falla no guarda la decision", async () => {
    applyBulk.mockRejectedValue(new Error("No se pudo guardar el historial"));
    await expect(unpublishPrompts(["AR-0251"], "v")).rejects.toThrow("historial");
    expect(upserts).toHaveLength(0);
  });
});

describe("approvePrompts", () => {
  it("solo guarda la decision, no toca el prompt", async () => {
    const res = await approvePrompts(["AR-0251", "ZZ-9999"], "v", "bien");
    expect(applyBulk).not.toHaveBeenCalled();
    expect((upserts[0].rows as Record<string, unknown>[]).map((r) => [r.prompt_id, r.status, r.note])).toEqual([["AR-0251", "approved", "bien"]]);
    expect(res).toEqual({ done: 1, missing: ["ZZ-9999"], batchId: null });
  });
});

describe("pendingReviewCount", () => {
  it("cuenta las altas sin decision", async () => {
    tables.catalog_changes = {
      data: [
        { batch_id: "b4", entity_id: "AR-0251", summary: "alta", changed_by: "code", created_at: "2026-11-04T08:10:20Z", reverted_at: null },
        { batch_id: "b4", entity_id: "BR-0252", summary: "alta", changed_by: "code", created_at: "2026-11-04T08:10:20Z", reverted_at: null },
      ],
      error: null,
    };
    tables.prompt_reviews = { data: [{ prompt_id: "AR-0251", status: "approved" }], error: null };
    expect(await pendingReviewCount()).toBe(1);
    expect((await loadPendingBatches())[0].ids).toEqual(["BR-0252"]);
  });

  it("null, nunca 0, si no se puede leer (por ejemplo, sin la migracion 0020)", async () => {
    tables.prompt_reviews = { data: null, error: { message: "relation \"public.prompt_reviews\" does not exist" } };
    expect(await pendingReviewCount()).toBeNull();
  });
});
