"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { interests as INTERESTS } from "@/content/preferences";
import type { ItineraryData } from "@/lib/itinerary";
import { balanceOf, buildTimeline } from "@/lib/timeline";
import { SiteFooter } from "../brand/site-footer";
import { Lockup } from "../brand/wordmark";
import { CurrencyPicker } from "../currency";
import { BalanceMeter } from "../trip/balance-meter";
import { ItineraryTimeline } from "../trip/itinerary-timeline";
import { TripPoster } from "../trip/trip-poster";

/** Read-only view of someone else's submitted itinerary (preferences stay private). */
export function PersonView({ name, data, isMe }: { name: string; data: ItineraryData; isMe: boolean }) {
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const balance = useMemo(() => balanceOf(data), [data]);
  const into = data.preferences.interests?.map((i) => INTERESTS.find((x) => x.id === i)?.label).filter(Boolean);
  return (
    <div className="grain min-h-dvh">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink/[0.06] bg-sand-100/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link href="/group" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink-2 hover:bg-sand-200">
          <ArrowLeft className="size-4" /> The crew
        </Link>
        <span className="flex-1" />
        <CurrencyPicker />
        <Lockup size="sm" />
      </header>
      <div className="relative z-[1] space-y-4 px-3 pt-5">
        <TripPoster name={name} data={data} timeline={timeline} />
        <div className="rounded-[26px] bg-paper p-4 shadow-card">
          <BalanceMeter balance={balance} title={isMe ? "Your vibe" : "Their vibe"} />
          {into && into.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink/5 pt-3">
              <span className="label mr-1 self-center text-ink-3">Into</span>
              {into.map((i) => (
                <span key={i} className="rounded-full bg-sand-200 px-2.5 py-1 text-[12.5px] font-semibold">
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
        <section className="rounded-[26px] bg-sand-50 p-4 pt-5 shadow-card ring-1 ring-ink/[0.03]">
          <h2 className="font-display mb-4 text-[24px] font-semibold">Day by day</h2>
          <ItineraryTimeline data={data} timeline={timeline} />
        </section>
      </div>
      <SiteFooter className="relative z-[1] mt-4" />
    </div>
  );
}
