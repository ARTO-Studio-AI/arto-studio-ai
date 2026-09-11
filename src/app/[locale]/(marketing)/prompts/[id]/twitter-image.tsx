import { SITE_HOST } from "@/lib/site-url";
import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { VERTICALS } from "@/types/prompt";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "ARTO · Prompt Library";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, title_en, category, difficulty, tier, ai_model")
    .eq("id", id)
    .maybeSingle();

  if (!prompt) {
    return new ImageResponse(
      (
        <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#fff", fontSize: 48, fontFamily: "system-ui" }}>
          Prompt not found
        </div>
      ),
      { ...size },
    );
  }

  const catLabel = VERTICALS[prompt.category as keyof typeof VERTICALS]?.label_en ?? prompt.category;
  const tierLabel = prompt.tier === "free" ? "Free" : prompt.tier === "pro" ? "Pro" : "Enterprise";
  const tierBg = prompt.tier === "free" ? "#10b981" : prompt.tier === "pro" ? "#737373" : "#0a0a0a";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
          color: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, color: "#737373", letterSpacing: 1 }}>
            <div style={{ width: 12, height: 12, background: "#0a0a0a", borderRadius: 999 }} />
            ARTO · PROMPT LIBRARY
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: tierBg, color: prompt.tier === "free" ? "#064e3b" : "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 18, fontWeight: 600 }}>
              {tierLabel}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 18, fontFamily: "monospace", color: "#737373", letterSpacing: 1 }}>
            {prompt.id}
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1, color: "#0a0a0a", maxHeight: 280, overflow: "hidden" }}>
            {prompt.title_en}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ background: "#e5e5e5", borderRadius: 999, padding: "10px 18px", fontSize: 18, color: "#525252", fontWeight: 600 }}>
            {catLabel}
          </div>
          <div style={{ background: "#e5e5e5", borderRadius: 999, padding: "10px 18px", fontSize: 18, color: "#525252" }}>
            {String(prompt.difficulty).charAt(0).toUpperCase() + String(prompt.difficulty).slice(1)}
          </div>
          <div style={{ background: "#e5e5e5", borderRadius: 999, padding: "10px 18px", fontSize: 18, color: "#525252", fontFamily: "monospace" }}>
            {prompt.ai_model}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 18, color: "#a3a3a3" }}>
            {SITE_HOST}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
