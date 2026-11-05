/* Supabase falso para las pruebas de promociones (2026-11-05): tablas en memoria. Cubre lo
 * que usan src/lib/promos/estado.ts, admin-server.ts, /api/promo y el checkout de Pro:
 * select/order/limit/eq/maybeSingle, insert y update().eq(). Nunca toca una base real. */

type Row = Record<string, unknown>;

export interface FakePromosDb {
  db: Record<string, Row[]>;
  /** Las lecturas fallan como si la base estuviera caida: todas (true) o solo esas tablas. */
  failReads: boolean | string[];
  /** La tabla promotions no existe (falta la migracion 0022). */
  missingTable: boolean;
  failWrites: boolean;
  /** Cuantas veces se pidio un cliente (para medir la cache). */
  reads: number;
  client: unknown;
}

export function fakePromosDb(db: Record<string, Row[]> = {}): FakePromosDb {
  const fake: FakePromosDb = { db, failReads: false, missingTable: false, failWrites: false, reads: 0, client: null };
  const table = (name: string) => (db[name] ??= []);

  function from(name: string) {
    const filters: [string, unknown][] = [];
    let patch: Row | null = null;
    const isPromo = name === "promotions" || name === "promotion_changes";
    const readErr = () =>
      fake.missingTable && isPromo
        ? { code: "PGRST205", message: `Could not find the table 'public.${name}' in the schema cache` }
        : fake.failReads === true || (Array.isArray(fake.failReads) && fake.failReads.includes(name))
          ? { code: "08006", message: "base caida" }
          : null;
    const writeErr = () => (fake.failWrites ? { message: "no se pudo escribir" } : readErr());
    const apply = () => table(name).filter((r) => filters.every(([c, v]) => r[c] === v));
    const q = {
      select: () => {
        if (name === "promotions") fake.reads++;
        return q;
      },
      eq: (col: string, v: unknown) => (filters.push([col, v]), q),
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: readErr() ? null : (apply()[0] ?? null), error: readErr() }),
      insert: async (row: Row) => {
        const err = writeErr();
        if (err) return { error: err };
        table(name).push({ id: table(name).length + 1, created_at: new Date().toISOString(), ...row });
        return { error: null };
      },
      update: (p: Row) => {
        patch = p;
        return q;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        if (patch) {
          const err = writeErr();
          if (!err) for (const r of apply()) Object.assign(r, patch);
          return Promise.resolve({ error: err }).then(resolve, reject);
        }
        const err = readErr();
        return Promise.resolve(err ? { data: null, error: err } : { data: apply().map((r) => ({ ...r })), error: null }).then(resolve, reject);
      },
    };
    return q;
  }

  fake.client = { from };
  return fake;
}

/** Fila de promotions valida, con lo que se quiera cambiar encima. */
export function promoRow(over: Row = {}): Row {
  const copy = (t: string) => ({ title: t, subtitle: `${t} sub`, cta: "Aprovechar", badge: "Promo" });
  return {
    id: "promo-a",
    name: "Promo A",
    kind: "percent",
    percent_off: 30,
    amount_off_cents: null,
    currency: null,
    duration_months: 1,
    trial_days: null,
    stripe_coupon_id: "COUPON_A",
    clock_hours: 48,
    audience: "anon",
    utm_campaign: null,
    starts_at: "2026-11-01T00:00:00.000Z",
    ends_at: "2026-12-01T00:00:00.000Z",
    enabled: true,
    copy: { es: copy("Promo A"), en: copy("Promo A en") },
    coupon_verified_at: "2026-11-01T00:00:00.000Z",
    coupon_snapshot: null,
    created_by: "victor@arto",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_by: "victor@arto",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}
