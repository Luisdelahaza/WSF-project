import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "text-text w-full min-w-0 bg-transparent py-1 text-base transition-colors outline-none md:text-sm",
        "border-secondary border-b",
        "placeholder:text-secondary",
        "focus:border-primary",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
