"use client";

import { AlertTriangle, Plane, TrainFront } from "lucide-react";
import { regions } from "@/content";
import { cn } from "@/lib/cn";
import type { TravelSegment } from "@/lib/timeline";
import { Van } from "../brand/illustrations";

export function RoadTrip({ seg, tone = "light", className }: { seg: TravelSegment; tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex items-start gap-2.5 py-1.5", className)}>
      <Van className={cn("mt-0.5 h-5 w-8 shrink-0", dark ? "text-ocean-300" : "text-ocean-600")} />
      <div className="min-w-0">
        <p className={cn("text-[12.5px] font-semibold leading-snug", dark ? "text-ocean-100" : "text-ocean-700")}>
          Road trip · {regions[seg.from].short} → {regions[seg.to].short}{" "}
          <span className={dark ? "text-paper/60" : "text-ink-3"}>· {seg.label}</span>
        </p>
        {seg.train && (
          <p className={cn("mt-0.5 flex items-center gap-1 text-[11.5px] leading-snug", dark ? "text-paper/55" : "text-ink-3")}>
            <TrainFront className="size-3 shrink-0" /> {seg.train}
          </p>
        )}
      </div>
    </div>
  );
}

export function ToAirport({ seg, className }: { seg: TravelSegment; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-[12.5px] font-semibold text-ocean-700", className)}>
      <span className="grid size-8 place-items-center rounded-full bg-ocean-100">
        <Plane className="size-4 -rotate-45" />
      </span>
      Back to the airport from {regions[seg.from].short} · {seg.label}
    </div>
  );
}

export function Warning({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex gap-2 rounded-xl bg-saffron-100 px-3 py-2.5 text-[12.5px] leading-snug text-ink-2", className)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-saffron-600" strokeWidth={2.5} />
      <span>{text}</span>
    </div>
  );
}

export function VibeDots({ vibe, className }: { vibe: number; className?: string }) {
  const color = vibe < 0 ? "bg-jungle-600" : vibe > 0 ? "bg-hibiscus-500" : "bg-saffron-500";
  const label = vibe <= -2 ? "Wild" : vibe === -1 ? "Outdoorsy" : vibe === 0 ? "Balanced" : vibe === 1 ? "Social" : "Big night";
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={label}>
      <span className={cn("size-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}
