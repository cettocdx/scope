import { describe, it, expect } from "vitest";
import { detectImageType, normalizeDateValue, findSyncMatch } from "../routes";

// Build a minimal buffer with the given leading bytes, padded so it clears the
// 12-byte minimum length check.
function bufferWithBytes(bytes: number[], totalLength = 16): Buffer {
  const buf = Buffer.alloc(Math.max(totalLength, bytes.length));
  for (let i = 0; i < bytes.length; i++) {
    buf[i] = bytes[i];
  }
  return buf;
}

describe("detectImageType", () => {
  it("detects JPEG from FF D8 FF magic bytes", () => {
    const buf = bufferWithBytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageType(buf)).toBe("jpeg");
  });

  it("detects PNG from 89 50 4E 47 magic bytes", () => {
    const buf = bufferWithBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageType(buf)).toBe("png");
  });

  it("detects WEBP from RIFF....WEBP magic bytes", () => {
    // "RIFF" + 4 size bytes + "WEBP"
    const buf = bufferWithBytes([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size (ignored)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectImageType(buf)).toBe("webp");
  });

  it("returns null for a RIFF container that is not WEBP", () => {
    // RIFF + size + "WAVE" (a wav file, not an image)
    const buf = bufferWithBytes([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // WAVE
    ]);
    expect(detectImageType(buf)).toBeNull();
  });

  it("returns null for random non-image bytes", () => {
    const buf = bufferWithBytes([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    expect(detectImageType(buf)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it("returns null for a too-short buffer (< 12 bytes)", () => {
    // Has a JPEG prefix but is shorter than the minimum length.
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    expect(detectImageType(buf)).toBeNull();
  });
});

describe("normalizeDateValue", () => {
  it("normalizes a Date and an equivalent ISO string to the same epoch", () => {
    const d = new Date("2024-01-02T03:04:05.000Z");
    expect(normalizeDateValue(d)).toBe(normalizeDateValue("2024-01-02T03:04:05.000Z"));
  });

  it("returns null for null and undefined", () => {
    expect(normalizeDateValue(null)).toBeNull();
    expect(normalizeDateValue(undefined)).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(normalizeDateValue("not-a-date")).toBeNull();
  });
});

describe("findSyncMatch", () => {
  it("matches by id when present", () => {
    const existing = [
      { id: "a", itemName: "Watch", dateAdded: new Date("2024-01-01T00:00:00Z") },
      { id: "b", itemName: "Bag", dateAdded: new Date("2024-02-01T00:00:00Z") },
    ];
    const match = findSyncMatch(existing, { id: "b", itemName: "Different" });
    expect(match?.id).toBe("b");
  });

  it("matches by itemName + normalized date across Date vs ISO string", () => {
    const existing = [
      { id: "a", itemName: "Watch", dateAdded: new Date("2024-01-01T00:00:00.000Z") },
    ];
    // candidate has no id and a string date; previously === always failed.
    const match = findSyncMatch(existing, {
      itemName: "Watch",
      dateAdded: "2024-01-01T00:00:00.000Z",
    });
    expect(match?.id).toBe("a");
  });

  it("returns undefined when itemName matches but date differs", () => {
    const existing = [
      { id: "a", itemName: "Watch", dateAdded: new Date("2024-01-01T00:00:00.000Z") },
    ];
    const match = findSyncMatch(existing, {
      itemName: "Watch",
      dateAdded: "2024-06-01T00:00:00.000Z",
    });
    expect(match).toBeUndefined();
  });

  it("returns undefined when there is no candidate match at all", () => {
    const existing = [
      { id: "a", itemName: "Watch", dateAdded: new Date("2024-01-01T00:00:00.000Z") },
    ];
    const match = findSyncMatch(existing, {
      itemName: "Unknown",
      dateAdded: "2024-01-01T00:00:00.000Z",
    });
    expect(match).toBeUndefined();
  });

  it("matches when both dates are absent (null) and itemName matches", () => {
    const existing = [{ id: "a", itemName: "Watch", dateAdded: null }];
    const match = findSyncMatch(existing, { itemName: "Watch" });
    expect(match?.id).toBe("a");
  });
});
