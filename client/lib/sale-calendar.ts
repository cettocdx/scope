import type { Market } from "@shared/scan";
import type { StringKey } from "@/lib/i18n";

/**
 * When prices usually drop: the big, recurring sale events, matched to the
 * product's category and the user's market. These are known calendar events,
 * not price predictions — the card says so.
 */

export interface SaleEvent {
  name: StringKey;
  /** First day of the event. */
  start: Date;
  /** Approximate dates (e.g. Prime Day is announced each year). */
  approximate?: boolean;
}

type Kind = "tech" | "fashion" | "home" | "beauty" | "general";

const KIND: Record<string, Kind> = {
  Electronics: "tech",
  Appliance: "home",
  Home: "home",
  Tool: "home",
  Fashion: "fashion",
  Footwear: "fashion",
  Bags: "fashion",
  Watch: "fashion",
  Jewelry: "fashion",
  Beauty: "beauty",
  Toy: "general",
  Sports: "general",
};

/** The 4th Friday of November. */
function blackFriday(year: number): Date {
  const first = new Date(year, 10, 1);
  const offset = (5 - first.getDay() + 7) % 7;
  return new Date(year, 10, 1 + offset + 21);
}

function eventsFor(year: number, kind: Kind, market: Market): SaleEvent[] {
  const bf = blackFriday(year);
  const list: SaleEvent[] = [
    {
      name: market === "TR" ? "Black Friday (Efsane Cuma)" : "Black Friday",
      start: bf,
    },
    {
      name: "Cyber Monday",
      start: new Date(year, 10, bf.getDate() + 3),
    },
  ];
  if (market === "TR" || kind === "tech" || kind === "beauty")
    list.push({ name: "11.11 Singles' Day", start: new Date(year, 10, 11) });
  if (kind === "tech" || kind === "home" || kind === "general")
    list.push({
      name: "Amazon Prime Day",
      start: new Date(year, 6, 8),
      approximate: true,
    });
  if (kind === "fashion") {
    list.push({ name: "Winter season-end sale", start: new Date(year, 0, 2) });
    list.push({
      name: "Summer season-end sale",
      start: new Date(year, 5, 25),
      approximate: true,
    });
  }
  if (kind === "tech")
    list.push({
      name: "Back-to-school deals",
      start: new Date(year, 7, 1),
      approximate: true,
    });
  if (market !== "TR" && (kind === "home" || kind === "tech"))
    list.push({ name: "January sales", start: new Date(year, 0, 2) });
  return list;
}

/** The next relevant sale, or null if nothing is due within ~5 months. */
export function nextSale(
  category: string,
  market: Market,
  now: Date = new Date(),
): (SaleEvent & { days: number }) | null {
  const kind = KIND[category] ?? "general";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = [
    ...eventsFor(now.getFullYear(), kind, market),
    ...eventsFor(now.getFullYear() + 1, kind, market),
  ]
    .map((e) => ({
      ...e,
      days: Math.round((e.start.getTime() - today.getTime()) / 86_400_000),
    }))
    .filter((e) => e.days >= 0 && e.days <= 150)
    .sort((a, b) => a.days - b.days);
  return upcoming[0] ?? null;
}
