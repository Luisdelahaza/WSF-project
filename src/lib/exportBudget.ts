import type { ExportBudget, RenderParams, WsfMetadata } from "@/types";
import { BUDGET, dtypeBytes } from "@/config/wsf";

/**
 * Estimate export cost and flag anything that could strain the server, while
 * still letting the user override (provided). The render budget is a simple
 * guardrail — frame size × frame count × read overhead.
 */
export function computeBudget(
  params: RenderParams,
  frameCount: number,
  meta?: WsfMetadata,
): ExportBudget {
  const pixelsPerFrame = params.width * params.height;
  const bytes = pixelsPerFrame * dtypeBytes(meta?.dtype) * BUDGET.READ_OVERHEAD;

  const warnings: string[] = [];
  if (pixelsPerFrame > BUDGET.MAX_FRAME_PIXELS) {
    warnings.push(`Frame is large (${pixelsPerFrame.toLocaleString()} px) — consider a smaller size.`);
  }
  if (frameCount > BUDGET.MAX_FRAMES) {
    warnings.push(`${frameCount} frames exceeds the ${BUDGET.MAX_FRAMES}-frame guideline.`);
  }
  if (bytes > BUDGET.SAFE_BUDGET_BYTES) {
    warnings.push(`~${Math.round(bytes / 1048576)} MB/request may strain the server.`);
  }

  return {
    totalFrames: frameCount,
    pixelsPerFrame,
    estimatedServerBytesPerFrame: bytes,
    ok: warnings.length === 0,
    warnings,
  };
}
