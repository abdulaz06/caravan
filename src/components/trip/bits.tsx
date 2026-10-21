"use client";

import { AlertTriangle, CalendarClock, Plane, Sparkles } from "lucide-react";
import { COAST_ROAD_KM, type Activity as Option } from "@/content";
import { cn } from "@/lib/cn";
import { daysLabel, type TravelSegment } from "@/lib/timeline";
import { HillSunIcon, Van } from "../brand/illustrations";

/** A travel line: fixed legs, road trips from base, hops between items and the way back. */
export function RoadTrip({ seg, tone = "light", className }: { seg: TravelSegment; tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  const fixed = seg.kind === "fixed";
  const flight = fixed && (seg.from === "airport" || seg.to === "airport");
  const small = seg.kind === "hop" || seg.kind === "return";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        fixed ? cn("rounded-xl px-2.5 py-2", dark ? "bg-white/5" : "bg-ocean-100/60") : small ? "py-0.5 pl-1" : "py-1",
        className,
      )}
    >
      <span className={cn("mt-0.5 flex shrink-0 items-center justify-center", small ? "h-4 w-7" : "h-5 w-9")}>
        {flight ? (
          <span className={cn("grid size-5 place-items-center rounded-full", dark ? "bg-white/10 text-ocean-100" : "bg-ocean-600 text-white")}>
            <Plane className="size-3 -rotate-45" strokeWidth={2.5} />
          </span>
        ) : seg.to === "ella" || seg.from === "ella" ? (
          <HillSunIcon className={small ? "size-5" : "size-6"} />
        ) : (
          <Van className={cn(small ? "h-4 w-6" : "h-5 w-8", dark ? "text-ocean-300" : "text-ocean-600")} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-snug", small ? "text-[11.5px]" : "text-[12.5px]", dark ? "text-ocean-100" : "text-ocean-700")}>
          {seg.title} <span className={dark ? "text-paper/60" : "text-ink-3"}>· {seg.label}</span>
        </p>
        {(fixed || seg.kind === "excursion") && seg.detail && <p className={cn("mt-0.5 text-[11.5px] leading-snug", dark ? "text-paper/55" : "text-ink-3")}>{seg.detail}</p>}
        {seg.stops && seg.stops.length > 0 && <RouteStrip stops={seg.stops} dark={dark} className="mt-2" />}
      </div>
    </div>
  );
}

/** Colombo ——●——●—— Galle, stops placed by km along the coast road. */
export function RouteStrip({
  stops,
  dark,
  className,
}: {
  stops: { name: string; km: number }[];
  dark?: boolean;
  className?: string;
}) {
  const pct = (km: number) => `${Math.min(94, Math.max(6, (km / COAST_ROAD_KM) * 100))}%`;
  const end = cn("shrink-0 text-[9.5px] font-bold uppercase tracking-wide", dark ? "text-paper/55" : "text-ink-3");
  return (
    <div className={cn("flex items-center gap-2 py-4", className)} aria-label={`Stops on the way: ${stops.map((s) => s.name).join(", ")}`}>
      <span className={end}>Colombo</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-gradient-to-r from-ocean-600 via-saffron-400 to-jungle-600">
        {stops.map((s, k) => (
          <span key={s.name} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(s.km) }}>
            <span className="block size-3 rounded-full bg-saffron-500 ring-2 ring-paper" />
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold leading-none",
                k % 2 ? "bottom-[15px]" : "top-[15px]",
                dark ? "text-paper/85" : "text-ink-2",
              )}
            >
              {s.name}
            </span>
          </span>
        ))}
      </div>
      <span className={end}>Galle</span>
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
