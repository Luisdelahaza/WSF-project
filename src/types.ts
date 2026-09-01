export type ApiPrefix = "geozarr" | "md" | "cog";
export type ExportFormat = "gif" | "webm";

/** Geographic bounding box in EPSG:4326, [west, south, east, north]. */
export type Bbox4326 = [number, number, number, number];

export interface RenderParams {
  variable: string;
  /**
   * Explicit value→hex colormap (the platform's fixed WSF ramp). Sent as the
   * TiTiler `colormap=<json>` param. NOT a `colormap_name` — this dataset uses
   * an explicit ramp. Fixed in the UI, never a picker.
   */
  colormap: Record<string, string>;
  /** [min, max] stretch applied before the colormap (the epoch value range). */
  rescale: [number, number];
  nodata: number;
  /** Output pixel size per frame. */
  width: number;
  height: number;
}

/** Normalized subset of a TiTiler `/info` response. */
export interface WsfMetadata {
  crs?: string;
  /** [west, south, east, north] in EPSG:4326 when available. */
  bounds?: Bbox4326;
  dtype?: string;
  nodata?: number | null;
  variables: string[];
  /**
   * Highest valid pixel value = the latest epoch index. This dataset has NO
   * time dimension; the pixel *value* (1..maxEpoch) encodes the semester, so
   * the number of frames comes from this, not from time-coordinate values.
   */
  maxEpoch?: number;
  /** Untouched response for the debug panel. */
  raw: unknown;
}

/**
 * One epoch (semester) selected for the animation. The "time axis" is the pixel
 * value, surfaced as the rangefilter ceiling for the frame.
 */
export interface Frame {
  /** Epoch index = pixel value, 1-based. The rangefilter `max_value`. */
  epoch: number;
  /** ISO date the epoch maps to, e.g. "2019-07-01". */
  dateTime: string;
  /** Human label, e.g. "2019 H2". */
  label: string;
}

export interface CapturedFrame extends Frame {
  /** Composited frame (raster + overlay), ready to encode. */
  canvas: HTMLCanvasElement;
}

export interface ExportBudget {
  totalFrames: number;
  pixelsPerFrame: number;
  estimatedServerBytesPerFrame: number;
  ok: boolean;
  warnings: string[];
}
