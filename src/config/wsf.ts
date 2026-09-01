import type { ApiPrefix, RenderParams } from "@/types";

/**
 * Defaults sourced from env, with safe fallbacks. Uses NEXT_PUBLIC_* so the
 * values are available in client components (matches wsf-platform conventions).
 *
 * Defaults point at the staging TiTiler (public read, CORS open — no local
 * Docker needed). Override via .env.local to use a local TiTiler.
 */
export const config = {
  titilerUrl: process.env.NEXT_PUBLIC_TITILER_URL ?? "https://d3nvi0df2mtlx1.cloudfront.net",
  datasetUrl:
    process.env.NEXT_PUBLIC_WSF_DATASET_URL ??
    "s3://wsf-platform/data/layers/World_WSF_20160701-20260101.zarr",
  apiPrefix: (process.env.NEXT_PUBLIC_WSF_API_PREFIX ?? "geozarr") as ApiPrefix,
  variable: process.env.NEXT_PUBLIC_WSF_VARIABLE ?? "wsf_tracker",
};

/** Tiling scheme + tile size for the bbox→tile math. */
export const TILE_MATRIX_SET = "WebMercatorQuad";
export const TILE_SIZE = 256;

/**
 * The WSF tracker has NO time dimension. The pixel *value* (1..N) encodes the
 * epoch (semester): 1 = 2016-07-01, 2 = 2017-01-01, 3 = 2017-07-01, … +6 months
 * per step. Value 0 = no built-up detected. Animation is produced by the
 * `rangefilter` algorithm, raising `max_value` from 1 to the chosen epoch
 * (cumulative settlement growth) — see ASSIGNMENT §4.2 / §5.
 */
export const EPOCH = {
  /** Epoch 1 maps to this year/month. */
  baseYear: 2016,
  baseMonth: 7,
  monthsPerStep: 6,
  /** TiTiler custom algorithm + its value bounds. */
  algorithm: "rangefilter",
  minValue: 1,
} as const;

/**
 * The platform renders the WSF layer with ONE fixed colormap: an explicit
 * value→hex ramp (black → dark red → red → orange → yellow), sent as the
 * TiTiler `colormap=<json>` param (NOT `colormap_name`). The UI shows this
 * read-only; it is never a picker. Label is for captions/overlay only.
 */
export const WSF_COLORMAP_LABEL = "hot";
export const WSF_COLORMAP: Record<string, string> = {
  "0": "#000000",
  "13": "#2a0000",
  "26": "#550000",
  "40": "#800000",
  "53": "#aa0000",
  "67": "#d40000",
  "80": "#ff0000",
  "93": "#ff1400",
  "107": "#ff2700",
  "120": "#ff3b00",
  "134": "#ff4e00",
  "147": "#ff6200",
  "161": "#ff7600",
  "174": "#ff8900",
  "187": "#ff9d00",
  "201": "#ffb100",
  "214": "#ffc400",
  "228": "#ffd800",
  "241": "#ffeb00",
  "255": "#ffff00",
};

export const DEFAULT_RENDER_PARAMS: RenderParams = {
  variable: config.variable,
  colormap: WSF_COLORMAP,
  rescale: [1, 20],
  nodata: 0,
  width: 768,
  height: 768,
};

/** Export-budget guardrails (protect the server; keep exports bounded). */
export const BUDGET = {
  MAX_FRAME_PIXELS: 1024 * 1024,
  MAX_FRAMES: 60,
  /** Safe peak read budget per request, in bytes. */
  SAFE_BUDGET_BYTES: 256 * 1024 * 1024,
  /** read amplification factor (decode + reproject overhead). */
  READ_OVERHEAD: 6,
  /** Used when dtype is unknown (WSF is int8 = 1 byte). */
  FALLBACK_DTYPE_BYTES: 4,
  /** Max simultaneous in-flight tile requests. */
  MAX_CONCURRENCY: 3,
} as const;

/**
 * GeoZarr expects `variables`, the multidim `/md` path expects `variable`.
 * COG has no variable concept.
 */
export function variableParamKey(prefix: ApiPrefix): "variable" | "variables" | null {
  if (prefix === "geozarr") return "variables";
  if (prefix === "md") return "variable";
  return null;
}

export function dtypeBytes(dtype: string | undefined): number {
  if (!dtype) return BUDGET.FALLBACK_DTYPE_BYTES;
  const m = dtype.match(/(\d+)/);
  if (!m) return BUDGET.FALLBACK_DTYPE_BYTES;
  return Math.max(1, Math.round(Number(m[1]) / 8));
}
