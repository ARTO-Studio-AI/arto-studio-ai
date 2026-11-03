import * as cheerio from "cheerio";

/* Competitor HTML adapter. Fetches a public page (e.g. a studio's work /
 * clients page), extracts candidate links + their anchor text as company
 * leads. Honors a CSS selector from source.config.selector (default "a").
 * Respects a simple User-Agent; only runs for sources the operator has
 * explicitly enabled + pointed at a real URL. */
export async function fetchCompetitorHtml(source) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "arto-scraper/0.1 (+https://artostudio.ai)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const selector = (source.config && source.config.selector) || "a";
  const seen = new Set();
  const out = [];
  $(selector).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") || "";
    if (!text || text.length < 2 || text.length > 80) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      title: text,
      url: href.startsWith("http") ? href : new URL(href || "/", source.url).toString(),
      snippet: `Listed on ${source.name} (competitor page)`,
      source_name: source.name,
      source_type: "competitor_html",
    });
  });
  return out.slice(0, 40);
}
