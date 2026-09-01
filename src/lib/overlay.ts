import type { Frame, RenderParams } from "@/types";
import { WSF_COLORMAP_LABEL } from "@/config/wsf";


export type LogoImage = ImageBitmap | HTMLImageElement;

export interface OverlayOptions {
  frame: Frame;
  params: RenderParams;
  logo: LogoImage | null;
  attribution?: string;
}


const COLORS = {
  plateBackground: "rgba(0, 0, 0, 0.55)",
  labelText: "#ffffff",
  captionText: "rgba(255, 255, 255, 0.85)",
  attributionText: "rgba(255, 255, 255, 0.9)",
  textShadow: "rgba(0, 0, 0, 0.8)",
} as const;

const FONT_FAMILY = "system-ui, sans-serif";

const REFERENCE_SIZE = 768;

const BASE_PAD = 16;
const BASE_LABEL_SIZE = 28;
const BASE_CAPTION_SIZE = 14;
const BASE_ATTRIBUTION_SIZE = 12;
const BASE_LINE_GAP = 6;
const BASE_LOGO_HEIGHT = 32;
const BASE_SHADOW_BLUR = 2;

const LOGO_RESIZE_WIDTH = 110;



export async function loadLogo(
  src = "/logos/ME-logo-white.png",
  resizeWidth = LOGO_RESIZE_WIDTH,
): Promise<LogoImage | null> {

  if (typeof createImageBitmap !== "undefined" && typeof fetch !== "undefined") {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await createImageBitmap(blob, {
        resizeWidth,
        resizeQuality: "high",
      });
    } catch {
     
    }
  }


  if (typeof Image === "undefined") {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();

    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getLogoDimensions(logo: LogoImage): { width: number; height: number } {

  if ("naturalWidth" in logo) {
    return { width: logo.naturalWidth, height: logo.naturalHeight };
  }
  return { width: logo.width, height: logo.height };
}


export function drawOverlay(ctx: CanvasRenderingContext2D, opts: OverlayOptions): void {
  const { frame, params, logo } = opts;
  const attribution = opts.attribution ?? "World Settlement Footprint · © MindEarth";

  const canvas = ctx.canvas;

  const scale = Math.min(canvas.width, canvas.height) / REFERENCE_SIZE;

  const pad = Math.round(BASE_PAD * scale);
  const labelSize = Math.round(BASE_LABEL_SIZE * scale);
  const captionSize = Math.round(BASE_CAPTION_SIZE * scale);
  const attributionSize = Math.round(BASE_ATTRIBUTION_SIZE * scale);
  const lineGap = Math.round(BASE_LINE_GAP * scale);
  const shadowBlur = BASE_SHADOW_BLUR * scale;

  ctx.save();

  const captionText = `${params.variable} · ${WSF_COLORMAP_LABEL} colormap · rescale ${params.rescale[0]}–${params.rescale[1]}`;

  ctx.font = `700 ${labelSize}px ${FONT_FAMILY}`;
  const labelWidth = ctx.measureText(frame.label).width;
  ctx.font = `${captionSize}px ${FONT_FAMILY}`;
  const captionWidth = ctx.measureText(captionText).width;

  const plateWidth = Math.min(canvas.width - pad * 2, Math.max(labelWidth, captionWidth) + pad * 2);
  const plateHeight = labelSize + captionSize + lineGap + pad * 2;

  ctx.fillStyle = COLORS.plateBackground;
  ctx.fillRect(pad, pad, plateWidth, plateHeight);

  ctx.fillStyle = COLORS.labelText;
  ctx.shadowColor = COLORS.textShadow;
  ctx.shadowBlur = shadowBlur;
  ctx.textBaseline = "top";

  ctx.font = `700 ${labelSize}px ${FONT_FAMILY}`;
  ctx.fillText(frame.label, pad * 2, pad * 1.5);

  ctx.font = `${captionSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.captionText;
  ctx.fillText(captionText, pad * 2, pad * 1.5 + labelSize + lineGap);

  ctx.shadowBlur = 0;

  ctx.font = `${attributionSize}px ${FONT_FAMILY}`;
  const attrWidth = ctx.measureText(attribution).width;
  const attrPlateH = attributionSize + Math.round(pad * 0.6);
  ctx.fillStyle = COLORS.plateBackground;
  ctx.fillRect(pad, canvas.height - pad - attrPlateH, attrWidth + pad, attrPlateH);

  ctx.fillStyle = COLORS.attributionText;
  ctx.shadowColor = COLORS.textShadow;
  ctx.shadowBlur = shadowBlur;
  ctx.fillText(attribution, pad * 1.5, canvas.height - pad - attrPlateH + Math.round(pad * 0.3));
  ctx.shadowBlur = 0;

  if (logo) {
    const { width: logoW, height: logoH } = getLogoDimensions(logo);
    if (logoW > 0 && logoH > 0) {
      const targetH = Math.round(BASE_LOGO_HEIGHT * scale);
      const targetW = Math.round((logoW / logoH) * targetH);
      const x = canvas.width - pad - targetW;
      const y = canvas.height - pad - targetH;

      ctx.fillStyle = COLORS.plateBackground;
      ctx.fillRect(
        x - Math.round(8 * scale),
        y - Math.round(8 * scale),
        targetW + Math.round(16 * scale),
        targetH + Math.round(16 * scale),
      );
      ctx.drawImage(logo, x, y, targetW, targetH);
    }
  }

  ctx.restore();
}