import { randomBytes } from "node:crypto";
import { del, put } from "@vercel/blob";

/**
 * Google Lens (via SerpAPI) only reads images from a public URL, so a scan photo
 * is published for a few minutes and removed right after the lookup.
 *
 * - PUBLIC_BASE_URL set (the server is reachable from the internet): the server
 *   serves the photo itself at /api/tmp-image/<random id>. No third party.
 * - Otherwise BLOB_READ_WRITE_TOKEN (Vercel Blob): uploaded under a random name
 *   and deleted after the lookup.
 * - Neither: visual matching is off and the app simply skips it.
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_KEPT = 50;

interface HeldImage {
  data: Buffer;
  mime: string;
  expires: number;
}

const held = new Map<string, HeldImage>();

function sweep(): void {
  const now = Date.now();
  for (const [id, img] of held) if (img.expires < now) held.delete(id);
  while (held.size > MAX_KEPT) {
    const oldest = held.keys().next().value;
    if (oldest === undefined) break;
    held.delete(oldest);
  }
}

/** Serve a held photo (used by GET /api/tmp-image/:id). */
export function heldImage(id: string): HeldImage | null {
  sweep();
  return held.get(id) ?? null;
}

export function imageHostAvailable(): boolean {
  return Boolean(
    process.env.PUBLIC_BASE_URL || process.env.BLOB_READ_WRITE_TOKEN,
  );
}

export interface PublishedImage {
  url: string;
  remove: () => Promise<void>;
}

export async function publishTempImage(
  data: Buffer,
  mime: string,
): Promise<PublishedImage | null> {
  const ext = mime.split("/")[1] ?? "jpg";
  const id = randomBytes(18).toString("base64url");

  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) {
    held.set(id, { data, mime, expires: Date.now() + TTL_MS });
    sweep();
    return {
      url: `${base}/api/tmp-image/${id}.${ext}`,
      remove: async () => {
        held.delete(id);
      },
    };
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`scope-scans/${id}.${ext}`, data, {
      access: "public",
      contentType: mime,
      token,
      addRandomSuffix: true,
    });
    return {
      url: blob.url,
      remove: async () => {
        await del(blob.url, { token }).catch(() => {});
      },
    };
  }

  return null;
}
