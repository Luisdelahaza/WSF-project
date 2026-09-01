import { describe, it, expect, vi, afterEach } from "vitest";
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
  const calls = {
    fillText: [] as string[],

    fontAtFillText: [] as string[],
    drawImage: 0,
    fillRect: [] as unknown[][],
  };
  const ctx: any = {
    canvas: { width, height },
    fillStyle: "",
    font: "",
    shadowColor: "",
    shadowBlur: 0,
    textBaseline: "alphabetic",
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn((...args: unknown[]) => calls.fillRect.push(args)),
    fillText: vi.fn((text: string) => {
      calls.fillText.push(text);
      calls.fontAtFillText.push(ctx.font);
    }),
    drawImage: vi.fn(() => calls.drawImage++),
  };

  ctx.measureText = vi.fn((text: string) => {
    const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
    const fontSize = match ? parseFloat(match[1]) : 16;
    return { width: text.length * fontSize * 0.6 };
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function stubImageGlobal(mode: "load" | "error") {
  const instances: Array<{ crossOrigin: string; crossOriginAtSrcAssign: string | null }> = [];

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin = "";
    crossOriginAtSrcAssign: string | null = null;
    private _src = "";

    constructor() {
      instances.push(this);
    }

    set src(value: string) {
      this._src = value;
  
      this.crossOriginAtSrcAssign = this.crossOrigin;
      queueMicrotask(() => {
        if (mode === "error") this.onerror?.();
        else this.onload?.();
      });
    }
    get src() {
      return this._src;
    }
  }

  vi.stubGlobal("Image", FakeImage);
  return instances;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadLogo", () => {
  it("resolves to null when `Image` is unavailable (Node/SSR)", async () => {
    const logo = await loadLogo();
    expect(logo).toBeNull();
  });

  it("resolves to null when the <img> fallback fires onerror (e.g. a missing/404 logo asset)", async () => {
    stubImageGlobal("error");
    const logo = await loadLogo("/does/not/exist.png");
    expect(logo).toBeNull();
  });

  it("resolves to the loaded image when the <img> fallback fires onload", async () => {
    stubImageGlobal("load");
    const logo = await loadLogo("/logos/ME-logo-white.png");
    expect(logo).not.toBeNull();
  });

  it(
    "sets crossOrigin on the fallback <img> BEFORE assigning src " +
      "(regression: avoids a tainted canvas if the logo is ever served cross-origin)",
    async () => {
      const instances = stubImageGlobal("load");
      await loadLogo("/logos/ME-logo-white.png");
      expect(instances).toHaveLength(1);
      expect(instances[0].crossOriginAtSrcAssign).toBe("anonymous");
    },
  );
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

  it("does not throw on a very wide, short canvas", () => {
    const { ctx } = createFakeCtx(1600, 400);
    expect(() => drawOverlay(ctx, { frame, params, logo: null })).not.toThrow();
  });

  it("does not throw on a very tall, narrow canvas", () => {
    const { ctx } = createFakeCtx(400, 1600);
    expect(() => drawOverlay(ctx, { frame, params, logo: null })).not.toThrow();
  });

  it(
    "scales the label text identically for a wide and a tall canvas that share the same " +
      "LIMITING dimension (regression: scale must be driven by Math.min(width, height), " +
      "not Math.max — a wide 1600×400 frame and a tall 400×1600 frame both have their " +
      "smaller side at 400, so the branding plate should come out the same size on both)",
    () => {
      const wide = createFakeCtx(1600, 400);
      const tall = createFakeCtx(400, 1600);
      drawOverlay(wide.ctx, { frame, params, logo: null });
      drawOverlay(tall.ctx, { frame, params, logo: null });

      const wideLabelFont = wide.calls.fontAtFillText[wide.calls.fillText.indexOf(frame.label)];
      const tallLabelFont = tall.calls.fontAtFillText[tall.calls.fillText.indexOf(frame.label)];

      expect(wideLabelFont).toBe(tallLabelFont);
    },
  );

  it("keeps the branding plate within the canvas width on a narrow, tall frame", () => {
    const { ctx, calls } = createFakeCtx(120, 1600);
    drawOverlay(ctx, { frame, params, logo: null });

  
    const [, , plateWidth] = calls.fillRect[0];
    expect(plateWidth as number).toBeLessThanOrEqual(120);
  });
});