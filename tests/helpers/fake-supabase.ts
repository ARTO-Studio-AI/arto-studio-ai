/* Supabase falso para las pruebas del catalogo (2026-11-05): tablas en memoria y Storage que
 * solo anota llamadas. Cubre lo que usan src/lib/catalogo/efectivo.ts y admin-server.ts. */

type Row = Record<string, unknown>;
export type FakeDb = Record<string, Row[]>;

export interface FakeSupabase {
  db: FakeDb;
  failReads: boolean;
  failWrites: boolean;
  calls: { uploads: string[]; removes: string[]; signed: { path: string; seconds: number; download?: string }[] };
  client: unknown;
}

export function fakeSupabase(db: FakeDb = {}): FakeSupabase {
  const fake: FakeSupabase = { db, failReads: false, failWrites: false, calls: { uploads: [], removes: [], signed: [] }, client: null };
  const table = (name: string) => (db[name] ??= []);

  function from(name: string) {
    const filters: [string, unknown][] = [];
    const apply = () => table(name).filter((r) => filters.every(([c, v]) => r[c] === v));
    const readErr = () => (fake.failReads ? { message: "base caida" } : null);
    const writeErr = () => (fake.failWrites ? { message: "no se pudo escribir" } : null);
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => (filters.push([col, v]), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: readErr() ? null : (apply()[0] ?? null), error: readErr() }),
      upsert: async (row: Row, opts: { onConflict: string }) => {
        if (writeErr()) return { error: writeErr() };
        const keys = opts.onConflict.split(",");
        const i = table(name).findIndex((x) => keys.every((k) => x[k] === row[k]));
        if (i >= 0) table(name)[i] = { ...table(name)[i], ...row };
        else table(name).push({ ...row });
        return { error: null };
      },
      insert: async (row: Row) => {
        if (writeErr()) return { error: writeErr() };
        table(name).push({ id: table(name).length + 1, created_at: new Date().toISOString(), ...row });
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(readErr() ? { data: null, error: readErr() } : { data: apply(), error: null }).then(resolve, reject),
    };
    return q;
  }

  fake.client = {
    from,
    storage: {
      from: () => ({
        upload: async (path: string) => (fake.failWrites ? { error: { message: "storage caido" } } : (fake.calls.uploads.push(path), { error: null })),
        remove: async (paths: string[]) => (fake.calls.removes.push(...paths), { error: null }),
        createSignedUrl: async (path: string, seconds: number, opts?: { download?: string }) => {
          fake.calls.signed.push({ path, seconds, download: opts?.download });
          return { data: { signedUrl: `https://storage.example.com/sign/${path}?token=t` }, error: null };
        },
      }),
    },
  };
  return fake;
}
