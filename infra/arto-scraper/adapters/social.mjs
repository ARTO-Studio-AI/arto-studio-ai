/* Social adapter (LinkedIn / X).
 *
 * DISABLED BY DESIGN. Raw scraping of LinkedIn/X violates their Terms of
 * Service and risks an IP ban on this Mac Mini (which also runs the image
 * service). This adapter only operates through an OFFICIAL, paid API key.
 *
 * To enable: set the source row enabled=true AND put an official API key in
 * scraping_sources.config.apiKey, then implement the provider call below.
 * Until then it throws, which the orchestrator records as a scrape_blocked
 * signal and skips. */
export async function fetchSocial(source) {
  const cfg = source.config || {};
  if (!cfg.apiKey) {
    throw new Error(
      `social adapter disabled for "${source.name}": no official API key in config.apiKey (raw LinkedIn/X scraping violates ToS)`,
    );
  }
  // Official-API implementation goes here once a key exists.
  throw new Error(`social adapter for provider "${cfg.provider}" not implemented yet (API key present but no client)`);
}
