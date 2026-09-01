import type { ExportBudget, ExportFormat, WsfMetadata } from "@/types";
import { ApiError } from "@/lib/wsfMetadata";
import { Button } from "@/components/ui/button";

interface Props {
  budget: ExportBudget | null;
  meta: WsfMetadata | null;
  error: unknown;
  busy: boolean;
  progress: { done: number; total: number } | null;
  resultUrl: string | null;

  resultFormat: ExportFormat | null;
  format: ExportFormat;
  loading: boolean;
  onExport: () => void;
  onCancel: () => void;
}

export default function ExportPanel(p: Props) {
  const downloadFormat = p.resultFormat ?? p.format;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-text mb-1 text-sm font-semibold">Export budget</h3>
        {p.budget ? (
          <div className="text-muted-foreground text-xs">
            <p>
              {p.budget.totalFrames} frames · {p.budget.pixelsPerFrame.toLocaleString()} px/frame ·
              ~{Math.round(p.budget.estimatedServerBytesPerFrame / 1048576)} MB peak read/request
            </p>
            {p.budget.warnings.map((w, i) => (
              <p key={i} className="text-destructive mt-1">
                ⚠ {w}
              </p>
            ))}
            {p.budget.ok && <p className="mt-1">Within safe limits.</p>}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            {p.loading ? "Loading metadata…" : "Pick a period to see the budget."}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={p.onExport} disabled={p.busy || !p.budget}>
          {p.busy ? "Rendering…" : "Export"}
        </Button>
        <Button variant="secondary" onClick={p.onCancel} disabled={!p.busy}>
          Cancel
        </Button>
        {p.resultUrl && (
          <Button variant="outline" asChild>
            <a
              href={p.resultUrl}
              download={`wsf-timeframe.${downloadFormat === "gif" ? "gif" : "webm"}`}
            >
              ⬇ Download {downloadFormat.toUpperCase()}
            </a>
          </Button>
        )}
      </div>

      {p.progress && (
        <p className="text-muted-foreground text-xs" role="status">
          Captured {p.progress.done}/{p.progress.total}
        </p>
      )}

      {p.error != null && <ErrorView error={p.error} />}

      {p.meta && (
        <div>
          <h3 className="text-text mb-1 text-sm font-semibold">Metadata</h3>
          <p className="text-muted-foreground text-xs">
            CRS: {p.meta.crs ?? "—"} · dtype: {p.meta.dtype ?? "—"} · nodata:{" "}
            {String(p.meta.nodata ?? "—")} · variables: {p.meta.variables.join(", ") || "—"} ·
            epochs: {p.meta.maxEpoch ?? "—"}
          </p>
          <details className="mt-1">
            <summary className="text-muted-foreground cursor-pointer text-xs">Raw /info</summary>
            <pre className="bg-card border-border mt-1 max-h-48 overflow-auto rounded-md border p-2 text-[11px]">
              {JSON.stringify(p.meta.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ErrorView({ error }: { error: unknown }) {
  const text =
    error instanceof ApiError
      ? [
          error.message,
          `URL: ${error.url}`,
          error.status ? `Status: ${error.status}` : "",
          error.body ? `Body: ${error.body.slice(0, 500)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : String((error as Error)?.message ?? error);
  return <p className="text-destructive text-xs break-all whitespace-pre-wrap">{text}</p>;
}