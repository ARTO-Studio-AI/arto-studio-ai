export type Lang = "en" | "es";

type Dict = {
  catalog: string;
  language: string;
  category: string;
  ai_tool: string;
  difficulty: string;
  tier: string;
  clear_filters: string;
  no_match: string;
  previous: string;
  next: string;
  page_label: (p: number, t: number) => string;
  smart_search: string;
  smart_search_hint: string;
  smart_search_placeholder: string;
  smart_search_thinking: string;
  smart_search_finding: string;
  smart_search_explaining: string;
  smart_search_cta: string;
  smart_search_recommendation: string;
  smart_search_more: string;
  back_to_catalog: string;
  prompt_label: string;
  when_to_use: string;
  expected_output: string;
  tags: string;
  upgrade_to_unlock: string;
  sign_in_to_unlock: string;
  see_pricing: string;
  pro_prompt: string;
  enterprise_prompt: string;
  copy: string;
  copied: string;
  favorite_add: string;
  favorite_remove: string;
  favorite_sign_in: string;
  nav_account: string;
  nav_favorites: string;
  account_title: string;
  account_email: string;
  account_tier: string;
  account_member_since: string;
  account_searches: string;
  account_favorites_count: string;
  account_signout: string;
  account_upgrade_cta: string;
  account_view_favorites: string;
  favorites_title: string;
  favorites_empty: string;
  favorites_subtitle: string;
};

const en: Dict = {
  catalog: "Catalog",
  language: "Language",
  category: "Category",
  ai_tool: "AI tool",
  difficulty: "Difficulty",
  tier: "Tier",
  clear_filters: "Clear filters",
  no_match: "No prompts match these filters.",
  previous: "← Previous",
  next: "Next →",
  page_label: (p, t) => `page ${p} of ${t}`,
  smart_search: "Smart search",
  smart_search_hint: "Describe your project or need in plain language. We'll recommend prompts with reasons.",
  smart_search_placeholder: "e.g. I'm launching a craft beer brand and need naming + visual identity",
  smart_search_thinking: "Thinking…",
  smart_search_finding: "Looking through the library…",
  smart_search_explaining: "These are the closest prompts. Writing how to use them together…",
  smart_search_cta: "Find prompts →",
  smart_search_recommendation: "Recommendation",
  smart_search_more: "More from the catalog →",
  back_to_catalog: "← Back to catalog",
  prompt_label: "Prompt",
  when_to_use: "When to use",
  expected_output: "Expected output",
  tags: "Tags",
  upgrade_to_unlock: "Upgrade to unlock.",
  sign_in_to_unlock: "Sign in to a paid plan to unlock.",
  see_pricing: "See pricing",
  pro_prompt: "Pro prompt",
  enterprise_prompt: "Enterprise prompt",
  copy: "Copy",
  copied: "Copied ✓",
  favorite_add: "Save",
  favorite_remove: "Saved",
  favorite_sign_in: "Sign in to save",
  nav_account: "Account",
  nav_favorites: "Favorites",
  account_title: "Your account",
  account_email: "Email",
  account_tier: "Plan",
  account_member_since: "Member since",
  account_searches: "Smart searches",
  account_favorites_count: "Favorites",
  account_signout: "Sign out",
  account_upgrade_cta: "See plans",
  account_view_favorites: "View your favorites →",
  favorites_title: "Your favorites",
  favorites_empty: "No favorites yet. Tap the save button on any prompt to add one.",
  favorites_subtitle: "Prompts you have saved across the catalog.",
};

const es: Dict = {
  catalog: "Catálogo",
  language: "Idioma",
  category: "Categoría",
  ai_tool: "Herramienta AI",
  difficulty: "Dificultad",
  tier: "Plan",
  clear_filters: "Limpiar filtros",
  no_match: "Ningún prompt coincide con estos filtros.",
  previous: "← Anterior",
  next: "Siguiente →",
  page_label: (p, t) => `página ${p} de ${t}`,
  smart_search: "Búsqueda inteligente",
  smart_search_hint: "Describe tu proyecto o lo que necesitas. Te vamos a recomendar prompts con razones.",
  smart_search_placeholder: "ej. Estoy lanzando una marca de cerveza artesanal y necesito naming + identidad visual",
  smart_search_thinking: "Pensando…",
  smart_search_finding: "Buscando en la biblioteca…",
  smart_search_explaining: "Estos son los prompts más cercanos. Estoy escribiendo cómo usarlos juntos…",
  smart_search_cta: "Buscar prompts →",
  smart_search_recommendation: "Recomendación",
  smart_search_more: "Más del catálogo →",
  back_to_catalog: "← Volver al catálogo",
  prompt_label: "Prompt",
  when_to_use: "Cuándo usarlo",
  expected_output: "Resultado esperado",
  tags: "Etiquetas",
  upgrade_to_unlock: "Actualiza tu plan para desbloquearlo.",
  sign_in_to_unlock: "Inicia sesión con un plan pagado para desbloquearlo.",
  see_pricing: "Ver precios",
  pro_prompt: "Prompt Pro",
  enterprise_prompt: "Prompt Enterprise",
  copy: "Copiar",
  copied: "Copiado ✓",
  favorite_add: "Guardar",
  favorite_remove: "Guardado",
  favorite_sign_in: "Inicia sesión para guardar",
  nav_account: "Cuenta",
  nav_favorites: "Favoritos",
  account_title: "Tu cuenta",
  account_email: "Correo",
  account_tier: "Plan",
  account_member_since: "Miembro desde",
  account_searches: "Búsquedas inteligentes",
  account_favorites_count: "Favoritos",
  account_signout: "Cerrar sesión",
  account_upgrade_cta: "Ver planes",
  account_view_favorites: "Ver tus favoritos →",
  favorites_title: "Tus favoritos",
  favorites_empty: "Sin favoritos todavía. Toca el botón de guardar en cualquier prompt para empezar.",
  favorites_subtitle: "Prompts que has guardado del catálogo.",
};

export const I18N: Record<Lang, Dict> = { en, es };

export function t(lang: Lang | undefined): Dict {
  return lang === "es" ? es : en;
}

// Bilingual labels for filter groups (categories, difficulties, tiers).
export const VERTICAL_LABEL_ES: Record<string, string> = {
  branding: "Branding",
  graphic_design: "Diseño Gráfico",
  copywriting: "Copywriting",
  photography: "Fotografía",
  video: "Video",
  ux_ui: "UX / UI",
  illustration: "Ilustración",
  marketing: "Marketing",
  music: "Música",
  architecture: "Arquitectura",
  fashion: "Moda",
  creative_productivity: "Productividad Creativa",
};

export const DIFFICULTY_LABEL_ES: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  expert: "Experto",
};

export const AI_GROUP_LABEL_ES: Record<string, string> = {
  text: "Texto",
  image: "Imagen",
  video: "Video",
  music: "Música",
  voice: "Voz",
  any: "Cualquiera",
};
