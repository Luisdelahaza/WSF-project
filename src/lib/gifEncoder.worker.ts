// @ts-nocheck
/**
 * GIF-encoding Worker: does the CPU-heavy per-frame work (nearest-color
 * palette mapping via `applyPalette`, LZW compression via `writeFrame`) off
 * the main thread, so the export UI (progress bar, Cancel button) stays
 * responsive. `gifenc` has no DOM dependency and is explicitly documented
 * as worker-safe. `flatten()` (which needs a real <canvas>/2D context)
 * stays on the main thread in gifEncoder.ts — only raw RGBA pixel buffers
 * are sent here, as transferred ArrayBuffers.
 *
 * `@ts-nocheck`: this file runs in a DedicatedWorkerGlobalScope, whose
 * `self`/`postMessage` typings conflict with the "dom" lib the rest of the
 * project uses. Properly separating them would need a second tsconfig
 * project just for this one file — skipped for now in favor of opting this
 * isolated file out of type-checking.
 */
import { GIFEncoder, applyPalette } from "gifenc";

let gif = null;
let palette = [];
let format = "rgb444";
let framesWritten = 0;

self.onmessage = (event) => {
  const msg = event.data;
  try {
    if (msg.type === "start") {
      gif = GIFEncoder();
      palette = msg.palette;
      format = msg.format;
      framesWritten = 0;
      return;
    }

    if (msg.type === "frame") {
      if (!gif) throw new Error("Received a frame before 'start'");
      const rgba = new Uint8ClampedArray(msg.data);
      const index = applyPalette(rgba, palette, format);
      gif.writeFrame(index, msg.width, msg.height, { palette, delay: msg.delay });
      framesWritten++;
      self.postMessage({ type: "progress", done: framesWritten });
      return;
    }

    if (msg.type === "finish") {
      if (!gif) throw new Error("Received 'finish' before 'start'");
      gif.finish();
      const bytes = gif.bytes();
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      self.postMessage({ type: "done", bytes: buffer }, [buffer]);
      gif = null;
      return;
    }
  } catch (e) {
    self.postMessage({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};