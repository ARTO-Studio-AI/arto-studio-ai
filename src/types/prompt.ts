export type Category =
  | "branding"
  | "graphic_design"
  | "photography"
  | "video"
  | "copywriting"
  | "ux_ui"
  | "illustration"
  | "music"
  | "marketing"
  | "architecture"
  | "fashion"
  | "creative_productivity";

export type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";
export type Tier = "free" | "pro" | "enterprise";

export interface Prompt {
  id: string;
  title_en: string;
  title_es: string;
  prompt_en: string;
  prompt_es: string;
  category: Category;
  subcategory: string;
  ai_model: string;
  difficulty: Difficulty;
  tags: string[];
  tier: Tier;
  version: string;
  author?: string;
  use_case?: string | null;
  expected_output?: string | null;
  view_count?: number;
  copy_count?: number;
  favorite_count?: number;
  is_published?: boolean;
  is_featured?: boolean;
  featured_at?: string;
  featured_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const VERTICALS: Record<Category, { code: string; label_en: string; label_es: string }> = {
  branding: { code: "BR", label_en: "Branding", label_es: "Branding" },
  graphic_design: { code: "DG", label_en: "Graphic Design", label_es: "Diseño Gráfico" },
  copywriting: { code: "CW", label_en: "Copywriting", label_es: "Copywriting" },
  photography: { code: "FT", label_en: "Photography", label_es: "Fotografía" },
  video: { code: "VD", label_en: "Video", label_es: "Video" },
  ux_ui: { code: "UX", label_en: "UX / UI", label_es: "UX / UI" },
  illustration: { code: "IL", label_en: "Illustration", label_es: "Ilustración" },
  marketing: { code: "MK", label_en: "Marketing", label_es: "Marketing" },
  music: { code: "MU", label_en: "Music", label_es: "Música" },
  architecture: { code: "AR", label_en: "Architecture", label_es: "Arquitectura" },
  fashion: { code: "FA", label_en: "Fashion", label_es: "Moda" },
  creative_productivity: { code: "CP", label_en: "Creative Productivity", label_es: "Productividad Creativa" },
};

/* Chips monocromos (Fase 2, 11 sep 2026): solo zinc + un punto de acento.
 * El significado lo lleva el texto, no el color. Los semanticos (ok/warn/bad)
 * quedan reservados a los scores del Brand Roast. */
const NEUTRAL_CAT = { chip: "bg-zinc-100 text-zinc-700", ring: "ring-zinc-400", dot: "bg-zinc-300" };
export const CATEGORY_STYLES: Record<Category, { chip: string; ring: string; dot: string }> = {
  branding: NEUTRAL_CAT, graphic_design: NEUTRAL_CAT, copywriting: NEUTRAL_CAT,
  photography: NEUTRAL_CAT, video: NEUTRAL_CAT, ux_ui: NEUTRAL_CAT,
  illustration: NEUTRAL_CAT, marketing: NEUTRAL_CAT, music: NEUTRAL_CAT,
  architecture: NEUTRAL_CAT, fashion: NEUTRAL_CAT, creative_productivity: NEUTRAL_CAT,
};

/* Dificultad: mismo chip, el nivel lo marca el numero de puntos (1 a 4). */
export const DIFFICULTY_STYLES: Record<Difficulty, { chip: string; label: string; dots: number }> = {
  beginner: { chip: "bg-zinc-100 text-zinc-700", label: "Beginner", dots: 1 },
  intermediate: { chip: "bg-zinc-100 text-zinc-700", label: "Intermediate", dots: 2 },
  advanced: { chip: "bg-zinc-100 text-zinc-700", label: "Advanced", dots: 3 },
  expert: { chip: "bg-zinc-900 text-white", label: "Expert", dots: 4 },
};

export const TIER_STYLES: Record<Tier, { chip: string; label: string }> = {
  free: { chip: "bg-zinc-100 text-zinc-700", label: "Free" },
  pro: { chip: "bg-zinc-700 text-white", label: "Pro" },
  enterprise: { chip: "bg-zinc-900 text-white", label: "Enterprise" },
};

// ──────────────────────────────────────────────────────────────────
// AI tools — grouped by output modality.
// Labels never contain underscores (user-facing).
// ──────────────────────────────────────────────────────────────────

export type AiGroup = "text" | "image" | "video" | "music" | "voice" | "any";

/* Grupos de herramienta: monocromo con punto de acento; el texto distingue. */
const GROUP_CHIP = "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200";
export const AI_GROUPS: Record<AiGroup, { label: string; chip: string }> = {
  text: { label: "Text", chip: GROUP_CHIP },
  image: { label: "Image", chip: GROUP_CHIP },
  video: { label: "Video", chip: GROUP_CHIP },
  music: { label: "Music", chip: GROUP_CHIP },
  voice: { label: "Voice", chip: GROUP_CHIP },
  any: { label: "Any", chip: "bg-zinc-100 text-zinc-700" },
};

/* Fecha del ultimo cambio a este catalogo. Se actualiza a mano al tocar AI_TOOLS
 * y la muestra /tools como "Last updated". */
export const AI_TOOLS_UPDATED = "2026-09-11";

export interface AiTool {
  key: string;            // internal key (matches ai_model values in DB)
  label: string;          // user-facing — no underscores, ever
  group: AiGroup;
  description: string;    // 1-line summary of what it's best at
  url?: string;           // canonical homepage
  status?: "active" | "deprecating" | "preview";
}

// Master catalog. Add new tools here as the landscape evolves; the catalog page
// reads from this list and the ai_model lookup helpers below derive from it.
export const AI_TOOLS: AiTool[] = [
  // Text / LLMs
  { key: "claude", label: "Claude", group: "text", description: "Anthropic's general-purpose LLM. Best for nuanced writing, analysis, and code.", url: "https://claude.ai" },
  { key: "claude_opus", label: "Claude Opus", group: "text", description: "Anthropic's flagship Claude tier. Heavy reasoning, long context.", url: "https://claude.ai" },
  { key: "claude_sonnet", label: "Claude Sonnet", group: "text", description: "Anthropic's balanced Claude tier. Most common pick for daily creative work.", url: "https://claude.ai" },
  { key: "gpt", label: "GPT", group: "text", description: "OpenAI's general-purpose model family. Broad ecosystem and tools integration.", url: "https://chat.openai.com" },
  { key: "gpt_5", label: "GPT-5", group: "text", description: "Latest OpenAI flagship. Strong all-rounder for text and reasoning.", url: "https://chat.openai.com" },
  { key: "gemini_3", label: "Gemini 3", group: "text", description: "Google's flagship LLM. Long context, multimodal, deep Google integration.", url: "https://gemini.google.com" },

  // Image generators
  { key: "midjourney", label: "Midjourney", group: "image", description: "Atmosphere, art-directed and cinematic visuals. King of aesthetics.", url: "https://midjourney.com" },
  { key: "flux", label: "Flux Pro", group: "image", description: "Photorealism leader (Black Forest Labs). Product, portrait, landscape.", url: "https://blackforestlabs.ai" },
  { key: "gpt_image", label: "GPT Image", group: "image", description: "Native image generation in ChatGPT. Replaced DALL·E. Strong on text in image.", url: "https://chat.openai.com" },
  { key: "imagen", label: "Imagen", group: "image", description: "Google's photorealism + typography model. Native to Vertex AI.", url: "https://deepmind.google/models/imagen/" },
  { key: "ideogram", label: "Ideogram", group: "image", description: "Best-in-class text rendering inside images (~90% accuracy).", url: "https://ideogram.ai" },
  { key: "recraft", label: "Recraft", group: "image", description: "Logos, icons, vector marks at scale. Tops HuggingFace logo benchmarks.", url: "https://recraft.ai" },
  { key: "stable_diffusion", label: "Stable Diffusion", group: "image", description: "Open source. Fine control via ControlNet, LoRAs, custom checkpoints.", url: "https://stability.ai" },
  { key: "firefly", label: "Adobe Firefly", group: "image", description: "Commercial-safe — trained only on licensed stock. Native to Adobe apps.", url: "https://firefly.adobe.com" },
  { key: "nano_banana", label: "Nano Banana", group: "image", description: "Google's lightweight image preview model. Fast, accessible.", url: "https://aistudio.google.com" },
  { key: "krea", label: "Krea", group: "image", description: "Real-time generative canvas. Live painting, prompt-as-you-go.", url: "https://krea.ai" },
  { key: "dall_e", label: "DALL·E", group: "image", description: "OpenAI's earlier image model. Now superseded by GPT Image.", url: "https://openai.com/index/dall-e-3/", status: "deprecating" },

  // Video generators
  { key: "veo", label: "Veo", group: "video", description: "Google's all-around leader. 4K, native audio, narrative scenes.", url: "https://deepmind.google/models/veo/" },
  { key: "kling", label: "Kling", group: "video", description: "Cinematic lighting, multi-shot storyboards, character consistency.", url: "https://klingai.com" },
  { key: "runway", label: "Runway", group: "video", description: "Granular control: motion brush, camera moves, character consistency.", url: "https://runwayml.com" },
  { key: "pika", label: "Pika", group: "video", description: "Social-first. Rapid effects, lip-sync, character swaps.", url: "https://pika.art" },
  { key: "hailuo", label: "Hailuo", group: "video", description: "MiniMax's video model. Expressive motion on unusual prompts.", url: "https://hailuoai.video" },
  { key: "seedance", label: "Seedance", group: "video", description: "Quality on a budget. Native 4K, multi-shot capable.", url: "https://seedance.com" },
  { key: "higgsfield", label: "Higgsfield", group: "video", description: "Camera-driven storytelling and motion presets.", url: "https://higgsfield.ai" },
  { key: "luma", label: "Luma Dream Machine", group: "video", description: "Consumer-friendly. Fast iteration, character animation.", url: "https://lumalabs.ai/dream-machine" },
  { key: "sora", label: "Sora", group: "video", description: "OpenAI's first video model. Sunsetting in September 2026.", url: "https://openai.com/sora", status: "deprecating" },

  // Music
  { key: "suno", label: "Suno", group: "music", description: "Songs with vocals + lyrics. Leader for pop, rock, hip-hop.", url: "https://suno.com" },
  { key: "udio", label: "Udio", group: "music", description: "Instrumentals, genre accuracy, production detail.", url: "https://udio.com" },
  { key: "riffusion", label: "Riffusion", group: "music", description: "API-first, unlimited generation. Spectrogram-based.", url: "https://riffusion.com" },
  { key: "aiva", label: "AIVA", group: "music", description: "Film, TV, and game scoring with MIDI export.", url: "https://aiva.ai" },
  { key: "elevenlabs_music", label: "ElevenLabs Music", group: "music", description: "Native music inside ElevenLabs' stack.", url: "https://elevenlabs.io/music" },

  // Voice / TTS
  { key: "elevenlabs", label: "ElevenLabs", group: "voice", description: "Cloning, narration, audiobooks. 32 languages.", url: "https://elevenlabs.io" },
  { key: "openai_tts", label: "OpenAI TTS", group: "voice", description: "GPT-integrated TTS. Voice instructions like 'whisper' or 'be sarcastic'.", url: "https://platform.openai.com/docs/guides/text-to-speech" },
  { key: "cartesia", label: "Cartesia", group: "voice", description: "Latency leader (<100ms). Real-time voice agents.", url: "https://cartesia.ai" },
  { key: "hume", label: "Hume Octave", group: "voice", description: "Emotion-aware TTS. Natural language tone control.", url: "https://hume.ai" },
  { key: "playht", label: "PlayHT", group: "voice", description: "Mid-tier general purpose TTS.", url: "https://play.ht" },

  // Generic
  { key: "any", label: "Any", group: "any", description: "Works with any modern model. Briefs, specs, and meta-prompts.", status: "active" },
];

const TOOL_BY_KEY: Record<string, AiTool> = Object.fromEntries(AI_TOOLS.map((t) => [t.key, t]));

// Legacy / variant keys still present in the database (alias them).
const LEGACY_ALIASES: Record<string, string> = {
  "dall-e": "dall_e",
  generic: "any",
};

export function aiGroupOf(model: string): AiGroup {
  const key = LEGACY_ALIASES[model] ?? model;
  return TOOL_BY_KEY[key]?.group ?? "any";
}

export function aiModelLabel(model: string): string {
  const key = LEGACY_ALIASES[model] ?? model;
  return TOOL_BY_KEY[key]?.label ?? model.replace(/_/g, " ");
}

export function aiTool(model: string): AiTool | undefined {
  const key = LEGACY_ALIASES[model] ?? model;
  return TOOL_BY_KEY[key];
}

// Humanize "motion_graphics" → "Motion Graphics" for subcategory labels in the UI.
export function humanize(s: string): string {
  if (!s) return s;
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
