import type { Frame, RenderParams } from "@/types";
import { WSF_COLORMAP_LABEL } from "@/config/wsf";

// Un logo puede venir como ImageBitmap pre-redimensionado (preferido, evita
// la distorsión por reescalado del canvas) o como HTMLImageElement (fallback).
export type LogoImage = ImageBitmap | HTMLImageElement;

export interface OverlayOptions {
  frame: Frame;
  params: RenderParams;
  logo: LogoImage | null;
  attribution?: string;
}

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------
// Centralizados aquí para que sean fáciles de reutilizar, cambiar e identificar.

const COLORS = {
  plateBackground: "rgba(0, 0, 0, 0.55)",
  labelText: "#ffffff",
  captionText: "rgba(255, 255, 255, 0.85)",
  attributionText: "rgba(255, 255, 255, 0.9)",
  textShadow: "rgba(0, 0, 0, 0.8)",
} as const;

const FONT_FAMILY = "system-ui, sans-serif";

// ---------------------------------------------------------------------------
// Sistema de escala
// ---------------------------------------------------------------------------

/** Tamaño de referencia (px) para el que se diseñaron los tamaños base de abajo. */
const REFERENCE_SIZE = 768;

/** Tamaños base a REFERENCE_SIZE; se escalan en tiempo de render. */
const BASE_PAD = 16;
const BASE_LABEL_SIZE = 28;
const BASE_CAPTION_SIZE = 14;
const BASE_ATTRIBUTION_SIZE = 12;
const BASE_LINE_GAP = 6;
const BASE_LOGO_HEIGHT = 32;
const BASE_SHADOW_BLUR = 2;

/** Ancho objetivo (px) por defecto para el bitmap pre-redimensionado del logo. */
const LOGO_RESIZE_WIDTH = 110;

// ---------------------------------------------------------------------------
// Carga del logo
// ---------------------------------------------------------------------------

/**
 * Carga el logo del overlay, pre-redimensionándolo a `resizeWidth` mediante
 * createImageBitmap para que se dibuje (casi) a su resolución final en vez
 * de ser reescalado por el canvas al dibujarlo — que era lo que causaba la
 * distorsión/borrosidad del logo.
 *
 * Si createImageBitmap (o sus opciones de resize) no están soportadas,
 * cae de vuelta a un HTMLImageElement normal.
 */
export async function loadLogo(
  src = "/logos/ME-logo-white.png",
  resizeWidth = LOGO_RESIZE_WIDTH,
): Promise<LogoImage | null> {
  // Camino preferido: fetch + createImageBitmap con resize de alta calidad.
  // Un Blob obtenido por fetch() no puede "manchar" (taint) el canvas, así
  // que este camino no necesita ningún ajuste de CORS.
  if (typeof createImageBitmap !== "undefined" && typeof fetch !== "undefined") {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await createImageBitmap(blob, {
        resizeWidth,
        resizeQuality: "high",
      });
    } catch {
      // seguimos al fallback de <img> de abajo
    }
  }

  // Fallback: elemento Image normal (sin resize forzado; el navegador lo
  // escalará al dibujarlo, por eso se prefiere el camino del bitmap).
  if (typeof Image === "undefined") {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    // Hoy `src` es same-origin (el logo bundleado), así que esto es
    // inofensivo — pero si `src` alguna vez apunta a un asset remoto sin
    // esto, el canvas queda "manchado" (tainted) y getImageData empieza a
    // lanzar, matando por completo el pipeline de export a GIF.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Devuelve las dimensiones intrínsecas en píxeles de un LogoImage, sea cual sea su tipo. */
function getLogoDimensions(logo: LogoImage): { width: number; height: number } {
  // Duck-typing en vez de `instanceof HTMLImageElement`: en el entorno de
  // test (Node puro, sin jsdom) esa clase ni siquiera existe, así que el
  // instanceof nunca es cierto. Mirar qué propiedades tiene el objeto
  // funciona igual en el navegador real y es comprobable en tests sin
  // necesidad de simular clases del DOM.
  if ("naturalWidth" in logo) {
    return { width: logo.naturalWidth, height: logo.naturalHeight };
  }
  return { width: logo.width, height: logo.height };
}

// ---------------------------------------------------------------------------
// Dibujado del overlay
// ---------------------------------------------------------------------------

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