import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/* Global Open Graph image (1200x630), generated at build time with next/og.
 * Dark, typographic, Archivo. Applies to every route that does not ship its
 * own file-based image (prompts/[id] and /roast keep theirs).
 *
 * Archivo (OFL, see src/app/_fonts/OFL.txt) is embedded from the repo so the
 * build never depends on Google Fonts being reachable. Satori needs at least
 * one TTF/OTF/WOFF font to lay out text; system fonts are not available.
 */

export const alt = "ARTO Studio AI · The creative studio that never sleeps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "src", "app", "_fonts");

async function loadFont(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(FONT_DIR, file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export default async function Image() {
  const [regular, bold] = await Promise.all([
    loadFont("Archivo-Regular.ttf"),
    loadFont("Archivo-Bold.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "Archivo",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, letterSpacing: 4, color: "#a3a3a3" }}>
          <div style={{ width: 14, height: 14, background: "#fafafa", borderRadius: 999 }} />
          ARTO STUDIO AI
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
            The creative studio
          </div>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, color: "#737373" }}>
            that never sleeps.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, color: "#a3a3a3" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <span>3,000 prompts</span>
            <span style={{ color: "#525252" }}>·</span>
            <span>Skills Studio</span>
            <span style={{ color: "#525252" }}>·</span>
            <span>AI Agents</span>
          </div>
          <div style={{ color: "#737373" }}>creative.artostudio.ai</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: regular, weight: 400, style: "normal" },
        { name: "Archivo", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
