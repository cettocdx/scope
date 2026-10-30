import { describe, expect, it } from "vitest";

import { hashEntries } from "../storage-redis";

describe("hashEntries", () => {
  it("reads the flat [field, value, …] reply", () => {
    expect(hashEntries(["a", '{"x":1}', "b", '{"x":2}'])).toEqual([
      ["a", '{"x":1}'],
      ["b", '{"x":2}'],
    ]);
  });

  it("reads an object reply and re-serialises parsed values", () => {
    expect(hashEntries({ a: '{"x":1}', b: { x: 2 } })).toEqual([
      ["a", '{"x":1}'],
      ["b", '{"x":2}'],
    ]);
  });

  it("treats an empty or missing hash as no entries", () => {
    expect(hashEntries(null)).toEqual([]);
    expect(hashEntries([])).toEqual([]);
  });
});
