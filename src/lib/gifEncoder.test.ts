import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encodeGif } from "@/lib/gifEncoder";
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
    "paints the WSF navy backdrop before compositing each frame " +
      "(regression test: transparent nodata pixels must not become solid black)",
    async () => {
      const { canvas: source } = makeFakeCanvas(4, 4);
      await encodeGif([makeFrame(1, source)], 4);

      expect(createdFlattenCanvases).toHaveLength(1);
      const flat = createdFlattenCanvases[0].ctx;

      expect(flat.fillStyle).toBe("#1a1a2e");
      expect(flat.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
      expect(flat.drawImage).toHaveBeenCalledWith(source, 0, 0);
    },
  );

  it("reuses a single flattened scratch canvas across every frame, drawing them in order", async () => {
    const { canvas: c1 } = makeFakeCanvas(4, 4);
    const { canvas: c2 } = makeFakeCanvas(4, 4);
    const { canvas: c3 } = makeFakeCanvas(4, 4);
    await encodeGif([makeFrame(1, c1), makeFrame(2, c2), makeFrame(3, c3)], 4);

    // ONE scratch canvas is created and reused for all 3 frames (not one
    // per frame) — see createFlattener() in gifEncoder.ts.
    expect(createdFlattenCanvases).toHaveLength(1);
    const drawCalls = createdFlattenCanvases[0].ctx.drawImage.mock.calls;
    expect(drawCalls).toEqual([
      [c1, 0, 0],
      [c2, 0, 0],
      [c3, 0, 0],
    ]);
  });
});