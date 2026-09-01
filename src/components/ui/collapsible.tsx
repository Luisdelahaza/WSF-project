"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Minimal collapsible section (no extra dependency). A labelled trigger toggles
 * a region; the chevron rotates when open. Styled to match the wsf-platform
 * tokens used by the other ported components.
 */
function Collapsible({ title, defaultOpen = false, className, children }: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <div className={cn("border-border rounded-md border", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="text-text flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium"
      >
        {title}
        <ChevronDownIcon
          className={cn("size-4 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={id} className="border-border border-t px-3 pt-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

export { Collapsible };
