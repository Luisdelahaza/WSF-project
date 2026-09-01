import type { ApiPrefix, Bbox4326, CapturedFrame, Frame, RenderParams } from "@/types";
import { BUDGET, TILE_SIZE } from "@/config/wsf";
import { fetchTile } from "@/lib/tileClient";
import { drawOverlay, loadLogo } from "@/lib/overlay";

export interface CaptureCallbacks {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

// --- WebMercator slippy-map math (provided) -------------------------------
// You don't need to touch any of this; it turns a lon/lat bbox into the tiles
// that cover it and composites them into one fixed-size frame.

export const lonToPixelX = (lon: number, z: number) => ((lon + 180) / 360) * TILE_SIZE * 2 ** z;
export const latToPixelY = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE * 2 ** z;
};

/** Highest zoom whose bbox width stays near the target output width (bounded). */
export function chooseZoom(bbox: Bbox4326, targetWidth: number, maxZoom = 12): number {
  let best = 0;
  for (let z = 0; z <= maxZoom; z++) {
    const px = Math.abs(lonToPixelX(bbox[2], z) - lonToPixelX(bbox[0], z));
    if (px > targetWidth * 1.5) break;
    best = z;
  }
  return best;
}

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

/**
 * Render one epoch as a full-extent frame by compositing the WebMercator tiles
 * covering the bbox, then cropping to the bbox at the requested output size.
 * `maxValue = epoch` (the rangefilter ceiling) gives cumulative growth.
 */
export async function renderEpochFrame(
  prefix: ApiPrefix,
  datasetUrl: string,
  bbox: Bbox4326,
  params: RenderParams,
  epoch: number,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const [w, s, e, n] = bbox;
  const z = chooseZoom(bbox, params.width);

  const px0 = lonToPixelX(w, z);
  const px1 = lonToPixelX(e, z);
  const py0 = latToPixelY(n, z); // north = top
  const py1 = latToPixelY(s, z);
  const tx0 = Math.floor(px0 / TILE_SIZE);
  const tx1 = Math.floor((px1 - 1) / TILE_SIZE);
  const ty0 = Math.floor(py0 / TILE_SIZE);
  const ty1 = Math.floor((py1 - 1) / TILE_SIZE);

  const grid = document.createElement("canvas");
  grid.width = (tx1 - tx0 + 1) * TILE_SIZE;
  grid.height = (ty1 - ty0 + 1) * TILE_SIZE;
  const gctx = grid.getContext("2d")!;

  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) tiles.push({ x, y });

  await runWithConcurrency(tiles, BUDGET.MAX_CONCURRENCY, async ({ x, y }) => {
    const bmp = await fetchTile(prefix, datasetUrl, params, z, x, y, epoch, signal);
    gctx.drawImage(bmp, (x - tx0) * TILE_SIZE, (y - ty0) * TILE_SIZE);
    bmp.close();
  });

  const out = document.createElement("canvas");
  out.width = params.width;
  out.height = params.height;
  out
    .getContext("2d")!
    .drawImage(grid, px0 - tx0 * TILE_SIZE, py0 - ty0 * TILE_SIZE, px1 - px0, py1 - py0, 0, 0, params.width, params.height);
  return out;
}

/**
 * Capture every selected epoch as a composited frame (provided). For each frame
 * it renders the tile mosaic, then calls your `drawOverlay` (overlay.ts) — which
 * is skipped gracefully until you implement it, so you can preview raw frames
 * first. Reports progress and is cancellable via `cb.signal`.
 */
export async function captureFrames(
  prefix: ApiPrefix,
  datasetUrl: string,
  bbox: Bbox4326,
  params: RenderParams,
  frames: Frame[],
  cb: CaptureCallbacks = {},
): Promise<CapturedFrame[]> {
  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadLogo();
  } catch {
    /* overlay not implemented yet — capture still works without a logo */
  }

  const out: CapturedFrame[] = [];
  let done = 0;
  for (const frame of frames) {
    if (cb.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const canvas = await renderEpochFrame(prefix, datasetUrl, bbox, params, frame.epoch, cb.signal);
    try {
      drawOverlay(canvas.getContext("2d")!, { frame, params, logo });
    } catch {
      /* drawOverlay not implemented yet — frame is still usable */
    }
    out.push({ ...frame, canvas });
    cb.onProgress?.(++done, frames.length);
  }
  return out;
}
