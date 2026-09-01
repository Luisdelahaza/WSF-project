import Image from "next/image";

// Adapted from wsf-platform `ui/logo.tsx`. The platform version reads the
// active color mode from a jotai store; this scaffold is dark-only, so the
// brand variant is a simple prop (defaults to the white wordmark).
export type LogoBrand = "mindearth";

const LOGO_SRCS: Record<LogoBrand, { dark: string; light: string; alt: string }> = {
  mindearth: {
    dark: "/logos/ME-logo-white.png",
    light: "/logos/ME-logo-black.png",
    alt: "MindEarth",
  },
};

interface LogoProps {
  brand?: LogoBrand;
  variant?: "dark" | "light";
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function Logo({
  brand = "mindearth",
  variant = "dark",
  className,
  width = 160,
  height = 46,
  priority,
}: LogoProps) {
  const { dark, light, alt } = LOGO_SRCS[brand];
  return (
    <Image
      src={variant === "dark" ? dark : light}
      alt={alt}
      className={className}
      width={width}
      height={height}
      priority={priority}
    />
  );
}
