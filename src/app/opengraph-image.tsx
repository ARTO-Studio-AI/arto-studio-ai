import { ImageResponse } from "next/og";
import { CHAR_SIZES, OG, ogFonts, ogImage } from "@/lib/og-kit";
import { SITE_HOST } from "@/lib/site-url";

/* Imagen general para redes (1200x630, rediseno 2026-10-07): la usan todas las paginas
 * que no traen la suya. Mismo lenguaje que el hero del home: titular en Manrope con la
 * palabra en serif, los tres pasos y un personaje de ARTO. */

export const alt = "ARTO Studio AI · El estudio creativo que nunca duerme";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [fonts, logo, char] = await Promise.all([ogFonts(), ogImage("logo-black.png"), ogImage("character-01.png")]);
  const [cw, ch] = CHAR_SIZES["character-01.png"];
  const steps = ["Elige un prompt de ARTO", "Pégalo en Claude o ChatGPT", "Mídelo con el Brand Roast"];
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
            <span style={{ fontFamily: "Geist", fontSize: 18, letterSpacing: 4, textTransform: "uppercase", color: OG.ink2 }}>Creative 24/7</span>
          </div>
          <span style={{ fontFamily: "Geist", fontSize: 18, letterSpacing: 4, textTransform: "uppercase", color: OG.accent }}>Por ARTO Group · desde 2009</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 760 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", fontFamily: "Manrope", fontSize: 72, lineHeight: 1.08, letterSpacing: -3, color: OG.ink }}>
              <span>El estudio creativo que nunca&nbsp;</span>
              <span style={{ fontFamily: "Cormorant", fontStyle: "italic", fontSize: 88, letterSpacing: -1, color: OG.accent }}>duerme.</span>
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", width: 30, height: 30, borderRadius: 99, background: OG.ink, color: OG.white, alignItems: "center", justifyContent: "center", fontFamily: "Geist", fontSize: 15 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: "Inter Tight", fontSize: 19, color: OG.ink2 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <img src={char} width={240} height={Math.round((240 * ch) / cw)} alt="" />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${OG.line}`, paddingTop: 22 }}>
          <span style={{ fontFamily: "Inter Tight", fontSize: 20, color: OG.ink2 }}>3,000+ prompts bilingües · Brand Roast gratis · Skills de marca</span>
          <span style={{ fontFamily: "Geist", fontSize: 20, color: OG.ink }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
