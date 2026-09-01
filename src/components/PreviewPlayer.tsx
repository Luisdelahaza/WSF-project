"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { Bbox4326, Frame, RenderParams } from "@/types";
import { config } from "@/config/wsf";
import { renderEpochFrame } from "@/lib/frameCapture";
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFrame = frames[currentIdx];

  const drawToCanvas = useCallback((src: HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0);
  }, []);

  // Invalidate cache when bbox or params change
  useEffect(() => {
    cacheRef.current.clear();
  }, [bbox, params]);

  // Clamp index when frame list shrinks
  useEffect(() => {
    if (currentIdx >= frames.length) {
      setCurrentIdx(Math.max(0, frames.length - 1));
      setPlaying(false);
    }
  }, [frames.length, currentIdx]);

  // Fetch + draw current frame
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
      .then((src) => {
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

  // Playback loop
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const interval = setInterval(() => {
      setCurrentIdx((idx) => {
        const next = idx + 1;
        if (next >= frames.length) {
          setPlaying(false);
          return idx;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [playing, fps, frames.length]);

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
        {fetching && (
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
          onClick={() => setPlaying((p) => !p)}
          disabled={frames.length < 2}
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
