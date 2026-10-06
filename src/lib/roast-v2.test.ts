import { describe, expect, it } from "vitest";
import { extractSnapshot, isBlockedIp, normalizeUrl } from "@/lib/site-snapshot";
import { validateRoastOutput } from "@/lib/roast-runner";

describe("site-snapshot: guardas de red", () => {
  it("bloquea IPs internas, de metadatos y mapeadas", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2002:7f00:1::", "no-es-ip",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("deja pasar IPs publicas", () => {
    for (const ip of ["8.8.8.8", "151.101.1.69", "172.32.0.1", "2606:4700::6810:85e5"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("normaliza y rechaza URLs peligrosas", () => {
    expect(normalizeUrl("marca.com")?.toString()).toBe("https://marca.com/");
    expect(normalizeUrl("http://www.marca.mx/es")?.hostname).toBe("www.marca.mx");
    for (const bad of [
      "ftp://marca.com", "file:///etc/passwd", "http://localhost", "http://127.0.0.1",
      "http://2130706433", "http://[::1]/", "http://user:pass@marca.com", "http://marca.com:8080",
      "http://intranet", "http://api.internal", "http://169.254.169.254/latest/meta-data", "",
    ]) {
      expect(normalizeUrl(bad), bad).toBeNull();
    }
  });
});

describe("site-snapshot: extraccion", () => {
  it("saca titulo, meta, headings, CTAs, redes y senales; ignora scripts", () => {
    const html = `<!doctype html><html lang="es"><head><title>Panadería &amp; Café</title>
      <meta name="description" content="Pan de verdad desde 1987">
      <meta property="og:title" content="La Espiga">
      <meta name="viewport" content="width=device-width"><script>var secreto = "no";</script></head>
      <body><h1>Pan que sabe a casa</h1><h2>Nuestras sucursales</h2><button>Pide ahora</button>
      <a href="https://instagram.com/laespiga">IG</a><img src="a.jpg"><img src="b.jpg" alt="pan">
      <p>Horneamos todos los días.</p></body></html>`;
    const s = extractSnapshot(html, "https://laespiga.mx/");
    expect(s.title).toBe("Panadería & Café");
    expect(s.metaDescription).toBe("Pan de verdad desde 1987");
    expect(s.ogTitle).toBe("La Espiga");
    expect(s.htmlLang).toBe("es");
    expect(s.headings).toContain("H1: Pan que sabe a casa");
    expect(s.ctas).toContain("Pide ahora");
    expect(s.socialLinks[0]).toContain("instagram.com/laespiga");
    expect(s.signals.join(" ")).toContain("2 <img> tags, 1 without alt text");
    expect(s.bodyText).toContain("Horneamos todos los días.");
    expect(s.bodyText).not.toContain("secreto");
  });
});

describe("roast-runner: validacion de salida", () => {
  const base = {
    headline: "Mucho pan, cero migajón",
    strategy: { score: 7, roast: "a" },
    creativity: { score: 6.6, roast: "b" },
    narrative: { score: 15, roast: "c" },
    digital: { score: 0, roast: "d" },
    verdict: '"Veredicto entre comillas"',
    improvements: ["- uno", "dos", "", "tres"],
    evidence: ["Meta: \"Líder global\""],
  };

  it("acota scores, limpia texto y calcula el overall", () => {
    const out = validateRoastOutput(base, "es");
    expect([out.strategy.score, out.creativity.score, out.narrative.score, out.digital.score]).toEqual([7, 7, 10, 1]);
    expect(out.verdict).toBe("Veredicto entre comillas");
    expect(out.improvements).toEqual(["uno", "dos", "tres"]);
    expect(out.evidence).toEqual(['Meta: "Líder global"']);
    expect(out.overall).toBe(6.6);
    expect(out.lang).toBe("es");
  });

  it("lanza si falta un pilar o el score no es numero", () => {
    expect(() => validateRoastOutput({ ...base, narrative: { roast: "sin score" } }, "es")).toThrow();
    expect(() => validateRoastOutput({ ...base, digital: undefined }, "es")).toThrow();
    expect(() => validateRoastOutput({ ...base, improvements: ["solo una"] }, "es")).toThrow();
  });
});

describe("site-snapshot: IPv4 compatible (auditoria)", () => {
  it("bloquea ::7f00:1 y ::a9fe:a9fe", () => {
    expect(isBlockedIp("::7f00:1")).toBe(true);
    expect(isBlockedIp("::a9fe:a9fe")).toBe(true);
    expect(normalizeUrl("http://[::7f00:1]/")).toBeNull();
  });
});
