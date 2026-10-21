"use client";

import { ArrowLeft, PencilRuler, ShieldCheck } from "lucide-react";
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
import { PrefsSummary } from "../trip/review-step";
import { TripPoster } from "../trip/trip-poster";

/**
 * Read-only view of someone else's submitted itinerary (preferences stay
 * private) — or, for organizers in the console, anyone's full plan including
 * their private answers.
 */
export function PersonView({
  name,
  data,
  isMe,
  role = "member",
  organizer,
}: {
  name: string;
  data: ItineraryData;
  isMe: boolean;
  role?: "owner" | "admin" | "member";
  organizer?: { id: string; status: string; stamp: { by: string; at: string; kind: string } | null };
}) {
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const balance = useMemo(() => balanceOf(data), [data]);
  const into = data.preferences.interests?.map((i) => INTERESTS.find((x) => x.id === i)?.label).filter(Boolean);
  return (
    <div className="grain min-h-dvh">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink/[0.06] bg-sand-100/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link
          href={organizer ? "/admin#people" : "/group"}
          className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink-2 hover:bg-sand-200"
        >
          <ArrowLeft className="size-4" /> {organizer ? "Console" : "The crew"}
        </Link>
        <span className="flex-1" />
        <CurrencyPicker />
        <Lockup size="sm" />
      </header>
      <div className="relative z-[1] space-y-4 px-3 pt-5">
        {role !== "member" && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-jungle-800 px-3 py-1 text-[12px] font-bold text-paper">
            <ShieldCheck className="size-3.5 text-saffron-400" /> {name} is an organizer
          </p>
        )}
        {organizer && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper p-3 text-[13px] shadow-card">
            <span className="font-semibold capitalize">{organizer.status === "new" ? "Not started" : organizer.status}</span>
            {organizer.stamp?.kind === "edit" && (
              <span className="text-ink-3">
                · edited by {organizer.stamp.by} on {new Date(organizer.stamp.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
            <span className="flex-1" />
            <Link href={`/admin/edit/${organizer.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ocean-700 px-3 font-semibold text-paper">
              <PencilRuler className="size-4" /> Edit plan
            </Link>
          </div>
        )}
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
        {organizer && <PrefsSummary data={data} title={`${name}'s private answers`} />}
      </div>
      <SiteFooter className="relative z-[1] mt-4" />
    </div>
  );
}
