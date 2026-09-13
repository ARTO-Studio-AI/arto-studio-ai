import { SITE_HOST } from "@/lib/site-url";
import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

type Format = "default" | "square" | "story";

function getDimensions(format: Format) {
  if (format === "square") return { width: 1080, height: 1080 };
  if (format === "story") return { width: 1080, height: 1920 };
  return { width: 1200, height: 630 };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const brand = searchParams.get("brand") || "Your Brand";
  const score = searchParams.get("score") || "0";
  const strategy = searchParams.get("s") || "0";
  const creativity = searchParams.get("c") || "0";
  const narrative = searchParams.get("n") || "0";
  const digital = searchParams.get("d") || "0";
  const format = (searchParams.get("format") || "default") as Format;

  const { width, height } = getDimensions(format);
  const scoreNum = parseFloat(score);
  const scoreColor =
    scoreNum >= 7 ? "#10b981" : scoreNum >= 5 ? "#f59e0b" : "#ef4444";

  const isVertical = format === "story";
  const isSquare = format === "square";

  const pillars = [
    { label: "Strategy", value: strategy },
    { label: "Creativity", value: creativity },
    { label: "Narrative", value: narrative },
    { label: "Digital", value: digital },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          padding: isVertical ? "80px 60px" : "60px",
          justifyContent: isVertical ? "space-between" : "flex-start",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: isVertical ? "22px" : "18px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#a1a1aa",
            }}
          >
            ARTO Creative 24/7
          </span>
          <span style={{ fontSize: "18px", color: "#52525b" }}>×</span>
          <span style={{ fontSize: isVertical ? "18px" : "15px", color: "#71717a" }}>
            Brand Roast
          </span>
        </div>

        {/* Brand + Score */}
        <div
          style={{
            display: "flex",
            ...(isVertical ? {} : { flex: 1 }),
            flexDirection: isVertical || isSquare ? "column" : "row",
            alignItems: isVertical || isSquare ? "flex-start" : "center",
            justifyContent: isVertical || isSquare ? "center" : "space-between",
            gap: isVertical ? "24px" : isSquare ? "16px" : "0",
            marginTop: isVertical ? "60px" : "40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#71717a",
              }}
            >
              ARTO Score for
            </span>
            <span
              style={{
                fontSize: isVertical ? "72px" : isSquare ? "56px" : "60px",
                fontWeight: 800,
                lineHeight: 1.05,
                marginTop: "8px",
                maxWidth: isVertical ? "900px" : isSquare ? "900px" : "560px",
              }}
            >
              {brand}
            </span>
            <span style={{ fontSize: "18px", color: "#71717a", marginTop: "12px" }}>
              got roasted.
            </span>
          </div>

          {/* Big score number */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isVertical || isSquare ? "flex-start" : "center",
            }}
          >
            <span
              style={{
                fontSize: isVertical ? "200px" : isSquare ? "160px" : "120px",
                fontWeight: 800,
                color: scoreColor,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontSize: isVertical ? "28px" : "22px",
                fontWeight: 700,
                color: "#52525b",
                marginTop: isVertical ? "-12px" : "0",
              }}
            >
              / 10
            </span>
          </div>
        </div>

        {/* Pillar scores */}
        <div
          style={{
            display: "flex",
            flexDirection: isVertical ? "column" : "row",
            gap: isVertical ? "20px" : "40px",
            borderTop: "1px solid #27272a",
            paddingTop: isVertical ? "40px" : "28px",
            marginTop: isVertical ? "40px" : "0",
          }}
        >
          {pillars.map((pillar) => (
            <div
              key={pillar.label}
              style={{
                display: "flex",
                flexDirection: isVertical ? "row" : "column",
                alignItems: isVertical ? "center" : "flex-start",
                justifyContent: isVertical ? "space-between" : "flex-start",
                gap: isVertical ? "0" : "4px",
                ...(isVertical ? {} : { flex: 1 }),
              }}
            >
              <span
                style={{
                  fontSize: isVertical ? "18px" : "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: "#71717a",
                }}
              >
                {pillar.label}
              </span>
              <span
                style={{
                  fontSize: isVertical ? "40px" : "30px",
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {pillar.value}/10
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: isVertical ? "40px" : "24px",
            borderTop: "1px solid #27272a",
            paddingTop: isVertical ? "32px" : "18px",
          }}
        >
          <span style={{ fontSize: isVertical ? "18px" : "13px", color: "#52525b" }}>
            {SITE_HOST}/roast
          </span>
          <span style={{ fontSize: isVertical ? "18px" : "13px", color: "#52525b" }}>
            Free · Instant · No signup
          </span>
        </div>
      </div>
    ),
    { width, height }
  );
}
