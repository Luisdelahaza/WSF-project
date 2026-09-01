import * as React from "react";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="range"
      className={cn(
        "bg-secondary my-2 block h-1 w-full cursor-pointer appearance-none rounded-full outline-none",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:shadow-thumb-idle [&::-webkit-slider-thumb]:[transition:box-shadow_0.2s_ease]",
        "focus:[&::-webkit-slider-thumb]:shadow-thumb-focus active:[&::-webkit-slider-thumb]:shadow-thumb-focus",
        "[&::-moz-range-track]:bg-secondary [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
        "[&::-moz-range-thumb]:shadow-thumb-idle [&::-moz-range-thumb]:[transition:box-shadow_0.2s_ease]",
        "focus:[&::-moz-range-thumb]:shadow-thumb-focus active:[&::-moz-range-thumb]:shadow-thumb-focus",
        className,
      )}
      {...props}
    />
  );
}

// Shared thumb/track styling for the overlaid range inputs. Only the thumb is
// interactive (`pointer-events-auto`) so two inputs can stack and each thumb
// stays grabbable; the visible track + fill are drawn by sibling divs below.
const rangeInputClass = cn(
  "pointer-events-none absolute inset-x-0 top-1/2 m-0 h-3 w-full -translate-y-1/2 appearance-none bg-transparent outline-none",
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
  "[&::-webkit-slider-thumb]:shadow-thumb-idle [&::-webkit-slider-thumb]:[transition:box-shadow_0.2s_ease]",
  "focus-visible:[&::-webkit-slider-thumb]:shadow-thumb-focus active:[&::-webkit-slider-thumb]:shadow-thumb-focus",
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
  "[&::-moz-range-thumb]:shadow-thumb-idle [&::-moz-range-thumb]:[transition:box-shadow_0.2s_ease]",
  "focus-visible:[&::-moz-range-thumb]:shadow-thumb-focus active:[&::-moz-range-thumb]:shadow-thumb-focus",
);

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** `[low, high]` — the two thumb positions. */
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
}

/**
 * Dual-thumb range slider built from two overlaid native range inputs, styled
 * to match the single `Slider` (same track/thumb tokens). Keeps both thumbs
 * keyboard-operable and clamps so the low thumb never crosses the high thumb.
 */
function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  minLabel,
  maxLabel,
  className,
}: RangeSliderProps) {
  const [low, high] = value;
  const span = max - min || 1;
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  return (
    <div className={cn("relative my-2 flex h-3 w-full items-center", className)}>
      {/* track */}
      <div className="bg-secondary pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
      {/* selected range fill */}
      <div
        className="bg-primary pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
      />
      <input
        type="range"
        aria-label={minLabel}
        min={min}
        max={max}
        step={step}
        value={low}
        onChange={(e) => onValueChange([Math.min(Number(e.target.value), high), high])}
        className={rangeInputClass}
      />
      <input
        type="range"
        aria-label={maxLabel}
        min={min}
        max={max}
        step={step}
        value={high}
        onChange={(e) => onValueChange([low, Math.max(Number(e.target.value), low)])}
        className={rangeInputClass}
      />
    </div>
  );
}

export { Slider, RangeSlider };
