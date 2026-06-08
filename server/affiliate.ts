/**
 * Affiliate link tagging — zero extra AI cost monetization.
 *
 * When affiliate IDs are configured via env, we append the right tracking
 * parameter to outgoing store links for known networks. Unconfigured networks
 * pass through untouched, so this is safe to ship before any partnership is
 * signed. Real ids: AMAZON_AFFILIATE_TAG, ADMITAD_ID, plus a generic
 * AFFILIATE_TAGS JSON map of "domainSubstring" -> "param=value".
 */

interface Rule {
  match: (host: string) => boolean;
  param: string;
  value: () => string | undefined;
}

const RULES: Rule[] = [
  {
    match: (h) => h.includes("amazon."),
    param: "tag",
    value: () => process.env.AMAZON_AFFILIATE_TAG,
  },
];

/** Extra rules from env: AFFILIATE_TAGS='{"trendyol.com":"utm_source=scope"}'. */
function envRules(): { sub: string; param: string; value: string }[] {
  try {
    const raw = process.env.AFFILIATE_TAGS;
    if (!raw) return [];
    const obj = JSON.parse(raw) as Record<string, string>;
    return Object.entries(obj).map(([sub, pv]) => {
      const eq = pv.indexOf("=");
      return { sub, param: pv.slice(0, eq), value: pv.slice(eq + 1) };
    });
  } catch {
    return [];
  }
}

/**
 * Returns the url with an affiliate parameter appended when one is configured
 * for its domain; otherwise the url unchanged. Never throws.
 */
export function affiliateUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    for (const rule of RULES) {
      const v = rule.value();
      if (v && rule.match(host) && !u.searchParams.has(rule.param)) {
        u.searchParams.set(rule.param, v);
      }
    }
    for (const r of envRules()) {
      if (host.includes(r.sub) && r.value && !u.searchParams.has(r.param)) {
        u.searchParams.set(r.param, r.value);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Whether any affiliate id is configured (used to disclose "#ad" in the UI). */
export function affiliateEnabled(): boolean {
  return Boolean(process.env.AMAZON_AFFILIATE_TAG || process.env.AFFILIATE_TAGS);
}
