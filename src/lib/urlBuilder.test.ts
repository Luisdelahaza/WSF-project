import { describe, it, expect } from "vitest";
import { infoUrl, tileUrl } from "@/lib/urlBuilder";
import { DEFAULT_RENDER_PARAMS } from "@/config/wsf";
import type { RenderParams } from "@/types";

const DATASET = "s3://wsf-platform/data/layers/test.zarr";
const PARAMS: RenderParams = { ...DEFAULT_RENDER_PARAMS };

describe("infoUrl", () => {
  it("builds the geozarr /info endpoint with the dataset as url param", () => {
    const url = infoUrl("geozarr", DATASET);
    expect(url).toContain("/geozarr/info?");
    expect(url).toContain(`url=${encodeURIComponent(DATASET)}`);
  });

  it("strips trailing slash from the titiler base", () => {
    const url = infoUrl("md", DATASET);
    expect(url).not.toContain("//md/");
  });

  it("uses the correct prefix segment", () => {
    expect(infoUrl("cog", DATASET)).toContain("/cog/info?");
  });
});

describe("tileUrl", () => {
  it("builds a WebMercatorQuad tile path with z/x/y", () => {
    const url = tileUrl("geozarr", DATASET, PARAMS, 5, 10, 15, 3);
    expect(url).toContain("/tiles/WebMercatorQuad/5/10/15@1x?");
  });

  it("includes the rangefilter algorithm with min/max value", () => {
    const url = tileUrl("geozarr", DATASET, PARAMS, 0, 0, 0, 7);
    expect(url).toContain("algorithm=rangefilter");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('"max_value":7');
    expect(decoded).toContain('"min_value":1');
  });

  it("sends colormap as JSON string, not colormap_name", () => {
    const url = tileUrl("geozarr", DATASET, PARAMS, 0, 0, 0, 1);
    expect(url).toContain("colormap=");
    expect(url).not.toContain("colormap_name");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('"0":"#000000"');
  });

  it("sends rescale as min,max pair", () => {
    const params: RenderParams = { ...PARAMS, rescale: [5, 25] };
    const url = tileUrl("geozarr", DATASET, params, 0, 0, 0, 1);
    expect(url).toContain("rescale=5%2C25");
  });

  it("uses variables key for geozarr prefix", () => {
    const url = tileUrl("geozarr", DATASET, PARAMS, 0, 0, 0, 1);
    expect(url).toContain("variables=wsf_tracker");
  });

  it("uses variable key for md prefix", () => {
    const url = tileUrl("md", DATASET, PARAMS, 0, 0, 0, 1);
    expect(url).toContain("variable=wsf_tracker");
    expect(url).not.toContain("variables=");
  });

  it("omits variable key for cog prefix", () => {
    const url = tileUrl("cog", DATASET, PARAMS, 0, 0, 0, 1);
    expect(url).not.toContain("variable=");
    expect(url).not.toContain("variables=");
  });
});
