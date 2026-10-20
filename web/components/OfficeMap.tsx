"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Office } from "@/lib/offices";

type Props = {
  center: { lat: number; lon: number };
  offices: Office[];
  label: string;
  unnamed: string;
  attribution: string;
};

/** Leaflet map with OpenStreetMap tiles. Leaflet is imported on the client only, inside the effect. */
export default function OfficeMap({ center, offices, label, unnamed, attribution }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const latest = useRef({ center, offices, unnamed });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lon], 14);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${attribution}`,
        })
        .addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; later changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const leaflet = L.current;
    const m = map.current;
    const g = layer.current;
    if (!leaflet || !m || !g) return;
    const { center, offices, unnamed } = latest.current;
    g.clearLayers();
    leaflet
      .circleMarker([center.lat, center.lon], { radius: 8, color: "#1d1814", weight: 3, fillColor: "#fbf6ef", fillOpacity: 1 })
      .addTo(g);
    const pts: [number, number][] = [[center.lat, center.lon]];
    for (const o of offices) {
      const dot = leaflet.circleMarker([o.lat, o.lon], { radius: 9, color: "#1d1814", weight: 2, fillColor: "#e8742a", fillOpacity: 1 });
      const text = document.createElement("span");
      text.textContent = o.name ?? unnamed;
      dot.bindPopup(text).addTo(g);
      pts.push([o.lat, o.lon]);
    }
    if (pts.length > 1) m.fitBounds(pts, { padding: [28, 28], maxZoom: 16 });
    else m.setView([center.lat, center.lon], 14);
  }

  useEffect(() => {
    latest.current = { center, offices, unnamed };
    draw();
    // draw only reads refs
  }, [center, offices, unnamed]);

  return <div ref={el} role="region" aria-label={label} className="h-72 w-full overflow-hidden rounded-2xl border border-line sm:h-96" />;
}
