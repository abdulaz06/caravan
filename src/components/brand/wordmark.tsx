import { useId } from "react";
import { BRAND, MARK } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { SunMark } from "./illustrations";

type Tone = "ink" | "light";

/** The Caravan mark: three overlapping discs on a rising line (see src/lib/brand.ts). */
export function CaravanMark({ tone = "ink", className }: { tone?: Tone; className?: string }) {
  const discs = MARK[tone === "light" ? "dark" : "light"];
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {discs.map((d) => (
        <circle key={d.cx} cx={d.cx} cy={d.cy} r={d.r} fill={d.color} fillOpacity={0.92} />
      ))}
    </svg>
  );
}

const SIZES = {
  sm: "text-[19px]",
  md: "text-[26px]",
  lg: "text-[36px]",
  xl: "text-[58px]",
} as const;

/**
 * Brand lockup: the mark and the "Caravan" wordmark. It always uses the brand
 * font, never a trip's display font, so it reads the same on every trip.
 * Font size drives everything.
 */
export function Lockup({
  size = "md",
  tone = "ink",
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-brand inline-flex items-center gap-[0.26em] font-semibold italic leading-none tracking-[-0.025em]",
        tone === "light" ? "text-paper" : "text-ink",
        SIZES[size],
        className,
      )}
    >
      <CaravanMark tone={tone} className="size-[1.08em] shrink-0 -translate-y-[0.03em]" />
      {BRAND.name}
    </span>
  );
}

/** Rotating circular "passport stamp" badge. */
export function Stamp({ className, text }: { className?: string; text: string }) {
  const id = useId();
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id={id} d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="currentColor" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1" strokeDasharray="2 3" />
        <text fontSize="11.5" fontWeight="800" letterSpacing="2.2" fill="#1d1914" fontFamily="var(--font-sans)">
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <SunMark className="relative size-[34%] text-ink" />
    </div>
  );
}
