/* Dedup helpers. We dedup discovered prospects against existing
 * outreach_targets by (a) normalized company name and (b) registrable
 * domain pulled from profile_url / email / metadata. Cheap + good enough;
 * the operator is the final filter in /admin/outreach. */

const LEGAL_SUFFIXES = /\b(inc|llc|ltd|ltda|sa|s a|sa de cv|sapi|gmbh|co|corp|company|studio|agency|group|holdings|sl|srl)\b/g;

export function normalizeCompany(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function domainOf(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function domainFromEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  return email.split("@")[1].trim().toLowerCase();
}

export function buildExistingIndex(rows) {
  const companies = new Set();
  const domains = new Set();
  for (const r of rows) {
    const c = normalizeCompany(r.company);
    if (c) companies.add(c);
    const ed = domainFromEmail(r.email);
    if (ed) domains.add(ed);
    const pd = domainOf(r.profile_url);
    if (pd) domains.add(pd);
    const md = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
    if (typeof md.domain === "string") domains.add(md.domain.toLowerCase());
  }
  return { companies, domains };
}

export function isDuplicate(index, { company, domain }) {
  const c = normalizeCompany(company);
  if (c && index.companies.has(c)) return true;
  if (domain && index.domains.has(domain)) return true;
  return false;
}
