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

    quality: new Quality({ quantizer: 24 }),
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  await output.start();

  const frameDuration = 1 / fps; 
  let timestamp = 0;

  for (const frame of frames) {
    if (signal?.aborted) {
  
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


export async function encodeVideo(
  frames: CapturedFrame[],
  fps: number,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!frames.length) return new Blob([], { type: "video/webm" });


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


export function canVideoEncode(): boolean {
  if (typeof window === "undefined") return false;
  const hasWebCodecs = typeof window.VideoEncoder !== "undefined";
  const hasMediaRecorder =
    typeof window.MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";
  return hasWebCodecs || hasMediaRecorder;
}