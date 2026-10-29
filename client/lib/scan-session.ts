/**
 * Holds the photo being scanned in memory so screens pass a short id through
 * navigation instead of a multi-megabyte base64 string.
 */

export interface ScanPhoto {
  /** JPEG, base64 without the data: prefix. */
  base64: string;
  /** Local file uri for display. */
  uri: string;
  barcode: string | null;
}

const photos = new Map<string, ScanPhoto>();
const MAX_KEPT = 4;

export function putPhoto(photo: ScanPhoto): string {
  const id = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  photos.set(id, photo);
  while (photos.size > MAX_KEPT) {
    const oldest = photos.keys().next().value;
    if (oldest === undefined) break;
    photos.delete(oldest);
  }
  return id;
}

export function getPhoto(id: string): ScanPhoto | undefined {
  return photos.get(id);
}
