import type { CapturedFrame } from "@/types";
import { encodeGif } from "@/lib/gifEncoder";
import { BACKDROP } from "@/config/colors";

function flatten(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d")!;
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

/**
 * Tier 1 — WebCodecs via Mediabunny's `CanvasSource`: frame-accurate WebM,
 * faster than realtime.
 */
async function encodeWithWebCodecs(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const { Output, WebMOutputFormat, BufferTarget, CanvasSource, Quality } = await import(
    "mediabunny"
  );

  const canvas = document.createElement("canvas");
  canvas.width = frames[0].canvas.width;
  canvas.height = frames[0].canvas.height;
  const ctx = canvas.getContext("2d")!;

  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: "vp9",
    // Constant-quality via VP9's quantizer (0-63, lower = higher quality)
    // instead of a fixed target bitrate. A flat bitrate number is a guess
    // that's wrong at every resolution/frame-count the export budget allows
    // (config/wsf.ts BUDGET) — too high for a short clip, too low for a
    // long one. Quantizer mode asks for a consistent quality level instead
    // and lets the encoder spend however many bits that actually costs.
    // 24 is a reasonably conservative pick for this content (flat colormap
    // fills + text/logo overlay, not photographic detail) — adjust down for
    // higher quality/larger files, up for smaller/lower quality.
    quality: new Quality({ quantizer: 24 }),
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  await output.start();

  const frameDuration = 1 / fps; // seconds — Mediabunny timestamps are in seconds, not µs
  let timestamp = 0;

  for (const frame of frames) {
    if (signal?.aborted) {
      // output.cancel() frees all resources the Output holds (encoders,
      // writer, etc.) — Mediabunny handles this cleanup for us.
      await output.cancel();
      throw new DOMException("Aborted", "AbortError");
    }

    const flat = flatten(frame.canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(flat, 0, 0);

    await videoSource.add(timestamp, frameDuration);
    timestamp += frameDuration;
  }

  videoSource.close();
  await output.finalize();

  return new Blob([output.target.buffer!], { type: "video/webm" });
}

/**
 * Tier 2 — `MediaRecorder` over `canvas.captureStream(0)`, pushing frames
 * manually (`track.requestFrame()`) and holding each one ~1000/fps ms.
 * Wall-clock timing (not frame-accurate), but works without WebCodecs.
 *
 * This tier exists for browsers that support `MediaRecorder` but not the
 * WebCodecs `VideoEncoder` API Tier 1 depends on — notably older Safari
 * (14.1–16.3), Firefox below ~130, and older Chromium builds.
 */
async function encodeWithMediaRecorder(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = frames[0].canvas.width;
  canvas.height = frames[0].canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

  // Stops the underlying MediaStreamTrack so the canvas capture doesn't
  // stay "live" after we're done with it — on abort, on error, and on
  // normal completion.
  const stopStream = () => stream.getTracks().forEach((t) => t.stop());

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stopStream();
      resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
    };
    recorder.onerror = (e) => {
      stopStream();
      reject(e);
    };
  });

  recorder.start();

  const frameDelayMs = 1000 / fps;
  for (const frame of frames) {
    if (signal?.aborted) {
      recorder.stop();
      stopStream();
      throw new DOMException("Aborted", "AbortError");
    }
    const flat = flatten(frame.canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(flat, 0, 0);
    track.requestFrame();
    await new Promise((r) => setTimeout(r, frameDelayMs));
  }

  recorder.stop();
  return finished;
}

/**
 * Encode frames to video, entirely client-side, with graceful cross-browser
 * degradation: WebCodecs via Mediabunny (frame-accurate) -> MediaRecorder
 * (wall-clock) -> GIF (universal fallback). Cancellable via `signal`.
 */
export async function encodeVideo(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!frames.length) return new Blob([], { type: "video/webm" });

  // Guards fps <= 0. Without this: encodeWithWebCodecs's frame duration
  // becomes Infinity, `new VideoFrame(..., { duration: Infinity })` throws,
  // and we'd drop to Tier 2 where `setTimeout(fn, Infinity)` silently
  // coerces to 0 — a near-zero-length "video" with no visible error.
  const safeFps = Math.max(1, fps);

  if (typeof window !== "undefined" && typeof window.VideoEncoder !== "undefined") {
    try {
      return await encodeWithWebCodecs(frames, safeFps, signal);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
      console.warn("[encodeVideo] WebCodecs path failed, falling back:", e);
    }
  }

  if (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  ) {
    try {
      return await encodeWithMediaRecorder(frames, safeFps, signal);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
      console.warn("[encodeVideo] MediaRecorder path failed, falling back to GIF:", e);
    }
  }

  return encodeGif(frames, safeFps, { signal });
}

/**
 * Whether any client-side video encoder is available in this browser. The UI
 * should default to GIF (and hide/disable the video option) when this is false.
 */
export function canVideoEncode(): boolean {
  if (typeof window === "undefined") return false;
  const hasWebCodecs = typeof window.VideoEncoder !== "undefined";
  const hasMediaRecorder =
    typeof window.MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";
  return hasWebCodecs || hasMediaRecorder;
}