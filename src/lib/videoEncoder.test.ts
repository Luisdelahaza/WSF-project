import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { canVideoEncode, encodeVideo } from "@/lib/videoEncoder";
import type { CapturedFrame } from "@/types";


const mediabunnyMocks = vi.hoisted(() => ({
  state: {
    outputInstances: [] as any[],
    canvasSourceInstances: [] as any[],
    failNextStart: null as Error | null,
    onCanvasSourceAdd: null as (() => void) | null,
  },
}));

vi.mock("mediabunny", () => {
  class FakeQuality {
    constructor(public opts: Record<string, unknown>) {}
  }
  class FakeWebMOutputFormat {}
  class FakeBufferTarget {
    buffer: ArrayBuffer | null = null;
  }
  class FakeCanvasSource {
    codec: string;
    quality: FakeQuality;
    closed = false;
    constructor(_canvas: unknown, opts: { codec: string; quality: FakeQuality }) {
      this.codec = opts.codec;
      this.quality = opts.quality;
      mediabunnyMocks.state.canvasSourceInstances.push(this);
    }
    async add(_timestamp: number, _duration: number) {
      mediabunnyMocks.state.onCanvasSourceAdd?.();
    }
    close() {
      this.closed = true;
    }
  }
  class FakeOutput {
    target: FakeBufferTarget;
    started = false;
    finalized = false;
    canceled = false;
    constructor(opts: { target: FakeBufferTarget }) {
      this.target = opts.target;
      mediabunnyMocks.state.outputInstances.push(this);
    }
    addVideoTrack(_source: unknown, _opts: unknown) {}
    async start() {
      if (mediabunnyMocks.state.failNextStart) {
        const err = mediabunnyMocks.state.failNextStart;
        mediabunnyMocks.state.failNextStart = null;
        throw err;
      }
      this.started = true;
    }
    async finalize() {
      this.finalized = true;
      this.target.buffer = new ArrayBuffer(16);
    }
    async cancel() {
      this.canceled = true;
    }
  }

  return {
    Output: FakeOutput,
    WebMOutputFormat: FakeWebMOutputFormat,
    BufferTarget: FakeBufferTarget,
    CanvasSource: FakeCanvasSource,
    Quality: FakeQuality,
  };
});

let forceMediaRecorderStartError: Error | null = null;

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(
    public stream: unknown,
    public opts: unknown,
  ) {}
  start() {
    if (forceMediaRecorderStartError) {
      const err = forceMediaRecorderStartError;
      forceMediaRecorderStartError = null;
      throw err;
    }
  }
  stop() {
    this.ondataavailable?.({ data: { size: 1 } });
    this.onstop?.();
  }
}

function makeFakeStream() {
  const track = { requestFrame: vi.fn(), stop: vi.fn() };
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  };
  return { stream, track };
}

function makeFrame(epoch: number): CapturedFrame {
  const ctx = {
    fillStyle: "",
    fillRect: vi.fn(),
    clearRect: vi.fn(),
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

function stubDocumentForVideo(captureStreamReturn: unknown) {
  vi.stubGlobal("document", {
    createElement: () => {
      const ctx = {
        fillStyle: "",
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        })),
      };
      return {
        width: 4,
        height: 4,
        getContext: () => ctx,
        captureStream: () => captureStreamReturn,
      };
    },
  });
}

beforeEach(() => {
  mediabunnyMocks.state.outputInstances = [];
  mediabunnyMocks.state.canvasSourceInstances = [];
  mediabunnyMocks.state.failNextStart = null;
  mediabunnyMocks.state.onCanvasSourceAdd = null;
  forceMediaRecorderStartError = null;
});

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

describe("encodeVideo — empty input / total absence of any encoder", () => {
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
      stubDocumentForVideo(undefined);
      const blob = await encodeVideo([makeFrame(1)], 4);
      expect(blob.type).toBe("image/gif");
    },
  );
});

describe("encodeVideo — Tier 1 (WebCodecs via Mediabunny)", () => {
  it("encodes via CanvasSource, using a quantizer instead of a fixed bitrate", async () => {
    vi.stubGlobal("window", { VideoEncoder: function () {} });
    stubDocumentForVideo(undefined);

    const blob = await encodeVideo([makeFrame(1), makeFrame(2)], 4);

    expect(blob.type).toBe("video/webm");
    expect(mediabunnyMocks.state.outputInstances).toHaveLength(1);
    expect(mediabunnyMocks.state.outputInstances[0].started).toBe(true);
    expect(mediabunnyMocks.state.outputInstances[0].finalized).toBe(true);
    expect(mediabunnyMocks.state.canvasSourceInstances).toHaveLength(1);
    expect(mediabunnyMocks.state.canvasSourceInstances[0].codec).toBe("vp9");
  
    expect(mediabunnyMocks.state.canvasSourceInstances[0].quality.opts).toHaveProperty(
      "quantizer",
    );
    expect(mediabunnyMocks.state.canvasSourceInstances[0].quality.opts).not.toHaveProperty(
      "bitrate",
    );
  });

  it("cancels an in-progress export via signal mid-loop, cleaning up the Output (no leaked encoder)", async () => {
    vi.stubGlobal("window", { VideoEncoder: function () {} });
    stubDocumentForVideo(undefined);
    const controller = new AbortController();

    mediabunnyMocks.state.onCanvasSourceAdd = () => controller.abort();

    await expect(
      encodeVideo([makeFrame(1), makeFrame(2), makeFrame(3)], 4, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mediabunnyMocks.state.outputInstances[0].canceled).toBe(true);
    expect(mediabunnyMocks.state.outputInstances[0].finalized).toBe(false);
  });
});

describe("encodeVideo — tier degradation", () => {
  it("falls back to MediaRecorder (Tier 2) when the Mediabunny path throws", async () => {
    vi.stubGlobal("window", { VideoEncoder: function () {}, MediaRecorder: FakeMediaRecorder });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("HTMLCanvasElement", { prototype: { captureStream: () => {} } });
    const { stream, track } = makeFakeStream();
    stubDocumentForVideo(stream);
    mediabunnyMocks.state.failNextStart = new Error("mock Mediabunny failure");

       const blob = await encodeVideo([makeFrame(1)], 30);

    expect(blob.type.startsWith("video/webm")).toBe(true);
    expect(mediabunnyMocks.state.outputInstances[0].finalized).toBe(false);
    expect(track.requestFrame).toHaveBeenCalled(); });

  it("cancels an in-progress Tier 2 (MediaRecorder) export via signal, stopping the stream", async () => {
    vi.stubGlobal("window", { MediaRecorder: FakeMediaRecorder });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("HTMLCanvasElement", { prototype: { captureStream: () => {} } });
    const { stream, track } = makeFakeStream();
    stubDocumentForVideo(stream);
    const controller = new AbortController();

    const promise = encodeVideo([makeFrame(1), makeFrame(2), makeFrame(3)], 30, controller.signal);
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stop).toHaveBeenCalled();
  });

  it("falls back all the way to GIF when BOTH Tier 1 and Tier 2 throw (not just when both are absent)", async () => {
    vi.stubGlobal("window", { VideoEncoder: function () {}, MediaRecorder: FakeMediaRecorder });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("HTMLCanvasElement", { prototype: { captureStream: () => {} } });
    const { stream } = makeFakeStream();
    stubDocumentForVideo(stream);
    mediabunnyMocks.state.failNextStart = new Error("mock Mediabunny failure");
    forceMediaRecorderStartError = new Error("mock MediaRecorder failure");

    const blob = await encodeVideo([makeFrame(1)], 30);
    expect(blob.type).toBe("image/gif");
  });
});