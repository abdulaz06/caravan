"use client";

import { AlertTriangle, CalendarClock, Plane, Sparkles } from "lucide-react";
import type { Option } from "@/content";
import { cn } from "@/lib/cn";
import { daysLabel, type TravelSegment } from "@/lib/timeline";
import { Train, Van } from "../brand/illustrations";

/** A travel line in the timeline: fixed legs, there-and-back trips and train/road legs. */
export function RoadTrip({ seg, tone = "light", className }: { seg: TravelSegment; tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  const fixed = seg.kind === "fixed";
  const flight = fixed && (seg.from === "airport" || seg.to === "airport");
  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        fixed ? cn("rounded-xl px-2.5 py-2", dark ? "bg-white/5" : "bg-ocean-100/60") : "py-1",
        className,
      )}
    >
      <span className="mt-0.5 flex h-5 w-9 shrink-0 items-center justify-center">
        {seg.mode === "train" ? (
          <Train className="h-[15px] w-9" />
        ) : flight ? (
          <span className={cn("grid size-5 place-items-center rounded-full", dark ? "bg-white/10 text-ocean-100" : "bg-ocean-600 text-white")}>
            <Plane className="size-3 -rotate-45" strokeWidth={2.5} />
          </span>
        ) : (
          <Van className={cn("h-5 w-8", dark ? "text-ocean-300" : "text-ocean-600")} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[12.5px] font-semibold leading-snug", dark ? "text-ocean-100" : "text-ocean-700")}>
          {seg.title} <span className={dark ? "text-paper/60" : "text-ink-3"}>· {seg.label}</span>
        </p>
        {fixed && seg.detail && (
          <p className={cn("mt-0.5 text-[11.5px] leading-snug", dark ? "text-paper/55" : "text-ink-3")}>{seg.detail}</p>
        )}
        {seg.stops && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {seg.stops.map((s) => (
              <li
                key={s.name}
                title={s.note}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  dark ? "bg-white/10 text-paper/80" : "bg-paper text-ocean-800 shadow-sm",
                )}
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
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

export function Tip({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex gap-2 rounded-xl bg-jungle-100 px-3 py-2.5 text-[12.5px] leading-snug text-jungle-800", className)}>
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-jungle-600" strokeWidth={2.5} />
      <span>{text}</span>
    </div>
  );
}

/** "Fridays only" badge for options with day-of-week availability. */
export function DaysBadge({ option, warn, className }: { option: Option; warn?: boolean; className?: string }) {
  if (!option.availableDays) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
        warn ? "bg-sunset-500 text-white" : "bg-hibiscus-500 text-white",
        className,
      )}
    >
      <CalendarClock className="size-3" strokeWidth={2.75} /> {daysLabel(option.availableDays)}
    </span>
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
