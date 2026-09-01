"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { Bbox4326, Frame, RenderParams } from "@/types";
import { config } from "@/config/wsf";
import { BACKDROP } from "@/config/colors";
import { renderEpochFrame } from "@/lib/frameCapture";
import { drawOverlay, loadLogo, type LogoImage } from "@/lib/overlay";
import { epochToSemesterLabel } from "@/lib/wsfMetadata";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface Props {
  frames: Frame[];
  bbox: Bbox4326;
  params: RenderParams;
  fps: number;
}

export default function PreviewPlayer({ frames, bbox, params, fps }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const logoRef = useRef<LogoImage | null>(null);
  const logoLoadingRef = useRef<Promise<LogoImage | null> | null>(null);
  const preloadAbortRef = useRef<AbortController | null>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [preloading, setPreloading] = useState(false);
  const [preloadDone, setPreloadDone] = useState(0);

  const currentFrame = frames[currentIdx];

  const drawToCanvas = useCallback((src: HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0);
  }, []);

  useEffect(() => {
    logoLoadingRef.current = loadLogo()
      .then((img) => {
        logoRef.current = img;
        return img;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    cacheRef.current.clear();
    preloadAbortRef.current?.abort();
    setPreloading(false);
    setPreloadDone(0);
  }, [bbox, params]);

  useEffect(() => {
    return () => preloadAbortRef.current?.abort();
  }, []);


  useEffect(() => {
    if (currentIdx >= frames.length) {
      setCurrentIdx(Math.max(0, frames.length - 1));
      setPlaying(false);
    }
  }, [frames.length, currentIdx]);

  useEffect(() => {
    if (!currentFrame) return;
    const epoch = currentFrame.epoch;

    const cached = cacheRef.current.get(epoch);
    if (cached) {
      drawToCanvas(cached);
      return;
    }

    const controller = new AbortController();
    setFetching(true);
    setError(null);

    renderEpochFrame(config.apiPrefix, config.datasetUrl, bbox, params, epoch, controller.signal)
      .then(async (src) => {
        if (logoLoadingRef.current) await logoLoadingRef.current;
        try {
          drawOverlay(src.getContext("2d")!, { frame: currentFrame, params, logo: logoRef.current });
        } catch (e) {
          console.error("[PreviewPlayer] drawOverlay failed:", e);
        }
        cacheRef.current.set(epoch, src);
        drawToCanvas(src);
      })
      .catch((e) => {
        if ((e as DOMException)?.name !== "AbortError") {
          console.error("[PreviewPlayer] render failed:", e);
          setError(String((e as Error)?.message ?? e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFetching(false);
      });

    return () => controller.abort();
  }, [currentFrame, bbox, params, drawToCanvas]);


  const preloadAll = useCallback(async () => {
    const controller = new AbortController();
    preloadAbortRef.current = controller;
    setPreloading(true);
    setPreloadDone(0);
    setError(null);

    try {
      if (logoLoadingRef.current) await logoLoadingRef.current;

      let done = 0;
      for (const frame of frames) {
        if (controller.signal.aborted) return;

        if (!cacheRef.current.has(frame.epoch)) {
          const src = await renderEpochFrame(
            config.apiPrefix,
            config.datasetUrl,
            bbox,
            params,
            frame.epoch,
            controller.signal,
          );
          try {
            drawOverlay(src.getContext("2d")!, { frame, params, logo: logoRef.current });
          } catch (e) {
            console.error("[PreviewPlayer] drawOverlay failed:", e);
          }
          cacheRef.current.set(frame.epoch, src);
        }
        done++;
        setPreloadDone(done);
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        console.error("[PreviewPlayer] preload failed:", e);
        setError(String((e as Error)?.message ?? e));
      }
    } finally {
      if (!controller.signal.aborted) setPreloading(false);
    }
  }, [frames, bbox, params]);

  const handlePlayToggle = useCallback(async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const allCached = frames.every((f) => cacheRef.current.has(f.epoch));
    if (!allCached) {
      await preloadAll();
    }
    setPlaying(true);
  }, [playing, frames, preloadAll]);

  useEffect(() => {
    if (!playing || frames.length < 2 || fetching) return;
    const timeout = setTimeout(() => {
      setCurrentIdx((idx) => {
        const next = idx + 1;
        if (next >= frames.length) {
          setPlaying(false);
          return idx;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearTimeout(timeout);
  }, [playing, fps, frames.length, fetching, currentIdx]);

  if (!frames.length) {
    return (
      <div className="border-border text-muted-foreground flex min-h-[24rem] items-center justify-center rounded-lg border bg-black text-sm">
        Select a period to preview.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative min-h-[24rem]">
        <canvas
          ref={canvasRef}
          aria-label="WSF timeframe preview"
          className="border-border w-full rounded-lg border"
          style={{ minHeight: "24rem" }}
        />
        {preloading && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 text-sm">
            Loading frames… {preloadDone} / {frames.length}
          </div>
        )}
        {!preloading && fetching && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 text-sm">
            Rendering frame…
          </div>
        )}
        {error && (
          <div className="text-destructive absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black p-4 text-center text-xs break-all">
            <span>Preview failed:</span>
            <span className="text-muted-foreground">{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handlePlayToggle}
          disabled={frames.length < 2 || preloading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>

        <Slider
          min={0}
          max={frames.length - 1}
          value={currentIdx}
          onChange={(e) => {
            setPlaying(false);
            setCurrentIdx(Number(e.target.value));
          }}
        />

        <span className="text-text shrink-0 text-sm font-semibold tabular-nums">
          {currentFrame ? epochToSemesterLabel(currentFrame.epoch) : "—"}
        </span>
      </div>

      <div className="text-muted-foreground flex justify-between text-2xs">
        <span>{epochToSemesterLabel(frames[0].epoch)}</span>
        <span>
          {currentIdx + 1} / {frames.length}
        </span>
        <span>{epochToSemesterLabel(frames[frames.length - 1].epoch)}</span>
      </div>
    </div>
  );
}