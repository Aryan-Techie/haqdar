import { describe, expect, it } from "vitest";
import { buildOverpassQuery, parseNominatim, parseOverpass } from "./offices";

describe("buildOverpassQuery", () => {
  it("targets government offices around the coordinates", () => {
    const q = buildOverpassQuery(28.6139, 77.209, 3000);
    expect(q).toContain("office=government");
    expect(q).toContain("28.6139");
    expect(q).toContain("77.209");
    expect(q).toContain("3000");
    expect(q).toContain("[out:json]");
  });
});

describe("parseOverpass", () => {
  it("keeps nodes, uses centre for ways, drops elements without coordinates", () => {
    const out = parseOverpass({
      elements: [
        { type: "node", id: 1, lat: 28.6, lon: 77.2, tags: { name: "Tehsil Office" } },
        { type: "way", id: 2, center: { lat: 28.7, lon: 77.1 }, tags: {} },
        { type: "node", id: 3, tags: { name: "No coords" } },
        { type: "node", id: 4, lat: "x", lon: 1 },
      ],
    });
    expect(out).toEqual([
      { id: "node/1", name: "Tehsil Office", lat: 28.6, lon: 77.2 },
      { id: "way/2", name: null, lat: 28.7, lon: 77.1 },
    ]);
  });

  it("returns [] for empty or malformed JSON", () => {
    expect(parseOverpass({})).toEqual([]);
    expect(parseOverpass(null)).toEqual([]);
    expect(parseOverpass("nope")).toEqual([]);
    expect(parseOverpass({ elements: "x" })).toEqual([]);
    expect(parseOverpass({ elements: [null, 5] })).toEqual([]);
  });
});

describe("parseNominatim", () => {
  it("reads the first result's coordinates and tolerates junk", () => {
    expect(parseNominatim([{ lat: "28.61", lon: "77.2" }])).toEqual({ lat: 28.61, lon: 77.2 });
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim({})).toBeNull();
    expect(parseNominatim([{ lat: "a", lon: "b" }])).toBeNull();
  });
});
