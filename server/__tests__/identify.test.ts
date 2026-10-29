import { describe, it, expect } from "vitest";
import { normalizeIdentity } from "../identify";
import { parseModelJson } from "../ai";

describe("parseModelJson", () => {
  it("reads fenced or prose-wrapped JSON", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here you go: {"a":2} hope it helps')).toEqual({
      a: 2,
    });
  });
});

describe("normalizeIdentity", () => {
  it("cleans a model answer into a complete identity", () => {
    const id = normalizeIdentity(
      {
        name: "Apple AirPods Pro 2 (USB-C)",
        brand: "Apple",
        model: "AirPods Pro 2",
        variant: "USB-C",
        category: "electronics",
        confidence: 93.6,
        searchQuery: "Apple AirPods Pro 2 USB-C",
        altQueries: ["Apple AirPods Pro 2 USB-C", "AirPods Pro 2"],
        mustHave: ["AirPods Pro", "USB-C"],
        alternatives: [],
        regulated: false,
        estimateUSD: "249",
      },
      "0194253945253",
    );
    expect(id.category).toBe("Electronics");
    expect(id.confidence).toBe(94);
    expect(id.altQueries).toEqual(["AirPods Pro 2"]);
    expect(id.mustHave).toEqual(["airpods pro", "usb-c"]);
    expect(id.estimateUSD).toBe(249);
    expect(id.barcode).toBe("0194253945253");
  });

  it("never invents a brand and falls back safely on junk", () => {
    const id = normalizeIdentity(
      { brand: "Unknown Brand", category: "spaceship" },
      null,
    );
    expect(id.brand).toBeNull();
    expect(id.category).toBe("Other");
    expect(id.name).toBe("Unidentified item");
    expect(id.confidence).toBe(50);
  });

  it("flags age-restricted goods even if the model forgot", () => {
    const id = normalizeIdentity(
      { name: "Elf Bar BC5000 Vape", regulated: false },
      null,
    );
    expect(id.regulated).toBe(true);
  });

  it("reads what kind of thing it is and what else is in the photo", () => {
    const shirt = normalizeIdentity(
      {
        kind: "product",
        name: "Nike Sportswear Club T-Shirt, Black",
        brand: "Nike",
        others: ["Apple Watch Series 9", "Ray-Ban Wayfarer"],
      },
      null,
    );
    expect(shirt.kind).toBe("product");
    expect(shirt.others).toEqual(["Apple Watch Series 9", "Ray-Ban Wayfarer"]);

    expect(
      normalizeIdentity(
        { kind: "not_for_sale", name: "Golden retriever" },
        null,
      ).kind,
    ).toBe("not_for_sale");
    expect(normalizeIdentity({ kind: "something else" }, null).kind).toBe(
      "product",
    );
  });

  it("unwraps a nested answer and never suggests buying a not-for-sale thing", () => {
    const mug = normalizeIdentity(
      {
        main: {
          kind: "generic",
          name: "White ceramic coffee mug",
          confidence: 80,
        },
        others: [{ name: "Black electric kettle" }, "Granite countertop"],
      },
      null,
    );
    expect(mug.name).toBe("White ceramic coffee mug");
    expect(mug.kind).toBe("generic");
    expect(mug.others).toEqual(["Black electric kettle", "Granite countertop"]);

    const dog = normalizeIdentity(
      {
        kind: "not_for_sale",
        name: "Golden retriever",
        searchQuery: "golden retriever puppy for sale",
      },
      null,
    );
    expect(dog.searchQuery).toBe("");
  });
});
