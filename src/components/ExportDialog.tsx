"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bbox4326, ExportFormat, RenderParams, WsfMetadata } from "@/types";
import { config, DEFAULT_RENDER_PARAMS } from "@/config/wsf";
import { fetchMetadata, framesForEpochRange, epochSpan } from "@/lib/wsfMetadata";
import { computeBudget } from "@/lib/exportBudget";
import { captureFrames } from "@/lib/frameCapture";
import { encodeGif } from "@/lib/gifEncoder";
import { canVideoEncode, encodeVideo } from "@/lib/videoEncoder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TimeframeControls from "@/components/TimeframeControls";
import ExportPanel from "@/components/ExportPanel";
import PreviewPlayer from "@/components/PreviewPlayer";

interface Props {
  bbox: Bbox4326;
  setBbox: (b: Bbox4326) => void;
}

export default function ExportDialog({ bbox, setBbox }: Props) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<RenderParams>(DEFAULT_RENDER_PARAMS);
  const [startEpoch, setStartEpoch] = useState(1);
  const [endEpoch, setEndEpoch] = useState(20);
  const [fps, setFps] = useState(4);
  const [format, setFormat] = useState<ExportFormat>("gif");

  const [meta, setMeta] = useState<WsfMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // The ACTUAL format of the current resultUrl (from the resulting Blob's
  // real MIME type) — independent of `format`, the user's request. See the
  // comment on ExportPanel's `resultFormat` prop.
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [videoSupported, setVideoSupported] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const maxEpoch = meta?.maxEpoch ?? 0;

  const frames = useMemo(
    () => (maxEpoch ? framesForEpochRange(maxEpoch, startEpoch, endEpoch) : []),
    [maxEpoch, startEpoch, endEpoch],
  );
  const budget = useMemo(
    () => (frames.length ? computeBudget(params, frames.length, meta ?? undefined) : null),
    [params, frames.length, meta],
  );

  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl]);

  // Reset any previous export result whenever an input that would make it
  // stale changes — otherwise the Download button stays visible/enabled and
  // pointing at a blob for parameters that no longer match the selection.
  useEffect(() => {
    setResultUrl(null);
    setResultFormat(null);
    setDegraded(false);
  }, [bbox, params, startEpoch, endEpoch, format]);

  useEffect(() => {
    const ok = canVideoEncode();
    setVideoSupported(ok);
    if (!ok) setFormat("gif");
  }, []);

  async function loadMetadata() {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMetadata(config.apiPrefix, config.datasetUrl);
      setMeta(m);
      const span = epochSpan(m.maxEpoch ?? 0);
      if (span) {
        setStartEpoch(span[0]);
        setEndEpoch(span[1]);
      }
      if (m.nodata != null) setParams((p) => ({ ...p, nodata: Number(m.nodata) }));
    } catch (e) {
      setError(e);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o && !meta && !loading) void loadMetadata();
  }

  async function onExport() {
    if (!frames.length) return;
    setBusy(true);
    setError(null);
    setResultUrl(null);
    setResultFormat(null);
    setDegraded(false);
    setProgress({ done: 0, total: frames.length });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const captured = await captureFrames(
        config.apiPrefix,
        config.datasetUrl,
        bbox,
        params,
        frames,
        {
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        },
      );

      const blob = await (format === "gif"
        ? encodeGif(captured, fps, { signal: controller.signal })
        : encodeVideo(captured, fps, controller.signal));

      // Derive the ACTUAL format from what came back, not from what was
      // requested — this is the single source of truth for the download
      // filename/extension and for detecting silent degradation.
      const actualFormat: ExportFormat = blob.type === "image/gif" ? "gif" : "webm";
      setResultFormat(actualFormat);
      if (format !== "gif" && actualFormat === "gif") {
        setDegraded(true);
      }

      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setError(e);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Export WSF timeframe</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(64rem,calc(100%-2rem))] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Export WSF timeframe</DialogTitle>
          <DialogDescription>
            Preview the selected area, then export a GIF or video with the MindEarth overlay.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-4">
            <TimeframeControls
              params={params}
              setParams={setParams}
              bbox={bbox}
              setBbox={setBbox}
              startEpoch={startEpoch}
              endEpoch={endEpoch}
              setEpochs={(s, e) => {
                setStartEpoch(s);
                setEndEpoch(e);
              }}
              maxEpoch={maxEpoch}
              loading={loading}
              fps={fps}
              setFps={setFps}
              format={format}
              setFormat={setFormat}
              videoSupported={videoSupported}
              meta={meta}
            />

            {degraded && (
              <div
                role="status"
                className="rounded-md border border-yellow-600/40 bg-yellow-600/10 px-3 py-2 text-xs text-yellow-200"
              >
                Your browser couldn't encode a video, so this export is a GIF instead.
              </div>
            )}

            <ExportPanel
              budget={budget}
              meta={meta}
              error={error}
              busy={busy}
              progress={progress}
              resultUrl={resultUrl}
              resultFormat={resultFormat}
              format={format}
              loading={loading}
              onExport={onExport}
              onCancel={() => abortRef.current?.abort()}
            />
          </div>

          <PreviewPlayer frames={frames} bbox={bbox} params={params} fps={fps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}