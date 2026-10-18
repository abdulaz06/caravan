import { useId } from "react";
import { cn } from "@/lib/cn";
import { SunMark } from "./illustrations";

type Tone = "ink" | "light";

/** Plain "☀ Lanks" mark. Prefer <Lockup> anywhere the brand is presented. */
export function Wordmark({ className, tone = "ink" }: { className?: string; tone?: Tone }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-[0.22em] text-[22px] font-black italic leading-none tracking-[-0.02em]",
        tone === "light" ? "text-paper" : "text-ink",
        className,
      )}
    >
      <SunMark className="size-[0.95em] -translate-y-[0.04em] text-saffron-500" />
      Lanks
    </span>
  );
}

/** The "10hyaya" rubber stamp. Always lowercase, exactly "10hyaya". */
export function TenHyaya({ tone = "ink", className }: { tone?: Tone; className?: string }) {
  return (
    <span className={cn("stamp-10h", tone === "light" ? "text-saffron-400" : "text-sunset-600", className)}>10hyaya</span>
  );
}

const SIZES = {
  sm: "text-[19px]",
  md: "text-[26px]",
  lg: "text-[36px]",
  xl: "text-[58px]",
} as const;

/**
 * Brand lockup: "Lanks" wordmark with a smaller "by [10hyaya]" stamp tucked
 * underneath, right-aligned like a signature. Font size drives everything.
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
    <span className={cn("inline-grid justify-items-end leading-none", SIZES[size], className)}>
      <span
        className={cn(
          "font-display flex items-center gap-[0.22em] font-black italic tracking-[-0.02em]",
          tone === "light" ? "text-paper" : "text-ink",
        )}
      >
        <SunMark className="size-[0.95em] -translate-y-[0.04em] text-saffron-500" />
        Lanks
      </span>
      <span className="-mr-[0.04em] mt-[0.02em] flex items-center gap-[0.18em]">
        <span
          className={cn(
            "font-display text-[max(0.3em,9px)] font-medium italic",
            tone === "light" ? "text-paper/75" : "text-ink-2",
          )}
        >
          by
        </span>
        <TenHyaya tone={tone} />
      </span>
    </span>
  );
}

/** Rotating circular "passport stamp" badge. */
export function Stamp({ className, text = "SRI LANKA · DEC 2026 – JAN 2027 · " }: { className?: string; text?: string }) {
  const id = useId();
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id={id} d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="currentColor" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1" strokeDasharray="2 3" />
        <text fontSize="11.5" fontWeight="800" letterSpacing="2.2" fill="#1d1914" fontFamily="var(--font-instrument)">
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <SunMark className="relative size-[34%] text-ink" />
    </div>
  );
}
