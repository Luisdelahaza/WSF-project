import type { ApiPrefix, Bbox4326, Frame, WsfMetadata } from "@/types";
import { EPOCH } from "@/config/wsf";
import { infoUrl } from "@/lib/urlBuilder";

export class ApiError extends Error {
  constructor(
    message: string,
    public url: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * ✅ Worked example — fetch `/info` and surface errors with the requested URL,
 * status, and response body (ASSIGNMENT §6.2). The parsing of the payload is
 * left to you in `normalize` below.
 */
export async function fetchMetadata(
  prefix: ApiPrefix,
  datasetUrl: string,
  signal?: AbortSignal,
): Promise<WsfMetadata> {
  const url = infoUrl(prefix, datasetUrl);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`/info failed (${res.status})`, url, res.status, body);
  }
  const raw = await res.json();
  return normalize(raw);
}

/**
 * Normalize a TiTiler `/info` payload into `WsfMetadata` (provided — defensive
 * parsing so you don't have to). The geozarr payload nests each band under its
 * variable name (e.g. `payload.wsf_tracker`); `maxEpoch` comes from the band's
 * `attrs.valid_max`. The untouched payload is kept in `raw` for the debug panel.
 */
export function normalize(raw: unknown): WsfMetadata {
  const root = (raw ?? {}) as Record<string, unknown>;
  const isBand = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && ("dtype" in v || "bounds" in v);

  // geozarr nests bands under the variable name; fall back to the payload itself.
  const variables = Object.keys(root).filter((k) => isBand(root[k]));
  const band: Record<string, unknown> = variables.length ? (root[variables[0]] as never) : root;
  const attrs = (band.attrs ?? {}) as Record<string, unknown>;

  const num = (v: unknown): number | undefined =>
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : undefined;
  const bounds =
    Array.isArray(band.bounds) && band.bounds.length === 4 ? (band.bounds as Bbox4326) : undefined;

  return {
    crs: typeof band.crs === "string" ? band.crs : undefined,
    bounds,
    dtype: typeof band.dtype === "string" ? band.dtype : undefined,
    nodata: num(band.nodata) ?? null,
    variables,
    maxEpoch: num(attrs.valid_max),
    raw,
  };
}

const monthToSemester = (month: number) => (month <= 6 ? "H1" : "H2");

/**
 * Epoch index (pixel value, 1-based) → ISO date. Epoch 1 = 2016-07-01, then
 * +`monthsPerStep` per step (see EPOCH config).
 */
export function epochToDate(epoch: number): string {
  const monthIndex = EPOCH.baseMonth - 1 + (epoch - 1) * EPOCH.monthsPerStep;
  const year = EPOCH.baseYear + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Epoch → "2019 H2". */
export function epochToSemesterLabel(epoch: number): string {
  const iso = epochToDate(epoch);
  const [y, m] = iso.split("-").map(Number);
  return `${y} ${monthToSemester(m ?? 1)}`;
}

/** Available [minEpoch, maxEpoch] range (1-based). */
export function epochSpan(maxEpoch: number): [number, number] | null {
  if (!maxEpoch || maxEpoch < 1) return null;
  return [1, maxEpoch];
}

/** Resolve a [startEpoch, endEpoch] range to the frames (epochs) inside it. */
export function framesForEpochRange(maxEpoch: number, startEpoch: number, endEpoch: number): Frame[] {
  const frames: Frame[] = [];
  for (let epoch = Math.max(1, startEpoch); epoch <= Math.min(maxEpoch, endEpoch); epoch++) {
    const dateTime = epochToDate(epoch);
    frames.push({ epoch, dateTime, label: epochToSemesterLabel(epoch) });
  }
  return frames;
}
