import { askVision, parseModelJson } from "./ai";
import { CATEGORIES, type Category, type ProductIdentity } from "@shared/scan";

/**
 * Identification prompt. Kept short on purpose: output tokens are most of the
 * latency, so we ask only for what drives the search — the exact product, its
 * price-moving variant, and shop-ready queries.
 */
const IDENTIFY_PROMPT = `You identify the EXACT product in a photo so a shopper can buy it new.

Rules:
- Read every visible text first (logos, model numbers, labels, packaging, screens). Printed model numbers beat visual guesses.
- Be specific: brand + product line + model + generation, plus variant details that change the price (size, storage, colour, edition).
- Never invent. If the brand is not visible or certain, set brand null and describe the object plainly. Do not force a luxury brand onto a generic item.
- confidence: 90+ only when text/logo confirms the exact model; 60-89 when the model is likely; below 60 when only the product type is clear.
- searchQuery: the single best Google Shopping query for this exact new product (no condition words, no country words, no "price").
- altQueries: 2 broader queries, most specific first.
- mustHave: 1-4 short tokens a matching listing title must contain (e.g. "AirPods Pro", "USB-C"); lower case.
- alternatives: up to 3 other exact products it could be when confidence < 85, else [].
- regulated: true for vapes/e-cigarettes/nicotine, tobacco, alcohol, weapons/ammunition, adult products.
- estimateUSD: typical new retail price in USD as a number, or null if you cannot tell.
- category: one of ${CATEGORIES.join(", ")}.

Answer with JSON only:
{"name":"","brand":null,"model":null,"variant":null,"category":"Other","confidence":0,"searchQuery":"","altQueries":[],"mustHave":[],"alternatives":[],"regulated":false,"estimateUSD":null}`;

/** Catch age-restricted goods even if the model forgets to flag them. */
const REGULATED_RE =
  /\b(vape|vaping|e-?cig|e-?cigarette|nicotine|tobacco|cigarette|juul|elf ?bar|cigar|hookah|shisha|alcohol|whisk(e)?y|vodka|beer|wine|liquor|rak[iı]|firearm|pistol|rifle|gun|ammo|ammunition)\b/i;

function str(v: unknown, max = 160): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t || /^(null|unknown|unknown brand|n\/a|none)$/i.test(t)) return null;
  return t.slice(0, max);
}

function strList(v: unknown, limit: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, 120);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function toCategory(v: unknown): Category {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return CATEGORIES.find((c) => c.toLowerCase() === s) ?? "Other";
}

/** Turn the model's loose JSON into a safe, complete identity. */
export function normalizeIdentity(
  raw: unknown,
  barcode: string | null,
): ProductIdentity {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const brand = str(r.brand, 60);
  const model = str(r.model, 80);
  const name =
    str(r.name, 140) ??
    ([brand, model].filter(Boolean).join(" ") || "Unidentified item");
  const searchQuery = str(r.searchQuery, 140) ?? name;
  const confidenceRaw =
    typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : 50;
  const estimate =
    typeof r.estimateUSD === "number" ? r.estimateUSD : Number(r.estimateUSD);

  const identity: ProductIdentity = {
    name,
    brand,
    model,
    variant: str(r.variant, 120),
    category: toCategory(r.category),
    confidence,
    searchQuery,
    altQueries: strList(r.altQueries, 3).filter(
      (q) => q.toLowerCase() !== searchQuery.toLowerCase(),
    ),
    mustHave: strList(r.mustHave, 4).map((t) => t.toLowerCase()),
    alternatives: strList(r.alternatives, 3),
    regulated: r.regulated === true,
    barcode,
    estimateUSD:
      Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null,
  };

  if (
    REGULATED_RE.test(identity.name) ||
    REGULATED_RE.test(identity.brand ?? "") ||
    REGULATED_RE.test(identity.searchQuery)
  ) {
    identity.regulated = true;
  }
  return identity;
}

/** Identify the product in one image. */
export async function identifyProduct(
  mimeType: string,
  base64: string,
  opts: { barcode?: string | null; hint?: string | null } = {},
): Promise<{ identity: ProductIdentity; model: string; provider: string }> {
  const extra: string[] = [];
  if (opts.barcode) {
    extra.push(
      `A barcode was scanned on this item: ${opts.barcode}. Use it to pin down the exact product.`,
    );
  }
  if (opts.hint) {
    extra.push(
      `The user says this item is: "${opts.hint.slice(0, 140)}". Trust it unless the photo clearly contradicts it.`,
    );
  }
  const prompt = extra.length
    ? `${IDENTIFY_PROMPT}\n\n${extra.join("\n")}`
    : IDENTIFY_PROMPT;

  const result = await askVision(mimeType, base64, prompt);
  const identity = normalizeIdentity(
    parseModelJson(result.text),
    opts.barcode ?? null,
  );
  return { identity, model: result.model, provider: result.provider };
}
