import type { Bbox4326, ExportFormat, RenderParams, WsfMetadata } from "@/types";
import { WSF_COLORMAP_LABEL } from "@/config/wsf";
import { epochToSemesterLabel } from "@/lib/wsfMetadata";
import { Input } from "@/components/ui/input";
import { RangeSlider } from "@/components/ui/slider";
import { Collapsible } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FALLBACK_MAX_EPOCH = 20;
const MIN_FPS = 1;
const MAX_FPS = 30;

interface Props {
  params: RenderParams;
  setParams: (p: RenderParams) => void;
  bbox: Bbox4326;
  setBbox: (b: Bbox4326) => void;
  startEpoch: number;
  endEpoch: number;
  setEpochs: (start: number, end: number) => void;
  maxEpoch: number;
  loading: boolean;
  fps: number;
  setFps: (v: number) => void;
  format: ExportFormat;
  setFormat: (v: ExportFormat) => void;
  videoSupported: boolean;
  meta: WsfMetadata | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs">{label}</span>
      {children}
    </label>
  );
}

export default function TimeframeControls(p: Props) {
  const upd = (patch: Partial<RenderParams>) => p.setParams({ ...p.params, ...patch });
  const sliderMax = p.maxEpoch || FALLBACK_MAX_EPOCH;

  return (
    <div className="flex flex-col gap-4">
      {p.loading && (
        <p className="text-muted-foreground text-xs">Loading metadata…</p>
      )}

      {/* Period — dual-thumb range slider (semester granularity) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Period</span>
          <span className="text-text text-sm font-semibold">
            {epochToSemesterLabel(p.startEpoch)} – {epochToSemesterLabel(p.endEpoch)}
          </span>
        </div>
        <RangeSlider
          min={1}
          max={sliderMax}
          value={[p.startEpoch, p.endEpoch]}
          onValueChange={([s, e]) => p.setEpochs(s, e)}
          minLabel="Start semester"
          maxLabel="End semester"
        />
        <div className="text-muted-foreground mt-1 flex justify-between text-2xs">
          <span>{epochToSemesterLabel(1)}</span>
          <span>{epochToSemesterLabel(sliderMax)}</span>
        </div>
      </div>

      {/* Area — defaults to the current map view; editable */}
      <div>
        <span className="text-muted-foreground mb-1 block text-xs">Area (EPSG:4326)</span>
        <div className="grid grid-cols-4 gap-2">
          {(["W", "S", "E", "N"] as const).map((lbl, i) => (
            <label key={lbl} className="block">
              <span className="text-muted-foreground mb-1 block text-2xs">{lbl}</span>
              <Input
                type="number"
                value={Number(p.bbox[i].toFixed(4))}
                onChange={(e) => {
                  const next = [...p.bbox] as Bbox4326;
                  next[i] = Number(e.target.value);
                  p.setBbox(next);
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <Collapsible title="Config options">
        <div className="flex flex-col gap-4">
          {/* Colormap is fixed to the platform's WSF colormap (read-only). */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Colormap</span>
            <span className="text-text text-sm">{WSF_COLORMAP_LABEL} (fixed)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Rescale min">
              <Input
                type="number"
                value={p.params.rescale[0]}
                onChange={(e) => upd({ rescale: [Number(e.target.value), p.params.rescale[1]] })}
              />
            </Field>
            <Field label="Rescale max">
              <Input
                type="number"
                value={p.params.rescale[1]}
                onChange={(e) => upd({ rescale: [p.params.rescale[0], Number(e.target.value)] })}
              />
            </Field>
            <Field label="Nodata">
              <Input
                type="number"
                value={p.params.nodata}
                onChange={(e) => upd({ nodata: Number(e.target.value) })}
              />
            </Field>
            <Field label="FPS">
              <Input
                type="number"
                min={MIN_FPS}
                max={MAX_FPS}
                value={p.fps}
                onChange={(e) => {
                  // The `min`/`max` attributes above are only a visual hint
                  // (spinner arrows) — they don't stop someone from typing
                  // "0" or clearing the field entirely, both of which used
                  // to reach the encoders as fps = 0 and silently produce a
                  // broken export (infinite-speed GIF / near-zero-length
                  // video). Clamp here so an invalid value never leaves this
                  // component. `|| MIN_FPS` also covers NaN (non-numeric
                  // input) and an empty field (Number("") === 0).
                  const raw = Number(e.target.value) || MIN_FPS;
                  p.setFps(Math.min(MAX_FPS, Math.max(MIN_FPS, raw)));
                }}
              />
            </Field>
            <Field label="Width">
              <Input
                type="number"
                value={p.params.width}
                onChange={(e) => upd({ width: Number(e.target.value) })}
              />
            </Field>
            <Field label="Height">
              <Input
                type="number"
                value={p.params.height}
                onChange={(e) => upd({ height: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Format">
            <Select value={p.format} onValueChange={(v: string) => p.setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gif">GIF</SelectItem>
                {p.videoSupported && <SelectItem value="webm">Video</SelectItem>}
              </SelectContent>
            </Select>
            {!p.videoSupported && (
              <span className="text-muted-foreground mt-1 block text-2xs">
                No client-side video encoder in this browser — GIF only.
              </span>
            )}
          </Field>
        </div>
      </Collapsible>
    </div>
  );
}