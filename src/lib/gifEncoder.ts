import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { CapturedFrame } from "@/types";


const BACKDROP = "#1a1a2e";

function flatten(canvas: HTMLCanvasElement): ImageData {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const fctx = flat.getContext("2d")!;
  fctx.fillStyle = BACKDROP;
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(canvas, 0, 0);
  return fctx.getImageData(0, 0, flat.width, flat.height);
}


export function encodeGif(frames: CapturedFrame[], fps: number): Blob {
  if (!frames.length) {
    return new Blob([], { type: "image/gif" });
  }

  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(1000 / fps)); // ~50fps practical ceiling for GIF

  for (const frame of frames) {
    const { data, width, height } = flatten(frame.canvas);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, width, height, { palette, delay });
  }

  gif.finish();

  return new Blob([gif.bytes()], { type: "image/gif" });
}