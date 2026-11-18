import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiniMarkdown, parseBlocks } from "./mini-markdown";
import { getModPage } from "./mod-pages";

describe("mini-markdown", () => {
  it("arma bloques y escapa el HTML que no reconoce", () => {
    const md = "# Titulo\n\n| A | B |\n| --- | --- |\n| x | <code>y</code> |\n\n- uno <b>dos</b>\n- [ok](https://a.b) [malo](javascript:alert(1))\n\n```txt\n<script>1</script>\n```\n\n<img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(createElement(MiniMarkdown, { blocks: parseBlocks(md) }));
    expect(html).toContain("<h1");
    expect(html).toContain("<table");
    expect(html).toContain("<strong>dos</strong>");
    expect(html).toContain('href="https://a.b"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("paginas de mods", () => {
  it("auto-handoff tiene pagina en es y en, sin em dashes", () => {
    for (const locale of ["es", "en"] as const) {
      const p = getModPage("auto-handoff", locale)!;
      expect(p.title).toMatch(/^auto-handoff/);
      expect(p.summary.length).toBeGreaterThan(40);
      expect(JSON.stringify(p.blocks)).not.toMatch(/[—–]/);
      expect(p.blocks.some((b) => b.type === "code")).toBe(true);
    }
    expect(getModPage("../etc", "es")).toBeNull();
    expect(getModPage("no-existe", "es")).toBeNull();
  });

  it("pinta <i> como cursiva y no enlaza rutas con barra invertida", () => {
    const md = "Un <i>aviso</i> y [raro](/\\\\evil.com) y [bien](/es/pricing)";
    const html = renderToStaticMarkup(createElement(MiniMarkdown, { blocks: parseBlocks(md) }));
    expect(html).toContain("<em>aviso</em>");
    expect(html).not.toContain("&lt;i&gt;");
    expect(html).not.toContain("evil.com\"");
    expect(html).toContain('href="/es/pricing"');
  });
});
