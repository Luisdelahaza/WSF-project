import type { ApiPrefix, RenderParams } from "@/types";
import { config, EPOCH, TILE_MATRIX_SET, variableParamKey } from "@/config/wsf";

/**
 * URL construction for the TiTiler endpoints used by the export tool. Both
 * helpers are provided (worked) — they encode the TiTiler-specific query params
 * for you so you don't have to learn them. They build the query with
 * URLSearchParams (never hand-concatenated) and are framework-free so they lift
 * straight into the wsf-platform frontend.
 */

function base(prefix: ApiPrefix): string {
  return `${config.titilerUrl.replace(/\/$/, "")}/${prefix}`;
}

/** `/info` metadata URL for a dataset. */
export function infoUrl(prefix: ApiPrefix, datasetUrl: string): string {
  const qs = new URLSearchParams({ url: datasetUrl });
  return `${base(prefix)}/info?${qs.toString()}`;
}

/**
 * Per-tile image URL for one frame. `maxValue` is the frame's epoch: the
 * `rangefilter` algorithm keeps values 1..maxValue, so raising it 1→N animates
 * cumulative settlement growth. The colormap is the explicit WSF ramp (sent as
 * `colormap=<json>`, not `colormap_name`).
 */
export function tileUrl(
  prefix: ApiPrefix,
  datasetUrl: string,
  params: RenderParams,
  z: number,
  x: number,
  y: number,
  maxValue: number,
): string {
  const qs = new URLSearchParams({ url: datasetUrl });
  const varKey = variableParamKey(prefix);
  if (varKey) qs.set(varKey, params.variable);
  qs.set("colormap", JSON.stringify(params.colormap));
  qs.set("rescale", `${params.rescale[0]},${params.rescale[1]}`);
  qs.set("nodata", String(params.nodata));
  qs.set("algorithm", EPOCH.algorithm);
  qs.set("algorithm_params", JSON.stringify({ min_value: EPOCH.minValue, max_value: maxValue }));
  return `${base(prefix)}/tiles/${TILE_MATRIX_SET}/${z}/${x}/${y}@1x?${qs.toString()}`;
}
