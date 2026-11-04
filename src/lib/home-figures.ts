import { VERTICALS, aiTool, type AiGroup } from "@/types/prompt";

/* Cifras y cinta de herramientas de la home (2026-11-05). Funciones puras para poder
 * probarlas; la lectura de la base con cache vive en home-figures-server.ts. */

/* Las 12 verticales salen del catalogo de tipos, no de un numero escrito a mano. */
export const VERTICAL_COUNT = Object.keys(VERTICALS).length;

/* Redondea el total de prompts a una cifra limpia para marketing.
 * Debajo de 1k va exacto. Arriba se redondea hacia abajo a la centena y lleva "+", para que
 * la cifra publica nunca exagere. Ejemplos: 1842 → "1,800+", 3045 → "3,000+", 12 → "12". */
export function formatPromptCount(n: number): string {
  if (n < 1000) return String(n);
  const floored = Math.floor(n / 100) * 100;
  return `${floored.toLocaleString("en-US")}+`;
}

export interface HomeTool {
  key: string;
  label: string;
  group: AiGroup;
  count: number;
}

/* Quien llega busca «Claude» o «ChatGPT», no el nivel del modelo: en la cinta las variantes
 * cuentan como una sola herramienta (2026-11-05). */
const FAMILY: Record<string, string> = {
  claude_opus: "claude",
  claude_sonnet: "claude",
  gpt_5: "gpt",
};
const LABEL_OVERRIDE: Record<string, string> = { gpt: "ChatGPT" };

/* Herramientas reales del catalogo a partir de los ai_model publicados, de la mas usada a la
 * menos. Fuera: modelos sin ficha en AI_TOOLS, los genericos ("any") y los que estan en
 * retiro (Sora, DALL·E), para no anunciar algo que ya no se puede usar. */
export function toolsFromModels(
  models: readonly (string | null | undefined)[],
  { limit = 18, min = 3 }: { limit?: number; min?: number } = {},
): HomeTool[] {
  const counts = new Map<string, number>();
  for (const m of models) {
    if (!m) continue;
    const tool = aiTool(m);
    if (!tool || tool.group === "any" || tool.status === "deprecating") continue;
    const key = FAMILY[tool.key] ?? tool.key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: HomeTool[] = [];
  for (const [key, count] of counts) {
    const tool = aiTool(key);
    if (!tool || count < min) continue;
    out.push({ key, label: LABEL_OVERRIDE[key] ?? tool.label, group: tool.group, count });
  }
  return out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}
