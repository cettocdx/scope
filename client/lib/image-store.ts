import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { PortfolioAsset } from "@/types";

/**
 * On-device image store. Captured photos are persisted to the document
 * directory as JPEG files and referenced by uri, so the heavy base64 payload
 * never lives in AsyncStorage, the cloud database, or a sync response.
 */
const ASSET_DIR = `${FileSystem.documentDirectory}assets/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ASSET_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ASSET_DIR, { intermediates: true });
  }
}

export interface StoredImage {
  imageUri: string;
  thumbnailUri: string;
}

/** Strips a `data:<mime>;base64,` prefix, returning the raw base64 payload. */
function stripDataUri(source: string): string {
  const comma = source.indexOf(",");
  return source.startsWith("data:") && comma !== -1
    ? source.slice(comma + 1)
    : source;
}

/**
 * Persists a freshly captured image (a `data:` URI carrying base64) to the
 * document directory and produces a downscaled thumbnail for list rendering.
 * Returns local file uris. Best-effort: never throws, so a storage hiccup can
 * never block saving an asset.
 */
export async function persistAssetImage(
  dataUri: string,
  id: string,
): Promise<StoredImage | null> {
  try {
    await ensureDir();
    const imageUri = `${ASSET_DIR}${id}.jpg`;
    const thumbnailUri = `${ASSET_DIR}${id}_thumb.jpg`;

    // Write the full image straight from base64 — no native decode needed and
    // works for the camera's data: URI (which manipulateAsync can't read).
    await FileSystem.writeAsStringAsync(imageUri, stripDataUri(dataUri), {
      encoding: "base64",
    });

    // The thumbnail is derived from the now-persisted file (a real file uri).
    const thumb = await manipulateAsync(imageUri, [{ resize: { width: 240 } }], {
      compress: 0.6,
      format: SaveFormat.JPEG,
    });
    await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
    await FileSystem.copyAsync({ from: thumb.uri, to: thumbnailUri });

    return { imageUri, thumbnailUri };
  } catch (e) {
    console.error("Failed to persist asset image:", e);
    return null;
  }
}

/** Removes an asset's image files. Best-effort and idempotent. */
export async function deleteAssetImage(
  asset: Pick<PortfolioAsset, "id" | "imageUri" | "thumbnailUri">,
): Promise<void> {
  const targets = [
    asset.imageUri,
    asset.thumbnailUri,
    `${ASSET_DIR}${asset.id}.jpg`,
    `${ASSET_DIR}${asset.id}_thumb.jpg`,
  ].filter((u): u is string => typeof u === "string" && u.startsWith("file://"));

  await Promise.all(
    targets.map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
    ),
  );
}

/**
 * Best display source for an asset: the thumbnail in lists, the full image in
 * detail views, falling back to a legacy inline image for pre-migration assets.
 */
export function imageSource(
  asset: Pick<PortfolioAsset, "imageUri" | "thumbnailUri" | "imageBase64">,
  opts: { thumbnail?: boolean } = {},
): string | undefined {
  if (opts.thumbnail) {
    return asset.thumbnailUri ?? asset.imageUri ?? asset.imageBase64;
  }
  return asset.imageUri ?? asset.thumbnailUri ?? asset.imageBase64;
}
