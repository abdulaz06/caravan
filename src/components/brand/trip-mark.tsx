"use client";

import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { useMaybeTrip } from "../engine";
import { CaravanMark, Lockup } from "./wordmark";

/** Inside a trip's own screens: the Caravan mark with the trip's name ("Galle crew '26"). */
export function TripMark({ className }: { className?: string }) {
  const trip = useMaybeTrip();
  if (!trip) return <Lockup size="sm" className={className} />;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <CaravanMark className="size-[26px] shrink-0" />
      <span className="min-w-0 leading-none">
        <span className="font-brand block text-[10.5px] font-semibold italic text-ink-3">{BRAND.name}</span>
        <span className="font-display mt-0.5 block truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">{trip.name}</span>
      </span>
    </span>
  );
}
