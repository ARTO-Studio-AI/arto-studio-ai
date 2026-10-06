export type RoastLang = "es" | "en";

export interface RoastResult {
  overall: number;
  strategy: { score: number; roast: string };
  creativity: { score: number; roast: string };
  narrative: { score: number; roast: string };
  digital: { score: number; roast: string };
  verdict: string;
  improvements: string[];
  /** v2 (2026-10-06): frase corta para compartir. Opcional para no romper clientes viejos. */
  headline?: string;
  /** v2: observaciones concretas (citas del sitio, faltantes) en las que se basan los scores. */
  evidence?: string[];
  /** v2: idioma en que se escribio el roast. */
  lang?: RoastLang;
}

export interface RoastRequest {
  brandName: string;
  websiteUrl?: string;
  industry: string;
  companySize?: string;
  description?: string;
  /** Idioma de salida. Por defecto "es" desde el v2. */
  lang?: RoastLang;
}

export interface RoastResponse {
  source: "ai" | "fallback";
  result: RoastResult;
}
