import { describe, it, expect } from "vitest";
import { computeBudget } from "@/lib/exportBudget";
import { DEFAULT_RENDER_PARAMS } from "@/config/wsf";
import type { RenderParams, WsfMetadata } from "@/types";

const PARAMS: RenderParams = { ...DEFAULT_RENDER_PARAMS };
const META: WsfMetadata = { variables: ["wsf_tracker"], dtype: "int8", nodata: 0, raw: {} };

describe("computeBudget", () => {
  it("computes frame count and pixel dimensions", () => {
    const budget = computeBudget(PARAMS, 10, META);
    expect(budget.totalFrames).toBe(10);
    expect(budget.pixelsPerFrame).toBe(768 * 768);
  });

  it("is ok within safe limits", () => {
    const budget = computeBudget(PARAMS, 10, META);
    expect(budget.ok).toBe(true);
    expect(budget.warnings).toHaveLength(0);
  });

  it("warns when frame count exceeds MAX_FRAMES", () => {
    const budget = computeBudget(PARAMS, 100, META);
    expect(budget.ok).toBe(false);
    expect(budget.warnings.some((w) => w.includes("60-frame guideline"))).toBe(true);
  });

  it("warns when pixels exceed MAX_FRAME_PIXELS", () => {
    const big: RenderParams = { ...PARAMS, width: 2048, height: 2048 };
    const budget = computeBudget(big, 1, META);
    expect(budget.ok).toBe(false);
    expect(budget.warnings.some((w) => w.includes("Frame is large"))).toBe(true);
  });

  it("estimates server bytes using dtype and read overhead", () => {
    const budget = computeBudget(PARAMS, 1, META);
    const expected = 768 * 768 * 1 * 6;
    expect(budget.estimatedServerBytesPerFrame).toBe(expected);
  });

  it("uses fallback dtype bytes when meta is undefined", () => {
    const budget = computeBudget(PARAMS, 1);
    const expected = 768 * 768 * 4 * 6;
    expect(budget.estimatedServerBytesPerFrame).toBe(expected);
  });
});
