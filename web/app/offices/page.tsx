"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { fmt, t, useLang } from "@/lib/i18n";
import {
  CSC_LOCATOR_URL,
  OVERPASS_URL,
  buildOverpassQuery,
  distanceKm,
  nominatimUrl,
  parseNominatim,
  parseOverpass,
  type Office,
} from "@/lib/offices";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useOnline } from "@/components/OfflineNotice";

const OfficeMap = dynamic(() => import("@/components/OfficeMap"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-paper-deep sm:h-96" />,
});

type Phase = "idle" | "locating" | "loading" | "ready" | "denied" | "offline" | "failed" | "notfound";
type Point = { lat: number; lon: number };

const RADII = [3000, 10000];
/** About 100 m: enough to find offices nearby, not an exact position. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

async function fetchOffices(p: Point): Promise<{ offices: Office[]; radius: number }> {
  let radius = RADII[0];
  for (const r of RADII) {
    radius = r;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: `data=${encodeURIComponent(buildOverpassQuery(round3(p.lat), round3(p.lon), r))}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const offices = parseOverpass(await res.json());
      if (offices.length) return { offices, radius };
    } finally {
      clearTimeout(timer);
    }
  }
  return { offices: [], radius };
}

export default function OfficesPage() {
  const [lang] = useLang();
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>("idle");
  const [center, setCenter] = useState<Point | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [radius, setRadius] = useState(RADII[0]);
  const [place, setPlace] = useState<string | null>(null);
  const [city, setCity] = useState("");

  async function load(p: Point, label: string | null) {
    setCenter(p);
    setPlace(label);
    setPhase("loading");
    try {
      const r = await fetchOffices(p);
      setOffices(r.offices);
      setRadius(r.radius);
      setPhase("ready");
    } catch {
      setOffices([]);
      setPhase(navigator.onLine ? "failed" : "offline");
    }
  }

  function locate() {
    if (!navigator.geolocation) return setPhase("denied");
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => void load({ lat: pos.coords.latitude, lon: pos.coords.longitude }, null),
      () => setPhase("denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  // Only when the user already granted location do we skip the button; otherwise the browser prompt follows a tap.
  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => live && s.state === "granted" && locate())
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchCity(e: FormEvent) {
    e.preventDefault();
    const q = city.trim();
    if (!q) return;
    if (!navigator.onLine) return setPhase("offline");
    setPhase("loading");
    try {
      const res = await fetch(nominatimUrl(q), {
        headers: { "Accept-Language": lang === "hi" ? "hi-IN,hi;q=0.9,en;q=0.6" : "en-IN,en;q=0.9" },
      });
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const hit = parseNominatim(await res.json());
      if (!hit) return setPhase("notfound");
      await load(hit, q);
    } catch {
      setPhase(navigator.onLine ? "failed" : "offline");
    }
  }

  const sorted = useMemo(
    () => (center ? [...offices].sort((a, b) => distanceKm(center, a) - distanceKm(center, b)) : []),
    [offices, center],
  );
  const busy = phase === "locating" || phase === "loading";
  const showSearch = phase !== "idle" && phase !== "locating";
  const message =
    phase === "denied" ? t("offices.denied", lang)
    : phase === "offline" || !online ? t("offices.offline", lang)
    : phase === "failed" ? t("offices.failed", lang)
    : phase === "notfound" ? t("offices.cityNotFound", lang)
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("offices.title", lang)}</h1>

      <p className="text-sm text-ink-soft">{t("offices.privacy", lang)}</p>

      <Button className="w-full sm:w-auto" onClick={locate} disabled={busy || !online}>
        {phase === "locating" ? t("offices.locating", lang) : t("offices.useLocation", lang)}
      </Button>

      {message ? (
        <p role="alert" className="rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn">{message}</p>
      ) : null}

      {showSearch ? (
        <form onSubmit={searchCity} className="flex gap-2" role="search" aria-label={t("offices.searchCity", lang)}>
          <input
            type="search"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("offices.searchPlaceholder", lang)}
            aria-label={t("offices.searchCity", lang)}
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-4 text-base focus:border-ink"
          />
          <Button type="submit" disabled={busy || !city.trim() || !online}>{t("offices.citySearch", lang)}</Button>
        </form>
      ) : null}

      {phase === "loading" ? <p role="status" className="text-ink-muted">{t("offices.searching", lang)}</p> : null}

      {center && (phase === "ready" || phase === "loading") ? (
        <>
          <OfficeMap
            center={center}
            offices={sorted}
            label={t("offices.mapLabel", lang)}
            unnamed={t("offices.unnamed", lang)}
            attribution={t("offices.attribution", lang)}
          />
          {phase === "ready" ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-ink-soft">
                {sorted.length
                  ? fmt(t("offices.found", lang), { count: sorted.length, km: radius / 1000 })
                  : t("offices.none", lang)}
                {" · "}
                {fmt(t("offices.showingFor", lang), { place: place ?? t("offices.yourLocation", lang) })}
              </p>
              <ul className="space-y-2">
                {sorted.slice(0, 15).map((o) => (
                  <li key={o.id}>
                    <Card tone="paper" className="flex items-center justify-between gap-3 !p-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{o.name ?? t("offices.unnamed", lang)}</p>
                        <p className="text-sm text-ink-muted">{distanceKm(center, o).toFixed(1)} km</p>
                      </div>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lon}#map=18/${o.lat}/${o.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-bold underline"
                      >
                        {t("offices.openInMaps", lang)}
                      </a>
                    </Card>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-muted">{t("offices.verifyNote", lang)}</p>
            </div>
          ) : null}
        </>
      ) : null}

      <Card tone="brand">
        <p className="text-sm">{t("offices.cscHint", lang)}</p>
        <a
          href={CSC_LOCATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-base font-bold text-paper"
        >
          {t("offices.cscLocator", lang)} ↗
        </a>
      </Card>
      <p className="text-xs text-ink-muted">{t("offices.attribution", lang)}</p>
    </div>
  );
}
