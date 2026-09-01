// Minimal ambient types for the subset of `gifenc` we use.
declare module "gifenc" {
  export interface WriteFrameOpts {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    dispose?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOpts): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  }
  export function GIFEncoder(): GifEncoderInstance;

  export type GifPixelFormat = "rgb565" | "rgb444" | "rgba4444";

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: GifPixelFormat },
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: GifPixelFormat,
  ): Uint8Array;
}