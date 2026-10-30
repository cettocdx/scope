import { lookupBarcode } from "./barcode";
import { askVision, parseModelJson } from "./ai";
import {
  CATEGORIES,
  type Category,
  type IdentityKind,
  type ProductIdentity,
} from "@shared/scan";

/**
 * Identification prompt. Kept short on purpose: output tokens are most of the
 * latency, so we ask only for what drives the search — the exact product, its
 * price-moving variant, and shop-ready queries.
 */
const IDENTIFY_PROMPT = `You identify what is in a photo so a shopper can buy it new. It can be ANY object: electronics, clothing, shoes, bags, cosmetics, food packaging, toys, tools, furniture, home goods, car parts, books, plants, anything.

Pick the main subject (centred / largest / in focus). Describe only that one in the fields below; put up to 4 other buyable things you also see in "others" as short name strings.

Rules:
- Read every visible text first: logos, brand names, model numbers, labels, tags, packaging, prints, screens — in any language. Printed text beats visual guesses.
- Be specific: brand + product line + model/generation + the details that change the price (size, storage, colour, material, edition).
- Clothing, shoes and bags: name the exact item when you can — brand, line/collection, garment type, colour, and the logo/graphic/print (e.g. "Nike Sportswear Club Fleece Hoodie, Grey, small chest swoosh"). Put the colour and print in variant.
- Jewellery and watches: look for engravings, hallmarks and signature motifs (e.g. Cartier Love screws, Van Cleef Alhambra clover, Tiffany T, Rolex crown). Never claim a precious material you cannot see confirmed: say "clear stone" not "diamond", "gold-tone"/"silver-tone" unless a stamp or the brand settles it.
- Luxury bags: read the monogram/pattern, hardware and shape to name the line and size (e.g. "Louis Vuitton Neverfull MM Monogram").
- Generic or unbranded things: set brand null and describe them the way a shop lists them (e.g. "White ceramic coffee mug 350 ml"). Never force a brand that is not visible.
- People: never say who a person is. If a person is in the photo, identify what they wear or hold instead.
- kind: "product" for a specific branded product or model; "generic" for a buyable thing without an identifiable brand/model; "not_for_sale" for things you cannot buy new in a shop (animals, people, landscapes, buildings, served food, one-off artworks).
- confidence: for "product", 90+ only when text/logo confirms the exact item, 60-89 when likely, below 60 when only the type is clear. For "generic" and "not_for_sale", how sure you are about what the thing is.
- searchQuery: the single best Google Shopping query for this exact new item (no condition, country or "price" words). For not_for_sale, "".
- altQueries: 2 broader queries, most specific first.
- mustHave: 1-4 short lower-case tokens a matching listing title must contain (brand/model words, not colours).
- alternatives: up to 3 other exact products it could be when confidence < 85, else [].
- regulated: true for vapes/e-cigarettes/nicotine, tobacco, alcohol, weapons/ammunition, adult products.
- estimateUSD: typical new retail price in USD as a number, or null.
- category: one of ${CATEGORIES.join(", ")}.

Answer with ONE flat JSON object only (no nesting, "others" is an array of strings):
{"kind":"product","name":"","brand":null,"model":null,"variant":null,"category":"Other","confidence":0,"searchQuery":"","altQueries":[],"mustHave":[],"alternatives":[],"others":[],"regulated":false,"estimateUSD":null}`;

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
  let r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  // Some models nest the answer as { main: {...}, others: [...] }.
  if (r.main && typeof r.main === "object" && !r.name) {
    r = { ...(r.main as Record<string, unknown>), others: r.others };
  }
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

  const kind: IdentityKind =
    r.kind === "generic" || r.kind === "not_for_sale" ? r.kind : "product";

  const identity: ProductIdentity = {
    kind,
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
    others: strList(
      Array.isArray(r.others)
        ? r.others.map((o) =>
            o && typeof o === "object" ? (o as { name?: unknown }).name : o,
          )
        : [],
      4,
    ),
    regulated: r.regulated === true,
    barcode,
    estimateUSD:
      Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null,
  };

  // Nothing to shop for: never suggest buying the animal / person / place.
  if (kind === "not_for_sale") {
    identity.searchQuery = "";
    identity.altQueries = [];
  }

  if (
    REGULATED_RE.test(identity.name) ||
    REGULATED_RE.test(identity.brand ?? "") ||
    REGULATED_RE.test(identity.searchQuery)
  ) {
    identity.regulated = true;
  }
  return identity;
}

/** Below this, a stronger model takes a second look. */
const SECOND_LOOK_BELOW = 70;

/**
 * Identify what is in one image. The fast model answers first; when it is not
 * sure (and the thing is buyable), a stronger model looks again and the more
 * confident answer wins. Hard cases cost a few seconds more, easy ones nothing.
 */
export async function identifyProduct(
  mimeType: string,
  base64: string,
  opts: { barcode?: string | null; hint?: string | null } = {},
): Promise<{
  identity: ProductIdentity;
  model: string;
  provider: string;
  secondLook: boolean;
}> {
  const extra: string[] = [];
  if (opts.barcode) {
    const known = await lookupBarcode(opts.barcode);
    extra.push(
      known
        ? `A barcode was scanned on this item: ${opts.barcode}. Product databases list it as "${known.name}"${known.brand ? ` by ${known.brand}` : ""}. Treat that as the product unless the photo clearly shows something else, and keep its exact name.`
        : `A barcode was scanned on this item: ${opts.barcode}. Use it to pin down the exact product.`,
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

  const fast = await askVision(mimeType, base64, prompt);
  let best = {
    identity: normalizeIdentity(
      parseModelJson(fast.text),
      opts.barcode ?? null,
    ),
    model: fast.model,
    provider: fast.provider as string,
    secondLook: false,
  };

  if (
    best.identity.confidence < SECOND_LOOK_BELOW &&
    best.identity.kind === "product"
  ) {
    try {
      const careful = await askVision(mimeType, base64, prompt, {
        precise: true,
      });
      const identity = normalizeIdentity(
        parseModelJson(careful.text),
        opts.barcode ?? null,
      );
      if (identity.confidence > best.identity.confidence) {
        best = {
          identity,
          model: careful.model,
          provider: careful.provider,
          secondLook: true,
        };
      }
    } catch {
      // The fast answer stands.
    }
  }
  return best;
}
