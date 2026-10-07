import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { CHAR_SIZES, OG, clip, ogFonts, ogImage, scoreColor } from "@/lib/og-kit";
import { readShareParams } from "@/lib/roast-share";
import { SITE_HOST } from "@/lib/site-url";

/* Imagen del Brand Roast para redes (rediseno 2026-10-07, pedido de Victor: "mucho mas
 * llamativo" y que invite a hacer el tuyo). Tres formatos:
 *   default 1200x630  vista previa de los enlaces (X, LinkedIn, WhatsApp)
 *   square  1080x1080 feed de Instagram
 *   story   1080x1920 historias
 * La frase del roast solo aparece si el enlace trae firma valida (ver roast-share.ts). */

export const runtime = "nodejs";

type Format = "default" | "square" | "story";

const COPY = {
  es: {
    eyebrow: "Brand Roast",
    scoreFor: "ARTO Score",
    pillars: ["Estrategia", "Creatividad", "Narrativa", "Digital"],
    ctaTitle: "¿Y tu marca?",
    ctaBody: "Roastéala gratis en 20 segundos",
  },
  en: {
    eyebrow: "Brand Roast",
    scoreFor: "ARTO Score",
    pillars: ["Strategy", "Creativity", "Narrative", "Digital"],
    ctaTitle: "What about your brand?",
    ctaBody: "Roast it free in 20 seconds",
  },
} as const;

const SIZES: Record<Format, { width: number; height: number }> = {
  default: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format: Format = sp.get("format") === "square" ? "square" : sp.get("format") === "story" ? "story" : "default";
  const share = readShareParams((k) => sp.get(k)) ?? {
    brand: "Tu marca",
    score: "6.4",
    s: "7",
    c: "6",
    n: "6",
    d: "6",
    h: "",
    lang: "es",
    verified: false,
  };
  const t = COPY[share.lang === "en" ? "en" : "es"];
  const score = Number(share.score);
  const color = scoreColor(score);
  const pillars = [share.s, share.c, share.n, share.d].map(Number);
  const size = SIZES[format];

  const [fonts, logo, char] = await Promise.all([ogFonts(), ogImage("logo-black.png"), ogImage("character-03.png")]);
  const [cw, chh] = CHAR_SIZES["character-03.png"];

  const story = format === "story";
  const wide = format === "default";
  const pad = wide ? 56 : 72;
  const brandSize = wide ? 64 : story ? 104 : 76;
  const scoreSize = wide ? 230 : story ? 420 : 250;
  const headlineSize = wide ? 34 : story ? 58 : 38;
  const headline = share.h ? clip(share.h, wide ? 110 : story ? 150 : 120) : "";

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={wide ? 104 : 132} height={wide ? 36 : 46} alt="" />
        <span style={{ fontFamily: "Geist", fontSize: wide ? 18 : 22, letterSpacing: 4, textTransform: "uppercase", color: OG.accent }}>
          {t.eyebrow}
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={char} width={wide ? 120 : 170} height={wide ? Math.round((120 * chh) / cw) : Math.round((170 * chh) / cw)} alt="" />
    </div>
  );

  const scoreBlock = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontFamily: "Geist", fontSize: wide ? 18 : 24, letterSpacing: 4, textTransform: "uppercase", color: OG.ink2 }}>
        {t.scoreFor}
      </span>
      <span style={{ fontFamily: "Manrope", fontSize: brandSize, lineHeight: 1, letterSpacing: -2, color: OG.ink, marginTop: 10 }}>
        {clip(share.brand, story ? 26 : 22)}
      </span>
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: wide ? 4 : 10 }}>
        <span style={{ fontFamily: "Manrope", fontSize: scoreSize, lineHeight: 0.86, letterSpacing: -12, color }}>
          {share.score}
        </span>
        <span style={{ fontFamily: "Geist", fontSize: wide ? 34 : 48, color: OG.ink3, marginLeft: 12, marginBottom: wide ? 22 : 38 }}>/10</span>
      </div>
    </div>
  );

  const quote = headline ? (
    <div style={{ display: "flex", flexShrink: 0, fontFamily: "Cormorant", fontStyle: "italic", fontSize: headlineSize, lineHeight: 1.12, color: OG.ink }}>
      “{headline}”
    </div>
  ) : null;

  const bars = (
    <div style={{ display: "flex", flexDirection: story ? "column" : "row", gap: story ? 30 : 20, width: "100%", flexShrink: 0 }}>
      {t.pillars.map((label, i) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8, ...(story ? { width: "100%" } : { flex: 1 }) }}>
          <span style={{ fontFamily: "Geist", fontSize: wide ? 13 : story ? 24 : 16, letterSpacing: 2.5, textTransform: "uppercase", color: OG.ink2 }}>
            {label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flex: 1, height: wide ? 8 : 12, borderRadius: 99, background: "#e4e0d8" }}>
              <div style={{ display: "flex", width: `${Math.max(4, pillars[i] * 10)}%`, height: "100%", borderRadius: 99, background: scoreColor(pillars[i]) }} />
            </div>
            <span style={{ fontFamily: "Manrope", fontSize: wide ? 24 : story ? 44 : 30, color: OG.ink, lineHeight: 1 }}>{pillars[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const cta = (
    <div
      style={{
        display: "flex",
        flexDirection: story ? "column" : "row",
        alignItems: story ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: story ? 22 : 16,
        background: OG.ink,
        color: OG.white,
        borderRadius: wide ? 18 : 26,
        padding: wide ? "20px 28px" : story ? "40px 44px" : "30px 36px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "Manrope", fontSize: wide ? 30 : story ? 54 : 44, letterSpacing: -1 }}>{t.ctaTitle}</span>
        <span style={{ fontFamily: "Inter Tight", fontSize: wide ? 18 : story ? 30 : 24, color: "#d4d4d8" }}>{t.ctaBody}</span>
      </div>
      <span style={{ fontFamily: "Geist", fontSize: wide ? 18 : story ? 28 : 22, color: OG.accent, letterSpacing: 1 }}>{SITE_HOST}/roast →</span>
    </div>
  );

  const body = wide ? (
    <div style={{ display: "flex", flex: 1, gap: 48, marginTop: 18 }}>
      <div style={{ display: "flex", width: 470 }}>{scoreBlock}</div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 28 }}>
        {quote}
        {bars}
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: story ? 56 : 26 }}>
      {scoreBlock}
      {quote}
      {bars}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.paper,
          backgroundImage: "radial-gradient(rgba(24,24,27,0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          padding: pad,
          gap: wide ? 18 : 30,
        }}
      >
        {header}
        {body}
        {cta}
      </div>
    ),
    { ...size, fonts },
  );
}
