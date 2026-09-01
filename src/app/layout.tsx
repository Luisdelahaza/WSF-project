import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "MindEarth · WSF Timeframe Export",
  description: "Export an animated WSF timeframe for a selected area as GIF or video.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
