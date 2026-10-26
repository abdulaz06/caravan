"use client";

import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { PeekResponse } from "@/lib/peek";
import { balanceOf, buildTimeline } from "@/lib/timeline";
import { SiteFooter } from "../brand/site-footer";
import { Lockup } from "../brand/wordmark";
import { CurrencyPicker } from "../currency";
import { BalanceMeter } from "../trip/balance-meter";
import { ItineraryTimeline } from "../trip/itinerary-timeline";
import { TripPoster } from "../trip/trip-poster";

const QUIPS = ["Nosy, aren't we?", "Just a little peek…", "We won't tell 🤫", "Curiosity killed the cat. Good thing you're not a cat.", "Shhh… don't let them see you."];

type Load = { kind: "loading" } | { kind: "ok"; plan: PeekResponse } | { kind: "error"; message: string };

/**
 * 👀 Peek: someone's whole plan — drafts too — in the normal read-only
 * itinerary view (poster, map, day by day). Only picks and dates come from
 * the server: no day notes, no private answers, and nothing to copy or add.
 */
export function PeekView({ id, name }: { id: string; name: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/peek/${id}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setLoad({ kind: "ok", plan: body as PeekResponse });
        else setLoad({ kind: "error", message: r.status === 403 ? "Peeking is switched off right now." : (body.error ?? "Couldn't peek — try again.") });
      })
      .catch(() => alive && setLoad({ kind: "error", message: "Couldn't peek — try again." }));
    return () => {
      alive = false;
    };
  }, [id]);

  const plan = load.kind === "ok" ? load.plan : null;
  const data = plan?.data ?? null;
  const timeline = useMemo(() => (data ? buildTimeline(data) : null), [data]);
  const balance = useMemo(() => (data ? balanceOf(data) : null), [data]);
  const status = plan?.status ?? null;

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
        <section className="px-2">
          <p className="label flex items-center gap-1.5 text-sunset-600">
            <span aria-hidden="true" className="text-[15px]">👀</span> Peek
          </p>
          <h1 className="font-display mt-2 text-[34px] font-semibold leading-[1] tracking-[-0.025em] [overflow-wrap:anywhere]">
            {name}&apos;s <span className="italic text-ocean-700">plan</span>
          </h1>
          <p className="font-display mt-1.5 text-[16px] italic text-ink-3">{quip}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status && (
              <span
                aria-label={`Status: ${status === "draft" ? "In progress" : status === "submitted" ? "Submitted" : "Not started"}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold",
                  status === "draft" && "bg-saffron-200 text-ink",
                  status === "submitted" && "bg-jungle-100 text-jungle-700",
                  status === "new" && "bg-sand-200 text-ink-2",
                )}
              >
                {status === "draft" && <span className="size-2 animate-pulse rounded-full bg-sunset-500" />}
                {status === "draft" ? "In progress" : status === "submitted" ? "Submitted" : "Not started"}
              </span>
            )}
            {plan && plan.role !== "member" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-jungle-800 px-3 py-1 text-[12px] font-bold text-paper">
                <ShieldCheck className="size-3.5 text-saffron-400" /> Organizer
              </span>
            )}
          </div>
          {status === "draft" && <p className="mt-2 text-[13.5px] text-ink-3">Still cooking — {name} may change things before sending it in.</p>}
        </section>

        {load.kind === "loading" && (
          <div className="grid h-60 place-items-center rounded-[30px] bg-paper/70 shadow-card" role="status">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-3">
              <Loader2 className="size-5 animate-spin" /> Peeking…
            </span>
          </div>
        )}
        {load.kind === "error" && <p className="rounded-2xl bg-paper p-5 text-center text-[14px] text-ink-2 shadow-card">{load.message}</p>}

        {plan && (!data || !data.startDate) && (
          <div className="rounded-[26px] bg-paper p-6 text-center shadow-card">
            <p className="font-display text-[22px] font-semibold">Nothing to see… yet</p>
            <p className="mt-1.5 text-[14px] text-ink-3">{name} hasn&apos;t picked dates yet — peek again later.</p>
          </div>
        )}

        {data?.startDate && timeline && balance && (
          <>
            <TripPoster name={name} data={data} timeline={timeline} />
            <div className="rounded-[26px] bg-paper p-4 shadow-card">
              <BalanceMeter balance={balance} title="Their vibe" />
            </div>
            <section className="rounded-[26px] bg-sand-50 p-4 pt-5 shadow-card ring-1 ring-ink/[0.03]">
              <h2 className="font-display mb-4 text-[24px] font-semibold">Day by day</h2>
              <ItineraryTimeline data={data} timeline={timeline} hideNotes />
            </section>
          </>
        )}
      </div>
      <SiteFooter className="relative z-[1] mt-4" />
    </div>
  );
}
