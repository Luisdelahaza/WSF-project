import WsfTimeframeExport from "@/components/WsfTimeframeExport";

/**
 * Server route shell. The tool itself is a client component (map, canvas,
 * encoders), so it can be dropped into the wsf-platform app as a route or a
 * panel with minimal change.
 */
export default function Page() {
  return <WsfTimeframeExport />;
}
