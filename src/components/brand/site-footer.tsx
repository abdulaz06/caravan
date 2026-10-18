import { cn } from "@/lib/cn";
import { Lockup } from "./wordmark";

/** Shared footer: the brand lockup and a line for the crew. */
export function SiteFooter({ tone = "ink", className }: { tone?: "ink" | "light"; className?: string }) {
  const light = tone === "light";
  return (
    <footer className={cn("flex flex-col items-center gap-3 px-5 pb-10 pt-8 text-center", className)}>
      <Lockup size="md" tone={tone} />
      <p className={cn("mt-1 text-[13px]", light ? "text-paper/70" : "text-ink-2")}>
        Made for the 10hyaya crew · Sri Lanka, Dec 2026 – Jan 2027
      </p>
      <p className={cn("text-[11px]", light ? "text-paper/45" : "text-ink-3")}>
        Photos by Wikimedia Commons contributors, credited on each option.
      </p>
    </footer>
  );
}
