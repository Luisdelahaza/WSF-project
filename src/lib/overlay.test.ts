import { describe, it, expect, vi } from "vitest";
import { loadLogo, drawOverlay } from "@/lib/overlay";
import type { Frame, RenderParams } from "@/types";

const params: RenderParams = {
  variable: "wsf_tracker",
  colormap: { "1": "#000000" },
  rescale: [1, 20],
  nodata: 0,
  width: 768,
  height: 768,
};

const frame: Frame = {
  epoch: 1,
  dateTime: "2016-07-01",
  label: "2016 H2",
};

function createFakeCtx(width: number, height: number) {
  const calls = { fillText: [] as string[], drawImage: 0, fillRect: 0 };
  const ctx = {
    canvas: { width, height },
    fillStyle: "",
    font: "",
    shadowColor: "",
    shadowBlur: 0,
    textBaseline: "alphabetic",
    save: vi.fn(),
    restore: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    fillRect: vi.fn(() => calls.fillRect++),
    fillText: vi.fn((text: string) => calls.fillText.push(text)),
    drawImage: vi.fn(() => calls.drawImage++),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("loadLogo", () => {
  it("resolves to null when `Image` is unavailable (Node/SSR)", async () => {
    const logo = await loadLogo();
    expect(logo).toBeNull();
  });

  it("never rejects, regardless of src", async () => {
    await expect(loadLogo("/does/not/exist.png")).resolves.toBeNull();
  });
});

describe("drawOverlay", () => {
  it("draws the semester label text", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    drawOverlay(ctx, { frame, params, logo: null });
    expect(calls.fillText).toContain("2016 H2");
  });

  it("draws a caption with the variable name", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    drawOverlay(ctx, { frame, params, logo: null });
    expect(calls.fillText.some((t) => t.includes("wsf_tracker"))).toBe(true);
  });

  it("draws the default attribution line", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    drawOverlay(ctx, { frame, params, logo: null });
    expect(calls.fillText.some((t) => t.includes("MindEarth"))).toBe(true);
  });

  it("honors a custom attribution string", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    drawOverlay(ctx, { frame, params, logo: null, attribution: "Custom attribution" });
    expect(calls.fillText).toContain("Custom attribution");
  });

  it("skips the logo when none is available", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    drawOverlay(ctx, { frame, params, logo: null });
    expect(calls.drawImage).toBe(0);
  });

  it("draws the logo when one is loaded", () => {
    const { ctx, calls } = createFakeCtx(768, 768);
    const logo = { naturalWidth: 200, naturalHeight: 50 } as unknown as HTMLImageElement;
    drawOverlay(ctx, { frame, params, logo });
    expect(calls.drawImage).toBeGreaterThan(0);
  });

  it("does not throw on a very small canvas", () => {
    const { ctx } = createFakeCtx(32, 32);
    expect(() => drawOverlay(ctx, { frame, params, logo: null })).not.toThrow();
  });

  it("does not throw on a large, high-resolution canvas", () => {
    const { ctx } = createFakeCtx(4096, 4096);
    expect(() => drawOverlay(ctx, { frame, params, logo: null })).not.toThrow();
  });
});