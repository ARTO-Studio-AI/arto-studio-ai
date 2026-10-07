import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAR_SIZES, OG, clip, ogFonts, ogImage } from "@/lib/og-kit";
import { SITE_HOST } from "@/lib/site-url";
import { VERTICALS, type Category } from "@/types/prompt";

/* Imagen para redes de cada prompt (1200x630, rediseno 2026-10-07). En el idioma de la
 * ruta, con la vertical, el plan y un personaje de ARTO. Nunca lleva el cuerpo del prompt. */

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "ARTO Studio AI · Biblioteca de prompts";

const CHAR_BY_CAT: Partial<Record<Category, string>> = {
  branding: "character-02.png",
  photography: "character-04.png",
  illustration: "character-05.png",
  fashion: "character-01.png",
  ux_ui: "character-05.png",
  graphic_design: "character-03.png",
  video: "character-04.png",
};

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const es = locale !== "en";
  const admin = createAdminClient();
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, title_en, title_es, category, tier")
    .eq("id", id)
    .maybeSingle();

  const cat = (prompt?.category as Category) ?? "creative_productivity";
  const vert = VERTICALS[cat] ?? VERTICALS.creative_productivity;
  const title = prompt ? (es ? prompt.title_es : prompt.title_en) || prompt.title_en : es ? "Biblioteca de prompts de ARTO" : "ARTO prompt library";
  const tier = prompt?.tier === "free" ? "Free" : prompt?.tier === "pro" ? "Pro" : prompt ? "Enterprise" : "";
  const charFile = CHAR_BY_CAT[cat] ?? "character-03.png";
  const [fonts, logo, char] = await Promise.all([ogFonts(), ogImage("logo-black.png"), ogImage(charFile)]);
  const [cw, ch] = CHAR_SIZES[charFile];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG.paper,
          backgroundImage: "radial-gradient(rgba(24,24,27,0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={logo} width={116} height={40} alt="" />
            <span style={{ fontFamily: "Geist", fontSize: 18, letterSpacing: 4, textTransform: "uppercase", color: OG.accent }}>
              {es ? "Biblioteca de prompts" : "Prompt library"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "Geist", fontSize: 20, letterSpacing: 3, color: OG.ink2 }}>{prompt?.id ?? ""}</span>
            {tier && (
              <span style={{ display: "flex", fontFamily: "Geist", fontSize: 16, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 99, background: tier === "Free" ? "#fff1ea" : OG.ink, color: tier === "Free" ? "#b33600" : OG.white }}>
                {tier}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 800 }}>
            <span style={{ fontFamily: "Geist", fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: OG.ink2 }}>
              {(es ? vert.label_es : vert.label_en) + " · " + vert.code}
            </span>
            <span style={{ fontFamily: "Manrope", fontSize: 60, lineHeight: 1.04, letterSpacing: -2, color: OG.ink }}>{clip(title, 90)}</span>
          </div>
          <img src={char} width={210} height={Math.round((210 * ch) / cw)} alt="" />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: OG.ink, borderRadius: 18, padding: "20px 28px" }}>
          <span style={{ fontFamily: "Manrope", fontSize: 28, color: OG.white, letterSpacing: -0.5 }}>
            {es ? "Ábrelo gratis con tu cuenta" : "Open it free with your account"}
          </span>
          <span style={{ fontFamily: "Geist", fontSize: 20, color: OG.accent }}>{SITE_HOST}/prompts →</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
