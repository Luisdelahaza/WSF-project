import type { CapturedFrame } from "@/types";
import { encodeGif } from "@/lib/gifEncoder";


const BACKDROP = "#1a1a2e";

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


async function encodeWithWebCodecs(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import("webm-muxer");

  const width = frames[0].canvas.width;
  const height = frames[0].canvas.height;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "V_VP9", width, height, frameRate: fps },
  });

  let encoderError: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
    },
  });
  videoEncoder.configure({
    codec: "vp09.00.10.08",
    width,
    height,
    bitrate: 4_000_000,
    framerate: fps,
  });

  const frameDurationUs = Math.round(1_000_000 / fps);
  let timestamp = 0;

  for (const frame of frames) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (encoderError) throw encoderError;

    const canvas = flatten(frame.canvas);
    const videoFrame = new VideoFrame(canvas, { timestamp, duration: frameDurationUs });
    videoEncoder.encode(videoFrame);
    videoFrame.close();
    timestamp += frameDurationUs;
  }

  await videoEncoder.flush();
  videoEncoder.close();
  if (encoderError) throw encoderError;

  muxer.finalize();
  return new Blob([target.buffer], { type: "video/webm" });
}


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

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (t) => MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  const frameDelayMs = 1000 / fps;
  for (const frame of frames) {
    if (signal?.aborted) {
      recorder.stop();
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


export async function encodeVideo(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!frames.length) return new Blob([], { type: "video/webm" });

  if (typeof window !== "undefined" && typeof window.VideoEncoder !== "undefined") {
    try {
      return await encodeWithWebCodecs(frames, fps, signal);
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
      return await encodeWithMediaRecorder(frames, fps, signal);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
      console.warn("[encodeVideo] MediaRecorder path failed, falling back to GIF:", e);
    }
  }

  return encodeGif(frames, fps);
}


export function canVideoEncode(): boolean {
  if (typeof window === "undefined") return false;
  const hasWebCodecs = typeof window.VideoEncoder !== "undefined";
  const hasMediaRecorder =
    typeof window.MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";
  return hasWebCodecs || hasMediaRecorder;
}