"use client";

import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Photo as PhotoT } from "@/engine/catalog";
import type { ItineraryData } from "@/engine/itinerary";
import { buildTimeline } from "@/engine/timeline";
import { BRAND } from "@/lib/brand";
import { useEngine } from "../engine";
import { Lockup } from "../brand/wordmark";
import { ItineraryTimeline } from "../trip/itinerary-timeline";
import { TripPoster } from "../trip/trip-poster";
import { Photo } from "../ui/photo";
import { CaseStudyLink } from "../caravan/case-study-link";

export type PastTripSummary = {
  id: string;
  title: string;
  crew: string;
  dates: string;
  summary: string;
  days: number;
  places: number;
  slides: number;
  cover: PhotoT | null;
  storyCover: PhotoT | null;
};

/** One past trip: its story, then the plan as it happened — poster, route map and day by day. */
export function PastTripView({ trip, data }: { trip: PastTripSummary; data: ItineraryData }) {
  const e = useEngine();
  const timeline = useMemo(() => buildTimeline(e, data), [e, data]);
  return (
    <div className="grain min-h-dvh bg-surface-100">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink/[0.06] bg-surface-100/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link href="/past" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink-2 hover:bg-surface-200">
          <ArrowLeft className="size-4" /> Past trips
        </Link>
        <span className="flex-1" />
        <CaseStudyLink className="mr-1" />
        <Link href="/" aria-label={`${BRAND.name} home`} className="hidden sm:block">
          <Lockup size="sm" />
        </Link>
      </header>

      <div className="relative z-[1] mx-auto max-w-[560px] space-y-4 px-3 pb-12 pt-4">
        <section className="relative overflow-hidden rounded-[28px] bg-primary-900 text-paper shadow-card">
          <div className="relative aspect-[4/3]">
            <Photo photo={trip.cover ?? undefined} alt={trip.title} sizes="(min-width: 600px) 560px, 100vw" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-950/40 to-transparent" />
          </div>
          <div className="relative -mt-24 px-5 pb-5">
            <p className="label text-highlight-400">
              Past trip · {trip.dates}
            </p>
            <h1 className="font-display mt-2 text-[40px] font-semibold leading-[0.98] tracking-[-0.03em]">{trip.title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-paper/80">{trip.summary}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[12.5px] font-semibold">
              <span className="rounded-full bg-white/12 px-2.5 py-1">
                {trip.days} days · {trip.days - 1} nights
              </span>
              <span className="rounded-full bg-white/12 px-2.5 py-1">{trip.places} places</span>
              <span className="rounded-full bg-white/12 px-2.5 py-1">{trip.crew}</span>
            </div>
          </div>
        </section>

        <Link
          href={`/past/${trip.id}/story`}
          className="group flex items-center gap-4 rounded-[24px] bg-night-900 p-3 pr-5 text-paper shadow-card transition hover:-translate-y-0.5"
        >
          <span className="relative block aspect-[9/16] w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-night-800 ring-2 ring-highlight-400">
            <Photo photo={trip.storyCover ?? undefined} alt="" sizes="72px" />
            <span className="absolute inset-x-1.5 top-1.5 flex gap-0.5">
              {Array.from({ length: Math.min(trip.slides, 8) }, (_, k) => (
                <span key={k} className={`h-[2px] flex-1 rounded-full ${k === 0 ? "bg-white" : "bg-white/40"}`} />
              ))}
            </span>
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-8 place-items-center rounded-full bg-white/90 text-night-900 transition group-hover:scale-110">
                <Play className="size-4 translate-x-px" fill="currentColor" />
              </span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="label block text-highlight-400">The story</span>
            <span className="font-display mt-1 block text-[22px] font-semibold leading-tight">Watch the trip in {trip.slides} slides</span>
            <span className="mt-1 block text-[13px] text-paper/65">Tap through it like a story · ends with the next destination</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-paper/60 transition group-hover:translate-x-0.5" />
        </Link>

        <TripPoster name="The crew" data={data} timeline={timeline} />

        <section className="rounded-[26px] bg-surface-50 p-4 pt-5 shadow-card ring-1 ring-ink/[0.03]">
          <h2 className="font-display mb-4 text-[24px] font-semibold">Day by day</h2>
          <ItineraryTimeline data={data} timeline={timeline} />
        </section>

        <section className="rounded-[26px] bg-primary-800 p-6 text-center text-paper shadow-card">
          <h2 className="font-display text-[28px] font-semibold leading-tight">
            Planning the <span className="italic text-highlight-400">next one?</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[14.5px] text-paper/75">Everyone builds their own version; you see where it overlaps.</p>
          <Link
            href="/new"
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-highlight-500 px-6 font-semibold text-ink shadow-[0_4px_0_0_var(--color-highlight-600)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-highlight-600)]"
          >
            Start a trip <ArrowRight className="size-4.5" strokeWidth={2.5} />
          </Link>
        </section>
        <p className="px-4 text-center text-[11.5px] text-ink-3">
          Anonymised from a real group trip. Photos by Wikimedia Commons contributors, credited on each slide and option.
        </p>
      </div>
    </div>
  );
}
