import { BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** The case study, one tap away from Caravan's own pages (people reviewing the project look for it). */
export function CaseStudyLink({ tone = "ink", className }: { tone?: "ink" | "light"; className?: string }) {
  return (
    <Link
      href="/case-study"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition",
        tone === "light" ? "bg-white/10 text-paper ring-1 ring-white/20 hover:bg-white/20" : "bg-paper text-ink shadow-card ring-1 ring-ink/5 hover:bg-white",
        className,
      )}
    >
      <BookOpen className={cn("size-4", tone === "light" ? "text-highlight-400" : "text-accent-600")} /> Case study
    </Link>
  );
}
