"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Check, Hourglass, PartyPopper, Printer, RefreshCw, Share2, ShieldCheck, Smile, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Slot } from "@/engine/catalog";
import { familyView } from "@/engine/family";
import { bannedIn } from "@/engine/family-words";
import { STAY_ID } from "@/engine/itinerary";
import { daysNightsLabel } from "@/engine/structure";
import { buildTimeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import type { PublicPlan, RsvpSummary } from "@/lib/server/plan";
import { useArt } from "../brand/art";
import { SiteFooter } from "../brand/site-footer";
import { Lockup } from "../brand/wordmark";
import { CurrencyPicker } from "../currency";
import { useEngine, useRules, useTrip } from "../engine";
import { FamilyProvider, useFamily } from "../family";
import { AnnouncementBar } from "../rules";
import { ShareSheet } from "../trip/share-sheet";
import { ButtonLink } from "../ui/button";
import { LocalTime } from "../ui/local-time";
import { useToast } from "../ui/toast";
import { PlanBudget, PlanDays, PlanMap, type PlanItemLike, type PlanSlotLike } from "./plan-days";

type Props = { plan: PublicPlan | null; isOrganizer: boolean };

const seenKey = (trip: string) => `caravan:plan-seen:${trip}`;

/** "The plan": the published group trip, with RSVPs. Counts for everyone; names only for organizers. */
export function PlanView({ plan: initial, isOrganizer }: Props) {
  const trip = useTrip();
  const rules = useRules();
  const [plan, setPlan] = useState(initial);
  const [family, setFamily] = useState(false);

  // Live headcounts: refresh the answers while the page is open.
  useEffect(() => {
    if (!initial) return;
    const tick = async () => {
      if (document.hidden) return;
      const res = await fetch(trip.api("/plan")).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (body?.plan) setPlan(body.plan);
    };
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [initial, trip]);

  return (
    <FamilyProvider on={family}>
      <div className="grain min-h-dvh">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink/[0.06] bg-surface-100/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <Link href={trip.href("/trip")} className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink-2 hover:bg-surface-200">
            <ArrowLeft className="size-4" /> My trip
          </Link>
          <span className="flex-1" />
          {isOrganizer && (
            <Link href={trip.href("/admin#plan")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary-800 px-3 text-[12.5px] font-bold text-paper">
              <ShieldCheck className="size-4 text-highlight-400" /> Organizer
            </Link>
          )}
          <CurrencyPicker />
          <Lockup size="sm" />
        </header>
        {!family && <AnnouncementBar />}
        {plan ? <Published plan={plan} setPlan={setPlan} family={family} onFamily={rules.familyButton ? setFamily : undefined} isOrganizer={isOrganizer} /> : <NotYet isOrganizer={isOrganizer} />}
        <SiteFooter className="relative z-[1] mt-4" />
      </div>
    </FamilyProvider>
  );
}

function NotYet({ isOrganizer }: { isOrganizer: boolean }) {
  const trip = useTrip();
  const { Decor } = useArt();
  return (
    <div className="relative z-[1] px-5 pt-10">
      <section className="relative overflow-hidden rounded-[30px] bg-primary-800 p-6 text-paper shadow-lift">
        <div className="sunburst absolute inset-0" />
        <Decor className="absolute -right-4 bottom-0 h-36 text-primary-950/40" />
        <div className="relative">
          <Hourglass className="size-8 text-highlight-400" />
          <h1 className="font-display mt-3 text-[34px] font-semibold leading-[1.02] tracking-[-0.02em]">
            The plan isn&apos;t <span className="italic text-highlight-400">out yet</span>
          </h1>
          <p className="mt-3 text-[15px] text-paper/80">
            The organizers will turn everyone&apos;s picks into one trip. Until then, keep shaping yours — every pick counts.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href={trip.href("/trip")} size="md">
              Back to my trip
            </ButtonLink>
            {isOrganizer && (
              <ButtonLink href={trip.href("/admin#plan")} size="md" variant="glass">
                Make the plan
              </ButtonLink>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Published({
  plan,
  setPlan,
  family,
  onFamily,
  isOrganizer,
}: {
  plan: PublicPlan;
  setPlan: (p: PublicPlan) => void;
  family: boolean;
  onFamily?: (on: boolean) => void;
  isOrganizer: boolean;
}) {
  const e = useEngine();
  const trip = useTrip();
  const toast = useToast();
  const { Decor } = useArt();
  const data = useMemo(() => (family ? familyView(e, plan.itinerary) : plan.itinerary), [e, plan.itinerary, family]);
  const timeline = useMemo(() => buildTimeline(e, data), [e, data]);
  const [sharing, setSharing] = useState(false);
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    // Read after hydration (localStorage isn't there on the server).
    const t = setTimeout(() => {
      try {
        setSeen(Number(localStorage.getItem(seenKey(trip.id))) || 0);
      } catch {
        setSeen(0);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [trip.id]);
  const dismissUpdate = () => {
    setSeen(plan.version);
    try {
      localStorage.setItem(seenKey(trip.id), String(plan.version));
    } catch {
      /* private mode: the notice just comes back */
    }
  };

  const rsvp = useCallback(
    async (key: string, status: "in" | "skip" | null, choice?: string) => {
      const prev = plan.rsvps[key];
      // Answer straight away; the server's count replaces it.
      const mine = prev.mine;
      const next: RsvpSummary = { ...prev, mine: status ? { status, choice: choice ?? null } : null };
      if (mine) next[mine.status]--;
      if (status) next[status]++;
      setPlan({ ...plan, rsvps: { ...plan.rsvps, [key]: next } });
      const res = await fetch(trip.api("/plan/rsvp"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, status, choice }) }).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (body?.rsvp) setPlan({ ...plan, rsvps: { ...plan.rsvps, [key]: body.rsvp } });
      else {
        setPlan({ ...plan, rsvps: { ...plan.rsvps, [key]: prev } });
        toast("Couldn't save that — try again", "error");
      }
    },
    [plan, setPlan, trip, toast],
  );

  const updated = plan.changes && seen !== null && seen < plan.version;
  return (
    <div className="relative z-[1]">
      <section className="px-5 pt-7">
        <p className="label text-accent-600">
          The plan · {trip.name} · v{plan.version}
        </p>
        <h1 className="font-display mt-2 text-[40px] font-semibold leading-[0.98] tracking-[-0.025em]">
          {e.catalog.preset.name}, <span className="italic text-primary-700">together</span>
        </h1>
        <p className="mt-3 text-[16px] font-semibold text-ink">
          {dayLabel(plan.dates.start)} → {dayLabel(plan.dates.end)}
        </p>
        <p className="text-[14px] text-ink-3">
          {daysNightsLabel(plan.dates.length)} · {plan.dates.full} of {plan.dates.withDates} free for all of it
        </p>
      </section>

      <div className="mt-5 space-y-4 px-3">
        {updated && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex items-start gap-3 rounded-2xl bg-highlight-400 p-3.5 text-[13.5px] leading-snug text-ink shadow-card">
            <RefreshCw className="mt-0.5 size-[18px] shrink-0" />
            <p className="flex-1">
              <b>Plan updated</b> on <LocalTime iso={plan.publishedAt} as="date" /> — {plan.changes!.changed === 0 ? "nothing moved" : `${plan.changes!.changed} ${plan.changes!.changed === 1 ? "thing is" : "things are"} new or moved`}{" "}
              since version {plan.changes!.from}. Your answers on everything else are kept.
            </p>
            <button onClick={dismissUpdate} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5">
              <X className="size-4" />
            </button>
          </motion.div>
        )}

        <section className="relative overflow-hidden rounded-[28px] bg-primary-800 p-4 text-paper shadow-lift">
          <div className="sunburst absolute inset-0 opacity-70" />
          <Decor className="absolute -right-4 bottom-0 h-28 text-primary-950/40" />
          <p className="relative flex items-start gap-2.5 text-[14px] leading-snug">
            <Sparkles className="mt-0.5 size-[18px] shrink-0 text-highlight-400" />
            <span>
              <span className="font-display block text-[18px] font-semibold">{plan.decided.split(". ")[0]}.</span>
              <span className="text-paper/75">{plan.decided.split(". ").slice(1).join(". ")}</span>
            </span>
          </p>
          <p className="relative mt-2 pl-7 text-[12.5px] text-paper/60">{plan.dates.lengthReason}. Every pick below says why it&apos;s there.</p>
        </section>

        {family && (
          <div role="status" className="flex items-center gap-3 rounded-2xl bg-secondary-800 p-3 text-[13.5px] leading-snug text-paper shadow-card">
            <Smile className="size-5 shrink-0 text-highlight-400" />
            <p className="flex-1">
              <b>Family-friendly mode</b> <span className="text-paper/70">— a view only. The plan itself is unchanged.</span>
            </p>
            <button onClick={() => onFamily?.(false)} aria-label="Turn family-friendly mode off" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="size-4" />
            </button>
          </div>
        )}

        {plan.you && <YourPicks plan={plan} family={family} />}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSharing(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-paper text-[15px] font-bold text-ink shadow-card ring-1 ring-ink/5 transition hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <Share2 className="size-5 text-accent-500" /> Share
          </button>
          <a
            href={trip.href(`/plan/print${family ? "?family=1" : ""}`)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-paper text-[15px] font-bold text-ink shadow-card ring-1 ring-ink/5 transition hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <Printer className="size-5 text-accent-500" /> Print / PDF
          </a>
        </div>
        {onFamily && !family && (
          <button
            role="switch"
            aria-checked={family}
            aria-label="Family-friendly mode"
            onClick={() => onFamily(true)}
            className="mx-auto flex h-9 items-center gap-1.5 rounded-full bg-paper px-3.5 text-[12.5px] font-bold text-ink-2 shadow-card"
          >
            <Smile className="size-4" /> Family-friendly view
          </button>
        )}

        <PlanBudget budget={plan.budget} />
        <PlanMap data={data} timeline={timeline} />

        <div>
          <h2 className="font-display px-2 text-[26px] font-semibold">Day by day</h2>
          <p className="px-2 pb-2 text-[13px] text-ink-3">Tap “I&apos;m in” or “I&apos;ll skip” on anything — it helps the organizers book.</p>
          <PlanDays
            data={data}
            timeline={timeline}
            slots={plan.slots}
            renderItem={(item, slot) => <Rsvp item={item} slot={slot} plan={plan} isOrganizer={isOrganizer} onAnswer={rsvp} />}
          />
        </div>
      </div>
      {sharing && <ShareSheet onClose={() => setSharing(false)} name={trip.name} heading="Our" data={data} family={family} />}
    </div>
  );
}

function YourPicks({ plan, family }: { plan: PublicPlan; family: boolean }) {
  const { catalog } = useEngine();
  const you = plan.you!;
  const titleOf = (id: string) => catalog.byId[family ? catalog.familyIdFor(id) : id]?.title ?? id;
  // Family-friendly mode: reasons that name nightlife become a plain line.
  const reasonOf = (r: string) => (family && bannedIn(r).length ? "It didn't make the plan" : r);
  const dayOf = new Map<string, string>();
  for (const s of plan.slots) for (const it of s.items) dayOf.set(it.id, dayLabel(s.date));
  if (!you.picks) return null;
  const all = you.made.length === you.picks;
  // The picks that could fit the days you're there (plans saved before this existed don't say).
  const fit = typeof you.feasible === "number" && you.feasible < you.picks ? you.feasible : null;
  return (
    <section className="rounded-[26px] bg-paper p-4 shadow-card" aria-label="Your picks">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary-100 text-secondary-700">
          <PartyPopper className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="label text-ink-3">Your picks made it</p>
          <p className="font-display text-[26px] font-semibold leading-tight">
            {you.made.length} of {you.picks}
            <span className="text-[16px] font-sans font-semibold text-ink-3"> {all ? "— every one!" : "of your picks are in"}</span>
          </p>
          {fit !== null && fit > 0 && (
            <p className="text-[12.5px] font-semibold text-ink-2">
              {Math.round((Math.min(you.made.length, fit) / fit) * 100)}% of the {fit} that fit your dates
            </p>
          )}
          {you.daysThere < plan.dates.length && (
            <p className="text-[12.5px] text-ink-3">
              You&apos;re there {you.daysThere} of {plan.dates.length} days, so picks on the other days can&apos;t count for you.
            </p>
          )}
        </div>
      </div>
      {you.made.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {you.made.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2.5 py-1 text-[12.5px] font-semibold text-secondary-800">
              <Check className="size-3.5" /> {titleOf(id).split(/[:(]/)[0].trim()}
              {dayOf.get(id) && <span className="font-medium text-secondary-700/70">· {dayOf.get(id)}</span>}
            </li>
          ))}
        </ul>
      )}
      {you.missed.length > 0 && (
        <details className="group mt-3 rounded-2xl bg-surface-100 px-3 py-2">
          <summary className="cursor-pointer list-none text-[13px] font-bold text-ink-2">
            Why the other {you.missed.length} didn&apos;t make it <span className="text-ink-3 group-open:hidden">›</span>
          </summary>
          <ul className="mt-2 space-y-1.5 pb-1">
            {you.missed.map((m) => (
              <li key={m.id} className="text-[13px] leading-snug">
                <span className="font-semibold">{titleOf(m.id).split(/[:(]/)[0].trim()}</span> <span className="text-ink-3">— {reasonOf(m.reason)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Rsvp({
  item,
  slot,
  plan,
  isOrganizer,
  onAnswer,
}: {
  item: PlanItemLike;
  slot: PlanSlotLike;
  plan: PublicPlan;
  isOrganizer: boolean;
  onAnswer: (key: string, status: "in" | "skip" | null, choice?: string) => void;
}) {
  const { catalog } = useEngine();
  const family = useFamily();
  const sum = plan.rsvps[item.key];
  if (item.id === STAY_ID || !sum) return null;
  const split = item.role === "main" ? plan.slots.find((s) => s.key === slot.key)?.split : null;
  const mine = sum.mine;
  const name = (id: string) => catalog.byId[family ? catalog.familyIdFor(id) : id]?.title.split(/[:·(]/)[0].trim() ?? id;
  const pill = (on: boolean) =>
    cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-bold transition active:scale-95", on ? "bg-ink text-paper" : "bg-surface-100 text-ink-2 ring-1 ring-surface-200 hover:bg-surface-200");
  const label = (s: Slot) => catalog.preset.structure.slots[s].label.toLowerCase();
  return (
    <div className="px-1 pb-1">
      {split && (
        <p className="mb-1.5 rounded-xl bg-secondary-800 px-3 py-2 text-[12.5px] leading-snug text-paper">
          <b>The group splits up this {label(slot.slot)}:</b> {split.a.votes} picked {name(split.a.id)}, {split.b.votes} picked {name(split.b.id)}. Which are you down for?
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Your answer for ${name(item.id)}`}>
        {split ? (
          [split.a.id, split.b.id].map((id) => (
            <button key={id} onClick={() => onAnswer(item.key, mine?.status === "in" && mine.choice === id ? null : "in", id)} aria-pressed={mine?.status === "in" && mine.choice === id} className={pill(mine?.status === "in" && mine.choice === id)}>
              {mine?.status === "in" && mine.choice === id && <Check className="size-3.5" />} {name(id)}
              <span className="font-semibold opacity-60">{sum.choices[id] ?? 0}</span>
            </button>
          ))
        ) : (
          <button onClick={() => onAnswer(item.key, mine?.status === "in" ? null : "in")} aria-pressed={mine?.status === "in"} className={pill(mine?.status === "in")}>
            {mine?.status === "in" && <Check className="size-3.5" />} I&apos;m in
          </button>
        )}
        <button onClick={() => onAnswer(item.key, mine?.status === "skip" ? null : "skip")} aria-pressed={mine?.status === "skip"} className={pill(mine?.status === "skip")}>
          I&apos;ll skip
        </button>
        <span className="ml-auto text-[12px] font-semibold tabular-nums text-ink-3" aria-label="Headcount">
          {sum.in} in · {sum.skip} skipping
        </span>
      </div>
      {isOrganizer && sum.names && sum.in + sum.skip > 0 && (
        <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
          {sum.names.in.length > 0 && <>In: {sum.names.in.join(", ")}. </>}
          {sum.names.skip.length > 0 && <>Skipping: {sum.names.skip.join(", ")}.</>}
        </p>
      )}
    </div>
  );
}
