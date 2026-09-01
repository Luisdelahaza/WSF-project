import type { ApiPrefix, RenderParams } from "@/types";
import { tileUrl } from "@/lib/urlBuilder";
import { ApiError } from "@/lib/wsfMetadata";

/**
 * ✅ Worked example — fetch a single {z}/{x}/{y} tile for one frame and decode
 * it into an ImageBitmap. `maxValue` is the frame's epoch (the rangefilter
 * ceiling). This depends on `tileUrl` (which you implement in urlBuilder.ts),
 * so it starts working once that is done.
 *
 * A full-extent frame is several of these composited together — see
 * `captureFrames` (frameCapture.ts).
 */
export async function fetchTile(
  prefix: ApiPrefix,
  datasetUrl: string,
  params: RenderParams,
  z: number,
  x: number,
  y: number,
  maxValue: number,
  signal?: AbortSignal,
): Promise<ImageBitmap> {
  const url = tileUrl(prefix, datasetUrl, params, z, x, y, maxValue);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`tile ${z}/${x}/${y} failed (${res.status})`, url, res.status, body);
  }
  const blob = await res.blob();
  return createImageBitmap(blob);
}
