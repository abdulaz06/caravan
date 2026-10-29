"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useTrip } from "../engine";

/** "The plan is here": shown on the trip and group pages once the organizers publish it. */
export function PlanOutBar({ className }: { className?: string }) {
  const trip = useTrip();
  return (
    <Link
      href={trip.href("/plan")}
      className={cn(
        "mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-ink p-3 pl-3.5 text-paper shadow-card transition hover:-translate-y-0.5 active:scale-[0.99]",
        className,
      )}
    >
      <Sparkles className="size-5 shrink-0 text-highlight-400" />
      <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
        <b>The plan is here.</b> <span className="text-paper/70">See what the group is doing — and say if you&apos;re in.</span>
      </span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}
