/* Seleccion de prompts del resumen semanal (2026-10-16). Logica pura: la ruta trae los
 * candidatos de la base y aqui se decide. Regla de Victor (16 oct), definida por Code:
 *   1. Nunca se repite un prompt: los candidatos ya vienen sin lo que esta en digest_sends.
 *   2. Primero los publicados en los ultimos 7 dias, del mas nuevo al mas viejo.
 *   3. Lo que falte, al azar entre el resto, sin repetir vertical mientras se pueda.
 *   4. Gratis y Pro mezclados; la plantilla pone la etiqueta.
 * Gancho apagado: `mostUsed` (los mas abiertos de la semana) entraria entre el paso 2 y
 * el 3 cuando Victor lo decida; hoy la ruta siempre lo manda vacio. */

export interface DigestCandidate {
  id: string;
  category: string;
  tier: string;
  created_at: string | null;
}

export interface SelectionInput {
  /** Publicados en los ultimos 7 dias y nunca enviados. */
  recent: DigestCandidate[];
  /** Gancho de «los mas usados de la semana», ya ordenado. Apagado: hoy llega vacio. */
  mostUsed?: DigestCandidate[];
  /** Todos los publicados nunca enviados (incluye a los recientes; se descartan duplicados). */
  pool: DigestCandidate[];
  count?: number;
  /** Generador en [0, 1). Las pruebas pasan uno fijo. */
  random?: () => number;
}

export const DIGEST_COUNT = 5;
export const DIGEST_STRATEGY = "new_then_random";

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function selectDigestPrompts({ recent, mostUsed = [], pool, count = DIGEST_COUNT, random = Math.random }: SelectionInput): DigestCandidate[] {
  const chosen: DigestCandidate[] = [];
  const ids = new Set<string>();
  const add = (p: DigestCandidate) => {
    if (chosen.length >= count || ids.has(p.id)) return;
    chosen.push(p);
    ids.add(p.id);
  };

  const newestFirst = [...recent].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  for (const p of newestFirst) add(p);
  for (const p of mostUsed) add(p);
  if (chosen.length >= count) return chosen;

  // Al azar, primero una por vertical que todavia no salio; luego lo que quede.
  const rest = shuffle(pool.filter((p) => !ids.has(p.id)), random);
  const used = new Set(chosen.map((p) => p.category));
  for (const p of rest) {
    if (chosen.length >= count) break;
    if (!used.has(p.category)) {
      add(p);
      used.add(p.category);
    }
  }
  for (const p of rest) add(p);
  return chosen;
}
