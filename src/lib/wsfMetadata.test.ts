import { describe, it, expect } from "vitest";
import {
  normalize,
  epochToDate,
  epochToSemesterLabel,
  epochSpan,
  framesForEpochRange,
} from "@/lib/wsfMetadata";

// ── epochToDate ───────────────────────────────────────────────────────────

describe("epochToDate", () => {
  it("epoch 1 = base date 2016-07-01", () => {
    expect(epochToDate(1)).toBe("2016-07-01");
  });

  it("epoch 2 = +6 months = 2017-01-01", () => {
    expect(epochToDate(2)).toBe("2017-01-01");
  });

  it("epoch 3 = +12 months = 2017-07-01", () => {
    expect(epochToDate(3)).toBe("2017-07-01");
  });

  it("epoch 7 = 2019-07-01", () => {
    expect(epochToDate(7)).toBe("2019-07-01");
  });

  it("zero-pads single-digit months", () => {
    const date = epochToDate(2);
    expect(date.slice(5, 7)).toBe("01");
  });
});

// ── epochToSemesterLabel ──────────────────────────────────────────────────

describe("epochToSemesterLabel", () => {
  it("epoch 1 (July) = H2", () => {
    expect(epochToSemesterLabel(1)).toBe("2016 H2");
  });

  it("epoch 2 (January) = H1", () => {
    expect(epochToSemesterLabel(2)).toBe("2017 H1");
  });

  it("epoch 3 (July) = H2", () => {
    expect(epochToSemesterLabel(3)).toBe("2017 H2");
  });
});

// ── epochSpan ──────────────────────────────────────────────────────────────

describe("epochSpan", () => {
  it("returns [1, maxEpoch] for valid maxEpoch", () => {
    expect(epochSpan(20)).toEqual([1, 20]);
  });

  it("returns [1, 1] for maxEpoch = 1", () => {
    expect(epochSpan(1)).toEqual([1, 1]);
  });

  it("returns null for maxEpoch = 0", () => {
    expect(epochSpan(0)).toBeNull();
  });

  it("returns null for negative maxEpoch", () => {
    expect(epochSpan(-5)).toBeNull();
  });
});

// ── framesForEpochRange ───────────────────────────────────────────────────

describe("framesForEpochRange", () => {
  it("returns all epochs for full range", () => {
    const frames = framesForEpochRange(5, 1, 5);
    expect(frames).toHaveLength(5);
    expect(frames[0].epoch).toBe(1);
    expect(frames[4].epoch).toBe(5);
  });

  it("returns partial range", () => {
    const frames = framesForEpochRange(10, 3, 6);
    expect(frames).toHaveLength(4);
    expect(frames[0].epoch).toBe(3);
    expect(frames[3].epoch).toBe(6);
  });

  it("clamps start below 1", () => {
    const frames = framesForEpochRange(3, -5, 2);
    expect(frames).toHaveLength(2);
    expect(frames[0].epoch).toBe(1);
  });

  it("clamps end above maxEpoch", () => {
    const frames = framesForEpochRange(3, 1, 100);
    expect(frames).toHaveLength(3);
    expect(frames[2].epoch).toBe(3);
  });

  it("returns empty for start > end", () => {
    expect(framesForEpochRange(5, 4, 2)).toHaveLength(0);
  });

  it("each frame has correct dateTime and label", () => {
    const [frame] = framesForEpochRange(10, 1, 1);
    expect(frame.dateTime).toBe("2016-07-01");
    expect(frame.label).toBe("2016 H2");
  });
});

// ── normalize ──────────────────────────────────────────────────────────────

describe("normalize", () => {
  it("extracts nested geozarr band with valid_max", () => {
    const raw = {
      wsf_tracker: {
        dtype: "int8",
        crs: "EPSG:4326",
        nodata: 0,
        bounds: [-180, -90, 180, 90],
        attrs: { valid_max: 20 },
      },
    };
    const meta = normalize(raw);
    expect(meta.dtype).toBe("int8");
    expect(meta.crs).toBe("EPSG:4326");
    expect(meta.nodata).toBe(0);
    expect(meta.maxEpoch).toBe(20);
    expect(meta.variables).toEqual(["wsf_tracker"]);
    expect(meta.bounds).toEqual([-180, -90, 180, 90]);
    expect(meta.raw).toBe(raw);
  });

  it("handles string nodata/valid_max values", () => {
    const raw = {
      band: { dtype: "uint16", nodata: "0", attrs: { valid_max: "30" } },
    };
    const meta = normalize(raw);
    expect(meta.nodata).toBe(0);
    expect(meta.maxEpoch).toBe(30);
  });

  it("falls back to root object when no nested band", () => {
    const raw = { dtype: "float32", attrs: { valid_max: 15 } };
    const meta = normalize(raw);
    expect(meta.dtype).toBe("float32");
    expect(meta.maxEpoch).toBe(15);
    expect(meta.variables).toEqual([]);
  });

  it("handles null/undefined input gracefully", () => {
    const meta = normalize(null);
    expect(meta.dtype).toBeUndefined();
    expect(meta.maxEpoch).toBeUndefined();
    expect(meta.nodata).toBeNull();
    expect(meta.variables).toEqual([]);
  });

  it("handles empty object", () => {
    const meta = normalize({});
    expect(meta.maxEpoch).toBeUndefined();
    expect(meta.nodata).toBeNull();
  });

  it("returns undefined maxEpoch when attrs.valid_max missing", () => {
    const raw = { band: { dtype: "int8" } };
    expect(normalize(raw).maxEpoch).toBeUndefined();
  });
});
