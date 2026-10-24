import Parser from "rss-parser";

const parser = new Parser({ timeout: 20000, headers: { "User-Agent": "arto-scraper/0.1 (+https://artostudio.ai)" } });

/* RSS / Atom feed adapter. Returns raw candidate items. */
export async function fetchRss(source) {
  const feed = await parser.parseURL(source.url);
  const items = feed.items || [];
  return items.slice(0, 25).map((it) => ({
    title: it.title || "",
    url: it.link || "",
    snippet: it.contentSnippet || it.content || it.summary || "",
    source_name: source.name,
    source_type: "rss",
  }));
}
