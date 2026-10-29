/**
 * Recognition benchmark: sends every photo in eval/cases.json to /api/identify
 * and checks kind, brand and the key words of the name. Run after any change
 * to the prompt, models or normalisation:
 *
 *   npm run eval                          # against the local server (:4000)
 *   EVAL_API=https://scope-api-flax.vercel.app npm run eval
 *
 * The photos in eval/photos are AI-generated test images (labelled as such in
 * eval/README.md), not real customer photos.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Case {
  file: string;
  kind: "product" | "generic" | "not_for_sale";
  brand?: string | null;
  /** Each group needs at least one of its words in the name (case-insensitive). */
  name?: string[][];
}

const API = (process.env.EVAL_API ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const dir = join(__dirname);
const cases: Case[] = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8"));

async function run(): Promise<void> {
  let passed = 0;
  let totalMs = 0;
  for (const c of cases) {
    const image = readFileSync(join(dir, "photos", c.file)).toString("base64");
    const t = Date.now();
    let identity: Record<string, unknown> | null = null;
    let error = "";
    try {
      const res = await fetch(`${API}/api/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const body = (await res.json()) as {
        identity?: Record<string, unknown>;
        error?: string;
      };
      identity = body.identity ?? null;
      if (!identity) error = body.error ?? `HTTP ${res.status}`;
    } catch (e) {
      error = (e as Error).message;
    }
    const ms = Date.now() - t;
    totalMs += ms;

    const name = String(identity?.name ?? "").toLowerCase();
    const brand = String(identity?.brand ?? "").toLowerCase();
    const problems: string[] = [];
    if (!identity) problems.push(error);
    else {
      if (identity.kind !== c.kind) problems.push(`kind ${identity.kind}`);
      if (
        c.brand &&
        !brand.includes(c.brand.toLowerCase()) &&
        !name.includes(c.brand.toLowerCase())
      )
        problems.push(`brand ${identity.brand ?? "none"}`);
      if (c.brand === null && identity.brand)
        problems.push(`invented brand ${identity.brand}`);
      for (const group of c.name ?? []) {
        if (!group.some((w) => name.includes(w.toLowerCase())))
          problems.push(`name lacks ${group.join("/")}`);
      }
    }
    const ok = problems.length === 0;
    if (ok) passed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.file.padEnd(24)} ${String(ms).padStart(5)} ms  ${identity?.name ?? ""}${ok ? "" : `  ← ${problems.join("; ")}`}`,
    );
  }
  console.log(
    `\n${passed}/${cases.length} correct · average ${Math.round(totalMs / cases.length)} ms · ${API}`,
  );
  if (passed < cases.length) process.exitCode = 1;
}

void run();
