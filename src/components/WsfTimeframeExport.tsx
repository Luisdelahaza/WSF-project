"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Bbox4326 } from "@/types";
import { Logo } from "@/components/ui/logo";
import ExportDialog from "@/components/ExportDialog";

// maplibre-gl touches `window` at import time — load the map client-only.
const MapSelector = dynamic(() => import("@/components/MapSelector"), { ssr: false });

// Mainland Spain [west, south, east, north]; replaced by the map viewport on load.
const DEFAULT_BBOX: Bbox4326 = [-9.5, 36.0, 3.5, 43.8];

/**
 * Page shell: a full-bleed map with a floating panel. The actual tool (params +
 * preview + export) lives in the ExportDialog modal, so it can be dropped into
 * wsf-platform as a dialog triggered from the existing map UI.
 */
export default function WsfTimeframeExport() {
  const [bbox, setBbox] = useState<Bbox4326>(DEFAULT_BBOX);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapSelector onBboxChange={setBbox} />

      <div className="bg-card/90 border-border absolute top-4 left-4 z-10 flex max-w-xs flex-col gap-3 rounded-lg border p-4 backdrop-blur">
        <Logo width={150} height={26} priority />
        <p className="text-muted-foreground text-sm">
          Pan and zoom to your area of interest, then export a World Settlement Footprint timeframe
          as a GIF or video.
        </p>
        <ExportDialog bbox={bbox} setBbox={setBbox} />
      </div>
    </div>
  );
}
