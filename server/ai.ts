import { GoogleGenAI } from "@google/genai";

/**
 * Vision model access behind one function. OpenRouter is preferred when
 * OPENROUTER_API_KEY is set (one key, many models); otherwise we call Google
 * Gemini directly with GEMINI_API_KEY. Both paths ask for JSON-only output and
 * return the raw text so the caller owns parsing.
 */

export type AiProvider = "openrouter" | "gemini";

export interface VisionResult {
  text: string;
  model: string;
  provider: AiProvider;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI is not configured. Set OPENROUTER_API_KEY (or GEMINI_API_KEY) in your .env.",
    );
  }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Fast vision models, tried in order. Override with OPENROUTER_MODELS="a,b". */
const DEFAULT_OPENROUTER_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4.1-mini",
];

/** Direct Gemini fallback chain (separate capacity pools per model). */
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

/** Stronger models for a second look at hard photos. Override with OPENROUTER_PRECISE_MODELS. */
const DEFAULT_OPENROUTER_PRECISE_MODELS = [
  "google/gemini-2.5-pro",
  "openai/gpt-4.1",
];
const GEMINI_PRECISE_MODELS = ["gemini-2.5-pro"];

const ATTEMPT_TIMEOUT_MS = 15_000;
const PRECISE_TIMEOUT_MS = 30_000;

export interface VisionOptions {
  /** Use a stronger, slower model that may reason before answering. */
  precise?: boolean;
}

export function activeProvider(): AiProvider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function modelList(raw: string | undefined, fallback: string[]): string[] {
  const list = raw
    ? raw
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : fallback;
  return list.length ? list : fallback;
}

function openRouterModels(precise: boolean): string[] {
  return precise
    ? modelList(
        process.env.OPENROUTER_PRECISE_MODELS,
        DEFAULT_OPENROUTER_PRECISE_MODELS,
      )
    : modelList(process.env.OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODELS);
}

function isTransient(status: number | undefined, message: string): boolean {
  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /\b(503|429|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|aborted|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up)\b/i.test(
      message,
    )
  );
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouter(
  mimeType: string,
  base64: string,
  prompt: string,
  precise: boolean,
): Promise<VisionResult> {
  const key = process.env.OPENROUTER_API_KEY as string;
  let lastErr: unknown;

  for (const model of openRouterModels(precise)) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      precise ? PRECISE_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS,
    );
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/cettocdx/scope",
          "X-Title": "SCOPE",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: precise ? 4000 : 1500,
          response_format: { type: "json_object" },
          // The fast pass skips reasoning (the biggest latency win on thinking
          // models); the second look may think briefly about hard photos.
          reasoning: precise
            ? { effort: "low", exclude: true }
            : { enabled: false },
          messages: [
            {
              role: "user",
              // No image: a text-only question (askText).
              content: base64
                ? [
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${base64}` },
                    },
                    { type: "text", text: prompt },
                  ]
                : [{ type: "text", text: prompt }],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = Object.assign(
          new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`),
          {
            status: res.status,
          },
        );
        if (
          isTransient(res.status, body) ||
          res.status === 404 ||
          res.status === 400
        ) {
          // 400/404 here usually means this model can't take the request
          // (no vision / no json mode); the next model may.
          lastErr = err;
          continue;
        }
        throw err;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) {
        lastErr = new Error(`OpenRouter ${model} returned an empty answer`);
        continue;
      }
      return { text, model, provider: "openrouter" };
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number; message?: string; name?: string };
      if (e?.name === "AbortError" || isTransient(e?.status, e?.message || ""))
        continue;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("OpenRouter failed");
}

async function callGemini(
  mimeType: string,
  base64: string,
  prompt: string,
  precise: boolean,
): Promise<VisionResult> {
  const baseUrl = process.env.GEMINI_BASE_URL;
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY as string,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
  });
  let lastErr: unknown;

  for (const model of precise ? GEMINI_PRECISE_MODELS : GEMINI_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                ...(base64 ? [{ inlineData: { mimeType, data: base64 } }] : []),
                { text: prompt },
              ],
            },
          ],
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            ...(model.startsWith("gemini-2.5") && !precise
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
        precise ? PRECISE_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS,
        `Gemini ${model}`,
      );
      const text = response.text ?? "";
      if (!text) {
        lastErr = new Error(`Gemini ${model} returned an empty answer`);
        continue;
      }
      return { text, model, provider: "gemini" };
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number; message?: string };
      if (isTransient(e?.status, e?.message || "")) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("Gemini failed");
}

/** Ask the configured vision model about one image. Throws AiNotConfiguredError when no key is set. */
export async function askVision(
  mimeType: string,
  base64: string,
  prompt: string,
  opts: VisionOptions = {},
): Promise<VisionResult> {
  const provider = activeProvider();
  if (!provider) throw new AiNotConfiguredError();
  const precise = opts.precise === true;
  const call = () =>
    provider === "openrouter"
      ? callOpenRouter(mimeType, base64, prompt, precise)
      : callGemini(mimeType, base64, prompt, precise);
  try {
    return await call();
  } catch (err) {
    // A dropped connection (DNS blip, reset socket) is worth one more try
    // before the user sees an error.
    const e = err as { status?: number; message?: string };
    if (!isTransient(e?.status, e?.message ?? "")) throw err;
    await new Promise((r) => setTimeout(r, 700));
    return call();
  }
}

/** Parse a model's JSON answer, tolerating code fences and leading prose. */
export function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

/** A text-only JSON question to the fast model (no image). */
export function askText(prompt: string): Promise<VisionResult> {
  return askVision("text/plain", "", prompt);
}
