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

const ATTEMPT_TIMEOUT_MS = 15_000;

export function activeProvider(): AiProvider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function openRouterModels(): string[] {
  const raw = process.env.OPENROUTER_MODELS;
  const list = raw
    ? raw
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : DEFAULT_OPENROUTER_MODELS;
  return list.length ? list : DEFAULT_OPENROUTER_MODELS;
}

function isTransient(status: number | undefined, message: string): boolean {
  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /\b(503|429|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|aborted)\b/i.test(
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
): Promise<VisionResult> {
  const key = process.env.OPENROUTER_API_KEY as string;
  let lastErr: unknown;

  for (const model of openRouterModels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
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
          max_tokens: 900,
          response_format: { type: "json_object" },
          // Identification needs sharp eyes, not long deliberation: skipping
          // reasoning is the single biggest latency win on thinking models.
          reasoning: { enabled: false },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                { type: "text", text: prompt },
              ],
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
): Promise<VisionResult> {
  const baseUrl = process.env.GEMINI_BASE_URL;
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY as string,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
  });
  let lastErr: unknown;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: prompt },
              ],
            },
          ],
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            ...(model.startsWith("gemini-2.5")
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
        ATTEMPT_TIMEOUT_MS,
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
): Promise<VisionResult> {
  const provider = activeProvider();
  if (!provider) throw new AiNotConfiguredError();
  return provider === "openrouter"
    ? callOpenRouter(mimeType, base64, prompt)
    : callGemini(mimeType, base64, prompt);
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
