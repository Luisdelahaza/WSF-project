import type { Frame, RenderParams } from "@/types";
import { WSF_COLORMAP_LABEL } from "@/config/wsf";

export interface OverlayOptions {
  frame: Frame;
  params: RenderParams;
  logo: HTMLImageElement | null;
  attribution?: string;
}


export function loadLogo(src = "/logos/ME-logo-white.png"): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}


export function drawOverlay(ctx: CanvasRenderingContext2D, opts: OverlayOptions): void {
  const { frame, params, logo } = opts;
  const attribution = opts.attribution ?? "World Settlement Footprint · © MindEarth";

  const canvas = ctx.canvas;
  const scale = Math.max(canvas.width, canvas.height) / 768; // reference size = 768px

  const pad = Math.round(16 * scale);
  const labelSize = Math.round(28 * scale);
  const captionSize = Math.round(14 * scale);
  const attributionSize = Math.round(12 * scale);
  const lineGap = Math.round(6 * scale);

  ctx.save();

  
  const captionText = `${params.variable} · ${WSF_COLORMAP_LABEL} colormap · rescale ${params.rescale[0]}–${params.rescale[1]}`;

  ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
  const labelWidth = ctx.measureText(frame.label).width;
  ctx.font = `${captionSize}px system-ui, sans-serif`;
  const captionWidth = ctx.measureText(captionText).width;

  const plateWidth = Math.min(canvas.width - pad * 2, Math.max(labelWidth, captionWidth) + pad * 2);
  const plateHeight = labelSize + captionSize + lineGap + pad * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(pad, pad, plateWidth, plateHeight);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 2 * scale;
  ctx.textBaseline = "top";

  ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
  ctx.fillText(frame.label, pad * 2, pad * 1.5);

  ctx.font = `${captionSize}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(captionText, pad * 2, pad * 1.5 + labelSize + lineGap);

  ctx.shadowBlur = 0;

  // --- Bottom-left attribution --------------------------------------------
  ctx.font = `${attributionSize}px system-ui, sans-serif`;
  const attrWidth = ctx.measureText(attribution).width;
  const attrPlateH = attributionSize + Math.round(pad * 0.6);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(pad, canvas.height - pad - attrPlateH, attrWidth + pad, attrPlateH);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 2 * scale;
  ctx.fillText(attribution, pad * 1.5, canvas.height - pad - attrPlateH + Math.round(pad * 0.3));
  ctx.shadowBlur = 0;

  // --- Bottom-right logo ---------------------------------------------------
  if (logo && logo.naturalWidth > 0) {
    const targetH = Math.round(32 * scale);
    const targetW = Math.round((logo.naturalWidth / logo.naturalHeight) * targetH);
    const x = canvas.width - pad - targetW;
    const y = canvas.height - pad - targetH;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(
      x - Math.round(8 * scale),
      y - Math.round(8 * scale),
      targetW + Math.round(16 * scale),
      targetH + Math.round(16 * scale),
    );
    ctx.drawImage(logo, x, y, targetW, targetH);
  }

  ctx.restore();
}