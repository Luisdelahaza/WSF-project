import { describe, it, expect, vi, afterEach } from "vitest";
import { canVideoEncode, encodeVideo } from "@/lib/videoEncoder";
import type { CapturedFrame } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canVideoEncode", () => {
  it("returns false outside a browser environment (no `window` — e.g. this test runner)", () => {
    expect(canVideoEncode()).toBe(false);
  });

  it("returns true when WebCodecs' VideoEncoder is present", () => {
    vi.stubGlobal("window", { VideoEncoder: function () {} });
    expect(canVideoEncode()).toBe(true);
  });

  it("returns true when MediaRecorder + canvas.captureStream are both present", () => {
    vi.stubGlobal("window", { MediaRecorder: function () {} });
    vi.stubGlobal("HTMLCanvasElement", { prototype: { captureStream: () => {} } });
    expect(canVideoEncode()).toBe(true);
  });

  it("returns false when MediaRecorder exists but captureStream does not (older browser)", () => {
    vi.stubGlobal("window", { MediaRecorder: function () {} });
    vi.stubGlobal("HTMLCanvasElement", { prototype: {} });
    expect(canVideoEncode()).toBe(false);
  });
});

describe("encodeVideo", () => {
  function makeFrame(epoch: number): CapturedFrame {
    const ctx = {
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      })),
    };
    const canvas = { width: 4, height: 4, getContext: () => ctx } as unknown as HTMLCanvasElement;
    return { epoch, dateTime: "2016-07-01", label: `frame ${epoch}`, canvas };
  }

  function stubFlattenTargetDocument() {
    vi.stubGlobal("document", {
      createElement: () => {
        const ctx = {
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
          })),
        };
        return { width: 4, height: 4, getContext: () => ctx };
      },
    });
  }

  it("returns an empty webm-typed blob for an empty frame list, without touching any encoder", async () => {
    const blob = await encodeVideo([], 4);
    expect(blob.type).toBe("video/webm");
    expect(blob.size).toBe(0);
  });

  it(
    "falls back all the way to GIF when neither WebCodecs nor MediaRecorder " +
      "are available (exactly this Node test runner, and a reasonable stand-in for " +
      "an older/locked-down browser)",
    async () => {
      stubFlattenTargetDocument();
      const blob = await encodeVideo([makeFrame(1)], 4);
      expect(blob.type).toBe("image/gif");
    },
  );
});