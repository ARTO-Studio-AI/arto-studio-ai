import { afterAll, describe, expect, it } from "vitest";
import {
  FREE_DAILY_OPENS,
  adoptOpens,
  closeDb,
  deleteOpens,
  getSubject,
  getUsed,
  isUnlimitedTier,
  nextResetUtc,
  openForTier,
  tryOpen,
  utcDay,
} from "@/lib/prompt-limit";

/* Contador free de 3 prompts abiertos al dia (D7).
 * Las cinco pruebas del diseno corren contra la base real por DATABASE_URL con
 * sujetos `test:<fecha>:<random>` que se borran al final. Sin DATABASE_URL (CI)
 * se saltan y solo corren las puras. */

const HAS_DB = !!process.env.DATABASE_URL && !/localhost\/x$/.test(process.env.DATABASE_URL);
const DAY = "2030-01-15"; // dia forzado, lejos del real, para no chocar con trafico
const NEXT_DAY = "2030-01-16";
const stamp = `${utcDay()}:${Math.random().toString(36).slice(2, 8)}`;
const subjects: string[] = [];
function subject(tag: string) {
  const s = `test:${stamp}:${tag}`;
  subjects.push(s);
  return s;
}

describe("prompt-limit (puro)", () => {
  it("el sujeto prioriza usuario > cookie > ip", () => {
    expect(getSubject({ userId: "u1", vid: "v1", ip: "1.1.1.1" })).toBe("user:u1");
    expect(getSubject({ vid: "v1", ip: "1.1.1.1" })).toBe("vid:v1");
    const a = getSubject({ ip: "1.1.1.1, 10.0.0.1" });
    const b = getSubject({ ip: "1.1.1.1" });
    expect(a).toBe(b);
    expect(a.startsWith("ip:")).toBe(true);
    expect(getSubject({})).toMatch(/^ip:/);
  });

  it("pro, enterprise y grants no tienen tope; free si", () => {
    expect(isUnlimitedTier("pro")).toBe(true);
    expect(isUnlimitedTier("enterprise")).toBe(true);
    expect(isUnlimitedTier("free")).toBe(false);
    expect(isUnlimitedTier(null)).toBe(false);
    expect(isUnlimitedTier(undefined)).toBe(false);
  });

  it("el dia es UTC y el reinicio es la siguiente medianoche UTC", () => {
    const now = new Date("2026-09-11T23:30:00Z");
    expect(utcDay(now)).toBe("2026-09-11");
    expect(nextResetUtc(now)).toBe("2026-09-12T00:00:00.000Z");
    expect(FREE_DAILY_OPENS).toBe(3);
  });
});

describe.skipIf(!HAS_DB)("prompt-limit (integracion contra DATABASE_URL)", () => {
  afterAll(async () => {
    for (const s of subjects) await deleteOpens(s);
    await closeDb();
  });

  it("1. tres prompts distintos pasan y el cuarto se bloquea", async () => {
    const s = subject("tres");
    const r1 = await tryOpen(s, "BR-0001", { day: DAY });
    const r2 = await tryOpen(s, "BR-0002", { day: DAY });
    const r3 = await tryOpen(s, "BR-0003", { day: DAY });
    const r4 = await tryOpen(s, "BR-0004", { day: DAY });
    expect([r1.allowed, r2.allowed, r3.allowed]).toEqual([true, true, true]);
    expect([r1.used, r2.used, r3.used]).toEqual([1, 2, 3]);
    expect(r4.allowed).toBe(false);
    expect(r4.used).toBe(3);
    expect(r4.limit).toBe(3);
    expect(await getUsed(s, DAY)).toBe(3);
  });

  it("2. reabrir el mismo prompt el mismo dia no cuenta", async () => {
    const s = subject("reabrir");
    await tryOpen(s, "BR-0001", { day: DAY });
    const again = await tryOpen(s, "BR-0001", { day: DAY });
    expect(again.allowed).toBe(true);
    expect(again.used).toBe(1);
    await tryOpen(s, "BR-0002", { day: DAY });
    await tryOpen(s, "BR-0003", { day: DAY });
    // Con el tope lleno, el prompt ya abierto sigue abierto.
    const reopen = await tryOpen(s, "BR-0002", { day: DAY });
    expect(reopen.allowed).toBe(true);
    expect(reopen.used).toBe(3);
    expect((await tryOpen(s, "BR-0009", { day: DAY })).allowed).toBe(false);
  });

  it("3. pro no tiene tope aunque el sujeto ya lleve tres", async () => {
    const s = subject("pro");
    for (const id of ["BR-0001", "BR-0002", "BR-0003"]) await tryOpen(s, id, { day: DAY });
    const free = await openForTier("free", s, "BR-0004", { day: DAY });
    const pro = await openForTier("pro", s, "BR-0004", { day: DAY });
    const ent = await openForTier("enterprise", s, "BR-0005", { day: DAY });
    expect(free.allowed).toBe(false);
    expect(pro.allowed).toBe(true);
    expect(pro.unlimited).toBe(true);
    expect(ent.allowed).toBe(true);
    // Pro no escribe filas: el sujeto sigue en 3.
    expect(await getUsed(s, DAY)).toBe(3);
  });

  it("4. un dia nuevo reinicia el contador", async () => {
    const s = subject("dia");
    for (const id of ["BR-0001", "BR-0002", "BR-0003"]) await tryOpen(s, id, { day: DAY });
    expect((await tryOpen(s, "BR-0004", { day: DAY })).allowed).toBe(false);
    const fresh = await tryOpen(s, "BR-0004", { day: NEXT_DAY });
    expect(fresh.allowed).toBe(true);
    expect(fresh.used).toBe(1);
    expect(await getUsed(s, NEXT_DAY)).toBe(1);
    expect(await getUsed(s, DAY)).toBe(3);
  });

  it("5. al registrarse, las aperturas del anonimo pasan al usuario", async () => {
    const vid = subject("vid");
    const user = subject("user");
    await tryOpen(vid, "BR-0001", { day: DAY });
    await tryOpen(vid, "BR-0002", { day: DAY });
    // El usuario ya habia abierto BR-0002 con su cuenta: no debe duplicar ni fallar.
    await tryOpen(user, "BR-0002", { day: DAY });
    const moved = await adoptOpens(vid, user, DAY);
    expect(moved).toBe(2);
    expect(await getUsed(vid, DAY)).toBe(0);
    expect(await getUsed(user, DAY)).toBe(2);
    expect((await tryOpen(user, "BR-0003", { day: DAY })).allowed).toBe(true);
    // Registrarse no regala tres mas.
    expect((await tryOpen(user, "BR-0004", { day: DAY })).allowed).toBe(false);
  });
});
