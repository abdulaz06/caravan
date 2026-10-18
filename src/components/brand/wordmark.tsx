import { cn } from "@/lib/cn";
import { SunMark } from "./illustrations";

export function Wordmark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1.5 text-[22px] font-black italic leading-none tracking-[-0.02em]",
        tone === "light" ? "text-paper" : "text-ink",
        className,
      )}
    >
      <SunMark className="size-[0.95em] -translate-y-[0.04em] text-saffron-500" />
      Lanks
    </span>
  );
}

/** Rotating circular "passport stamp" badge. */
export function Stamp({ className, text = "SRI LANKA · DEC 2026 – JAN 2027 · " }: { className?: string; text?: string }) {
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id="stamp-circle" d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="currentColor" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1" strokeDasharray="2 3" />
        <text fontSize="11.5" fontWeight="800" letterSpacing="2.2" fill="#1d1914" fontFamily="var(--font-instrument)">
          <textPath href="#stamp-circle">{text}</textPath>
        </text>
      </svg>
      <SunMark className="relative size-[34%] text-ink" />
    </div>
  );
}
