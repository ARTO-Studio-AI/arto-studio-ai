import Parser from "rss-parser";

const parser = new Parser({ timeout: 20000, headers: { "User-Agent": "arto-scraper/0.1 (+https://artostudio.ai)" } });

/* Google News RSS search adapter. `source.url` holds the query string;
 * `source.config.hl` / `gl` / `ceid` tune locale. Google News exposes a
 * public RSS search endpoint, no scraping of the HTML site needed. */
export async function fetchGoogleNews(source) {
  const cfg = source.config || {};
  const hl = cfg.hl || "en-US";
  const gl = cfg.gl || (hl.split("-")[1] || "US");
  const ceid = cfg.ceid || `${gl}:${hl.split("-")[0]}`;
  const q = encodeURIComponent(source.url || "");
  const feedUrl = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const feed = await parser.parseURL(feedUrl);
  const items = feed.items || [];
  return items.slice(0, 25).map((it) => ({
    title: it.title || "",
    url: it.link || "",
    snippet: it.contentSnippet || it.content || "",
    source_name: source.name,
    source_type: "google_news",
  }));
}
