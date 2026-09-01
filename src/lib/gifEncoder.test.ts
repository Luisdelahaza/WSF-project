import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encodeGif, gifDelayMs } from "@/lib/gifEncoder";
import type { CapturedFrame } from "@/types";

function makeFakeCanvas(width: number, height: number) {
  const ctx = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(90),
      width: w,
      height: h,
    })),
  };
  const canvas = {
    width,
    height,
    getContext: vi.fn(() => ctx),
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx };
}

function makeFrame(epoch: number, canvas: HTMLCanvasElement): CapturedFrame {
  return { epoch, dateTime: `2016-0${epoch}-01`, label: `frame ${epoch}`, canvas };
}

describe("gifDelayMs", () => {
  it("converts fps to a per-frame delay in milliseconds (1000 / fps, not 1000 * fps)", () => {

    expect(gifDelayMs(4)).toBe(250);
    expect(gifDelayMs(10)).toBe(100);
    expect(gifDelayMs(1)).toBe(1000);
  });

  it("clamps to the ~50fps practical ceiling (20ms floor) for high fps values", () => {
    expect(gifDelayMs(60)).toBe(20);
    expect(gifDelayMs(1000)).toBe(20);
  });
});

describe("encodeGif", () => {
  let createdFlattenCanvases: ReturnType<typeof makeFakeCanvas>[];

  beforeEach(() => {
    createdFlattenCanvases = [];
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag !== "canvas") throw new Error(`unexpected element: ${tag}`);
        const fake = makeFakeCanvas(4, 4);
        createdFlattenCanvases.push(fake);
        return fake.canvas;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty GIF-typed blob for an empty frame list", async () => {
    const blob = await encodeGif([], 4);
    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBe(0);
  });

  it("returns a non-empty GIF blob for one or more frames", async () => {
    const { canvas } = makeFakeCanvas(4, 4);
    const blob = await encodeGif([makeFrame(1, canvas)], 4);
    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("produces a real GIF file (starts with the GIF89a signature)", async () => {
    const { canvas } = makeFakeCanvas(4, 4);
    const blob = await encodeGif([makeFrame(1, canvas)], 4);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = String.fromCharCode(...bytes.slice(0, 6));
    expect(header).toBe("GIF89a");
  });

  it(
    "paints the WSF navy backdrop BEFORE compositing each frame " +
      "(regression test: transparent nodata pixels must not become solid black — " +
      "and specifically checks ORDER, not just that both calls happened, since " +
      "drawImage running before fillRect would paint over the frame instead of " +
      "only filling the nodata gaps)",
    async () => {
      const { canvas: source } = makeFakeCanvas(4, 4);
      await encodeGif([makeFrame(1, source)], 4);

      expect(createdFlattenCanvases).toHaveLength(1);
      const flat = createdFlattenCanvases[0].ctx;

      expect(flat.fillStyle).toBe("#1a1a2e");
      expect(flat.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
      expect(flat.drawImage).toHaveBeenCalledWith(source, 0, 0);
      expect(flat.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
        flat.drawImage.mock.invocationCallOrder[0],
      );
    },
  );

  it("reuses a single flattened scratch canvas across every frame, drawing them in order", async () => {
    const { canvas: c1 } = makeFakeCanvas(4, 4);
    const { canvas: c2 } = makeFakeCanvas(4, 4);
    const { canvas: c3 } = makeFakeCanvas(4, 4);
    await encodeGif([makeFrame(1, c1), makeFrame(2, c2), makeFrame(3, c3)], 4);

    expect(createdFlattenCanvases).toHaveLength(1);
    const drawCalls = createdFlattenCanvases[0].ctx.drawImage.mock.calls;
    expect(drawCalls).toEqual([
      [c1, 0, 0],
      [c2, 0, 0],
      [c3, 0, 0],
    ]);
  });
});