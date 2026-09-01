import { GIFEncoder, applyPalette } from "gifenc";
import type { CapturedFrame } from "@/types";
import type { CaptureCallbacks } from "@/lib/frameCapture";
import { BACKDROP } from "@/config/colors";
import { WSF_COLORMAP } from "@/config/wsf";

const GIF_FORMAT = "rgb444" as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The GIF palette is knowable ahead of time — no quantize() pass needed at
 * all. See the comment in the previous version of this file for the full
 * rationale (WSF_COLORMAP is fixed, BACKDROP + white/black/grey cover the
 * overlay). This is a deliberate approximation of the overlay's blended
 * edges — worth a visual check on an exported GIF.
 */
const PALETTE: number[][] = [
  ...Object.values(WSF_COLORMAP).map(hexToRgb),
  hexToRgb(BACKDROP),
  [255, 255, 255],
  [0, 0, 0],
  [128, 128, 128],
];

type Flatten = (canvas: HTMLCanvasElement) => ImageData;

/**
 * Returns a `flatten` function that reuses ONE scratch canvas across every
 * frame passed to it, instead of allocating a new canvas per frame — but
 * scoped to a single `createFlattener()` call (i.e. one `encodeGif()` call),
 * not shared globally across the whole module. A module-level singleton
 * would leak the same canvas across unrelated exports (or tests) — two
 * exports running back to back could stomp on each other's in-flight frame.
 */
function createFlattener(): Flatten {
  let scratch: HTMLCanvasElement | null = null;

  return function flatten(canvas: HTMLCanvasElement): ImageData {
    if (!scratch) {
      scratch = document.createElement("canvas");
    }
    if (scratch.width !== canvas.width || scratch.height !== canvas.height) {
      scratch.width = canvas.width;
      scratch.height = canvas.height;
    }
    const ctx = scratch.getContext("2d")!;
    // fillRect always fully repaints the opaque backdrop, so resizing
    // (which clears the canvas) or reusing it (which leaves old pixels
    // behind) are both safe here.
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, scratch.width, scratch.height);
    ctx.drawImage(canvas, 0, 0);
    return ctx.getImageData(0, 0, scratch.width, scratch.height);
  };
}

async function encodeGifOnMainThread(
  frames: CapturedFrame[],
  delay: number,
  cb: CaptureCallbacks,
  flatten: Flatten,
): Promise<Blob> {
  const gif = GIFEncoder();
  let done = 0;

  for (const frame of frames) {
    if (cb.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const { data, width, height } = flatten(frame.canvas);
    const index = applyPalette(data, PALETTE, GIF_FORMAT);
    gif.writeFrame(index, width, height, { palette: PALETTE, delay });

    done++;
    cb.onProgress?.(done, frames.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

async function encodeGifInWorker(
  frames: CapturedFrame[],
  delay: number,
  cb: CaptureCallbacks,
  flatten: Flatten,
): Promise<Blob> {
  const worker = new Worker(new URL("./gifEncoder.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      cb.signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      worker.terminate();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const onError = (e: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      worker.terminate();
      reject(e.error ?? new Error(e.message));
    };

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type === "progress") {
        cb.onProgress?.(msg.done, frames.length);
      } else if (msg?.type === "done") {
        if (settled) return;
        settled = true;
        cleanup();
        worker.terminate();
        resolve(new Blob([msg.bytes], { type: "image/gif" }));
      } else if (msg?.type === "error") {
        if (settled) return;
        settled = true;
        cleanup();
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    cb.signal?.addEventListener("abort", onAbort);

    if (cb.signal?.aborted) {
      onAbort();
      return;
    }

    worker.postMessage({ type: "start", palette: PALETTE, format: GIF_FORMAT });

    for (const frame of frames) {
      if (settled) return;
      const { data, width, height } = flatten(frame.canvas);
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      worker.postMessage({ type: "frame", data: buffer, width, height, delay }, [buffer]);
    }
    if (!settled) worker.postMessage({ type: "finish" });
  });
}

/**
 * Encode composited frames into an animated GIF, entirely client-side using
 * `gifenc`. Offloads to a Worker when available, falling back to a
 * yielding main-thread loop otherwise. Cancellable via `cb.signal`; reports
 * progress via `cb.onProgress`.
 */
export async function encodeGif(
  frames: CapturedFrame[],
  fps: number,
  cb: CaptureCallbacks = {},
): Promise<Blob> {
  if (!frames.length) {
    return new Blob([], { type: "image/gif" });
  }

  const safeFps = Math.max(1, fps);
  const delay = Math.max(20, Math.round(1000 / safeFps));
  const flatten = createFlattener();

  if (typeof Worker !== "undefined") {
    try {
      return await encodeGifInWorker(frames, delay, cb, flatten);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
      console.warn("[encodeGif] Worker path failed, falling back to main thread:", e);
    }
  }

  return encodeGifOnMainThread(frames, delay, cb, flatten);
}