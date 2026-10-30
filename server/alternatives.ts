import { askText, parseModelJson } from "./ai";
import { findPrices } from "./pricing";
import type { Alternative, Market } from "@shared/scan";

/**
 * "Same job, less money": the model names up to three real products that do
 * what the scanned one does for less, then each is priced live — only in the
 * user's own market, to keep the lookup cheap. Only alternatives that are
 * actually on sale for less than the reference price are returned.
 */

const PROMPT = (args: {
  name: string;
  category: string | null;
  priceUSD: number | null;
  lang: "tr" | "en";
}) => `A shopper is looking at: "${args.name}"${args.category ? ` (${args.category})` : ""}${args.priceUSD ? `, which costs about $${Math.round(args.priceUSD)} new` : ""}.

Suggest up to 3 OTHER products, currently sold new, that do the same job well for clearly less money. Real, existing models only (brand + exact model). Prefer well-reviewed, widely sold ones. Do not suggest the same product, used/refurbished items, or accessories.

Answer with one JSON object:
{"alternatives":[{"name":"<brand + model>","brand":"<brand>","model":"<model>","searchQuery":"<best shopping query>","estimateUSD":<typical new price as a number>,"why":"<max 12 words, ${args.lang === "tr" ? "in Turkish" : "in English"}: what you keep and what you give up>"}]}`;

interface Suggestion {
  name?: string;
  brand?: string;
  model?: string;
  searchQuery?: string;
  estimateUSD?: number;
  why?: string;
}

export async function findAlternatives(args: {
  name: string;
  category?: string | null;
  priceUSD?: number | null;
  homeMarket: Market;
  lang: "tr" | "en";
}): Promise<Alternative[]> {
  const res = await askText(
    PROMPT({
      name: args.name,
      category: args.category ?? null,
      priceUSD: args.priceUSD ?? null,
      lang: args.lang,
    }),
  );
  const parsed = parseModelJson(res.text) as { alternatives?: Suggestion[] };
  const ideas = (parsed.alternatives ?? [])
    .filter((s) => s.name && s.searchQuery)
    .filter((s) => s.name!.toLowerCase() !== args.name.toLowerCase())
    .slice(0, 3);

  const priced = await Promise.all(
    ideas.map(async (s): Promise<Alternative> => {
      const report = await findPrices(
        {
          query: s.searchQuery!,
          brand: s.brand ?? null,
          model: s.model ?? null,
          estimateUSD:
            typeof s.estimateUSD === "number" && s.estimateUSD > 0
              ? s.estimateUSD
              : null,
          homeMarket: args.homeMarket,
        },
        undefined,
        undefined,
        [args.homeMarket],
      ).catch(() => null);
      return {
        name: s.name!,
        brand: s.brand ?? null,
        why: (s.why ?? "").slice(0, 120),
        offer: report?.picks.recommended ?? report?.picks.cheapest ?? null,
      };
    }),
  );

  const ref = args.priceUSD ?? null;
  return priced
    .filter((a) => a.offer && (!ref || a.offer.priceUSD < ref * 0.95))
    .sort((a, b) => (a.offer!.priceUSD ?? 0) - (b.offer!.priceUSD ?? 0));
}
