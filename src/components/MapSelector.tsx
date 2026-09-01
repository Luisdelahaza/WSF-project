"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Bbox4326 } from "@/types";

// MapLibre's keyless demo style (vector world basemap, no API key/account).
// Swap for the wsf-platform basemap when integrating.
const BASEMAP_STYLE = "https://demotiles.maplibre.org/style.json";

interface Props {
  /** Emitted on load and whenever the viewport changes (= export area). */
  onBboxChange: (bbox: Bbox4326) => void;
}

/**
 * Full-bleed basemap. The export area defaults to the current viewport, emitted
 * on `moveend`. Free-form rectangle draw/resize (so a sub-region can be chosen
 * without panning) is a Phase 3 enhancement — wire @mapbox/mapbox-gl-draw here.
 */
export default function MapSelector({ onBboxChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onBboxChange);
  cbRef.current = onBboxChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [-3.7, 40.2], // Spain
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const emit = () => {
      const b = map.getBounds();
      cbRef.current([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on("load", emit);
    map.on("moveend", emit);
    return () => map.remove();
  }, []);

  // NOTE: maplibre-gl's stylesheet forces `.maplibregl-map { position: relative }`,
  // which overrides Tailwind's `absolute`. Size the container with h-full/w-full
  // (the parent is h-screen) rather than relying on `absolute inset-0`.
  return <div ref={containerRef} className="h-full w-full" />;
}
