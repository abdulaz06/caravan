"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { useMaybeEngine, useMaybeTrip } from "../engine";
import { Lockup } from "./wordmark";

/** Shared footer: the Caravan lockup, and inside a trip, the trip it belongs to. */
export function SiteFooter({ tone = "ink", className }: { tone?: "ink" | "light"; className?: string }) {
  const light = tone === "light";
  const trip = useMaybeTrip();
  const season = useMaybeEngine()?.catalog.preset.destination.season;
  return (
    <footer className={cn("flex flex-col items-center gap-3 px-5 pb-10 pt-8 text-center", className)}>
      <Link href="/" aria-label={`${BRAND.name} home`}>
        <Lockup size="md" tone={tone} />
      </Link>
      <p className={cn("mt-1 text-[13px]", light ? "text-paper/70" : "text-ink-2")}>
        {trip ? `${trip.name}${season ? ` · ${season}` : ""} · planned together on ${BRAND.name}` : BRAND.tagline}
      </p>
      {trip && (
        <p className={cn("text-[11px]", light ? "text-paper/45" : "text-ink-3")}>
          Photos by Wikimedia Commons contributors, credited on each option.
        </p>
      )}
      {trip?.kind === "demo" && (
        <p className="flex gap-4 text-[13px] font-semibold">
          <Link href="/case-study" className={light ? "text-highlight-400 hover:underline" : "text-accent-600 hover:underline"}>
            Read the case study
          </Link>
          <Link href="/demo" className={light ? "text-paper/80 hover:underline" : "text-ink-2 hover:underline"}>
            Other demos
          </Link>
        </p>
      )}
    </footer>
  );
}
