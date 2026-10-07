import { ImageResponse } from "next/og";
import { getLearnPageBySlug } from "@/lib/learn-pages";
import { CHAR_SIZES, OG, clip, ogFonts, ogImage } from "@/lib/og-kit";
import { SITE_HOST } from "@/lib/site-url";
import { VERTICALS, type Category } from "@/types/prompt";

/* Imagen para redes de cada guia del blog (1200x630, 2026-10-07). Misma familia que las
 * portadas BlogCover: palabra en serif por vertical, personaje y titular en Manrope. */

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "ARTO Studio AI · Aprende";

const WORD: Record<Category, [string, string, string?]> = {
  branding: ["Posicionar.", "Position.", "character-02.png"],
  photography: ["Mirar.", "Look.", "character-04.png"],
  illustration: ["Trazo.", "Line.", "character-05.png"],
  fashion: ["Estilo.", "Style.", "character-01.png"],
  copywriting: ["Voz.", "Voice.", "character-03.png"],
  marketing: ["Mercado.", "Market.", "character-02.png"],
  ux_ui: ["Interfaz.", "Interface.", "character-05.png"],
  graphic_design: ["Forma.", "Form.", "character-03.png"],
  video: ["Escena.", "Scene.", "character-04.png"],
  music: ["Ritmo.", "Rhythm.", "character-02.png"],
  creative_productivity: ["Antes / después.", "Before / after.", "character-01.png"],
  architecture: ["Del boceto al plano.", "Sketch to plan.", "character-03.png"],
};

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const es = locale !== "en";
  const page = await getLearnPageBySlug(slug);
  const cat: Category = page?.category ?? "creative_productivity";
  const vert = VERTICALS[cat];
  const [wEs, wEn, charFile = "character-03.png"] = WORD[cat];
  const title = page ? (es ? page.hero_es || page.title_es : page.hero_en || page.title_en) : es ? "Guías de ARTO" : "ARTO guides";
  const [fonts, logo, char] = await Promise.all([ogFonts(), ogImage("logo-black.png"), ogImage(charFile)]);
  const [cw, ch] = CHAR_SIZES[charFile];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: OG.white }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 430, background: OG.paper, padding: 52 }}>
          <span style={{ fontFamily: "Geist", fontSize: 17, letterSpacing: 4, textTransform: "uppercase", color: OG.ink2 }}>
            {(es ? vert.label_es : vert.label_en) + " · " + vert.code}
          </span>
          <img src={char} width={230} height={Math.round((230 * ch) / cw)} alt="" />
          <span style={{ fontFamily: "Cormorant", fontStyle: "italic", fontSize: 64, lineHeight: 1, color: OG.ink }}>{es ? wEs : wEn}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={logo} width={104} height={36} alt="" />
            <span style={{ fontFamily: "Geist", fontSize: 17, letterSpacing: 4, textTransform: "uppercase", color: OG.accent }}>{es ? "Aprende" : "Learn"}</span>
          </div>
          <span style={{ fontFamily: "Manrope", fontSize: 54, lineHeight: 1.05, letterSpacing: -2, color: OG.ink }}>{clip(title, 95)}</span>
          <span style={{ fontFamily: "Geist", fontSize: 19, color: OG.ink2 }}>{SITE_HOST}/learn</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
