// Pure helpers for the offices page. Nothing here stores or invents addresses: every office comes from a live
// OpenStreetMap (Overpass) response and is only held in component state.

export interface Office {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
}

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const CSC_LOCATOR_URL = "https://locator.csccloud.in/";

export function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${lat},${lon})`;
  return [
    "[out:json][timeout:20];",
    "(",
    `  nwr[office=government]${around};`,
    `  nwr[amenity=townhall]${around};`,
    ");",
    "out center 60;",
  ].join("\n");
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseOverpass(json: unknown): Office[] {
  const elements = (json as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const out: Office[] = [];
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const e = el as {
      type?: unknown;
      id?: unknown;
      lat?: unknown;
      lon?: unknown;
      center?: { lat?: unknown; lon?: unknown };
      tags?: { name?: unknown };
    };
    const lat = isNum(e.lat) ? e.lat : e.center?.lat;
    const lon = isNum(e.lon) ? e.lon : e.center?.lon;
    if (!isNum(lat) || !isNum(lon)) continue;
    const name = typeof e.tags?.name === "string" && e.tags.name.trim() ? e.tags.name : null;
    out.push({ id: `${String(e.type ?? "node")}/${String(e.id ?? out.length)}`, name, lat, lon });
  }
  return out;
}

export function nominatimUrl(query: string): string {
  const q = new URLSearchParams({ q: query, format: "json", limit: "1", countrycodes: "in" });
  return `${NOMINATIM_URL}?${q.toString()}`;
}

export function parseNominatim(json: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const first = json[0] as { lat?: unknown; lon?: unknown } | null;
  const lat = Number(first?.lat);
  const lon = Number(first?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
