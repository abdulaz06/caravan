"use client";

import { Award, CalendarCheck2, Clock3, Coins, Lock, Mountain, Plane, Repeat2, Scale, Sparkles, Sun, Moon, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { Activity, Slot } from "@/engine/catalog";
import type { PlanItem, PlanSlot, Reason, ReasonKind } from "@/engine/consensus/types";
import { bannedIn } from "@/engine/family-words";
import type { ItineraryData } from "@/engine/itinerary";
import { dayRoutes } from "@/engine/routes";
import type { Timeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { useArt } from "../brand/art";
import { useCurrency } from "../currency";
import { Firework } from "../brand/illustrations";
import { useEngine } from "../engine";
import { useFamily } from "../family";
import { RoadTrip } from "../trip/bits";
import { ItemRow, tripShortName } from "../trip/day-card";
import { OptionDetail } from "../trip/option-detail";
import { TripMap } from "../trip/trip-map";

/** The bits of a plan the day view needs (the organizer's full plan or a traveller's public one). */
export type PlanItemLike = Pick<PlanItem, "key" | "id" | "role" | "votes" | "present" | "reasons" | "runnerUp"> & { locked?: boolean; variant?: string };
export type PlanSlotLike = Pick<PlanSlot, "key" | "day" | "date" | "slot" | "special"> & { items: PlanItemLike[] };

const REASON_ICONS: Record<ReasonKind, typeof Users> = {
  votes: Users,
  fair: Scale,
  weekday: CalendarCheck2,
  special: Sparkles,
  travel: Mountain,
  locked: Lock,
  rest: Moon,
  variant: Sun,
  budget: Wallet,
  free: Sun,
  extra: Award,
  time: Clock3,
};

/** "9 of 12 picked this", "Fridays only — fits Fri 1 Jan", … as small chips. */
export function ReasonChips({ reasons, runnerUp, className }: { reasons: Reason[]; runnerUp?: { id: string; votes: number } | null; className?: string }) {
  const { catalog } = useEngine();
  const family = useFamily();
  const runner = runnerUp ? catalog.byId[family ? catalog.familyIdFor(runnerUp.id) : runnerUp.id] : null;
  // Family-friendly mode shows no nightlife words: a runner-up that's nightlife is left out.
  const showRunner = runner && !(family && catalog.isNightlife(catalog.byId[runnerUp!.id]));
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label="Why it's in the plan">
      {/* Family-friendly mode: no reason that names a nightlife pick. */}
      {reasons.filter((r) => !family || !bannedIn(r.text).length).map((r) => {
        const Icon = REASON_ICONS[r.kind];
        const fair = r.kind === "fair";
        return (
          <li
            key={r.text}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-snug",
              fair ? "bg-secondary-100 text-secondary-800" : r.kind === "locked" ? "bg-ink text-paper" : r.kind === "special" ? "bg-night-900 text-highlight-400" : "bg-surface-200 text-ink-2",
            )}
          >
            <Icon className="size-3 shrink-0" strokeWidth={2.5} />
            {family && r.kind === "special" ? r.text.replace(/ vs .*$/, "") : r.text}
          </li>
        );
      })}
      {showRunner && (
        <li className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[11.5px] font-medium text-ink-3 ring-1 ring-surface-200">
          <Repeat2 className="size-3 shrink-0" /> Runner-up: {runner!.title.split(/[:·(]/)[0].trim()} · {runnerUp!.votes}
        </li>
      )}
    </ul>
  );
}

type DaysProps = {
  /** What's shown (the plan's itinerary, or its family-friendly view). */
  data: ItineraryData;
  timeline: Timeline;
  slots: PlanSlotLike[];
  /** Under each item (RSVP buttons, organizer actions). */
  renderItem?: (item: PlanItemLike, slot: PlanSlotLike) => React.ReactNode;
  /** After a slot's items (split cards). */
  renderSlot?: (slot: PlanSlotLike) => React.ReactNode;
  /** Hide the reason chips (the print view lists them its own way). */
  reasons?: boolean;
};

/** The plan, day by day: the trip's own item rows and road legs, with each item's reasons. */
export function PlanDays({ data, timeline, slots, renderItem, renderSlot, reasons = true }: DaysProps) {
  const e = useEngine();
  const { Icon } = useArt();
  const { preset } = e.catalog;
  const [detail, setDetail] = useState<{ a: Activity; area: string | null } | null>(null);
  const byKey = useMemo(() => new Map(slots.map((s) => [`${s.day}:${s.slot}`, s])), [slots]);
  return (
    <>
      <ol className="space-y-3">
        {timeline.days.map((t) => {
          const date = data.startDate ? t.date : null;
          return (
            <li key={t.index} className="rounded-[24px] bg-paper p-3.5 shadow-card" aria-label={`Day ${t.index + 1}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="label text-ink-3">Day {t.index + 1}</span>
                <h3 className="font-display text-[19px] font-semibold leading-none">{date ? dayLabel(date) : `Day ${t.index + 1}`}</h3>
                <span className="text-[12px] font-bold text-primary-700">{t.name}</span>
                {t.special && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-pop-600">
                    <Firework className="size-3.5" /> {t.special.name}
                  </span>
                )}
                {t.trip && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-secondary-700">
                    <Icon name={t.trip.activity.icon} className="size-4" /> {tripShortName(t.trip.activity.title)}
                  </span>
                )}
              </div>
              <div className="mt-2.5 space-y-2">
                {t.legsBefore.map((l) => (
                  <RoadTrip key={l.title} seg={l} />
                ))}
                {t.plan.kind === "departure" ? (
                  <p className="flex items-start gap-2 rounded-2xl bg-primary-100/60 px-3 py-2.5 text-[13px] text-primary-900">
                    <Plane className="mt-0.5 size-4 shrink-0" /> {preset.structure.departure.text} {preset.destination.farewell}
                  </p>
                ) : (
                  (["day", "night"] as Slot[]).map((slot) => {
                    const view = t[slot];
                    const ps = byKey.get(`${t.index}:${slot}`);
                    if (!view.area || !ps) return null;
                    return (
                      <section key={slot} aria-label={`${preset.structure.slots[slot].label}, day ${t.index + 1}`} className="space-y-1.5">
                        <p className={cn("label flex items-center gap-1.5 pl-1 pt-1", slot === "night" ? "text-night-700" : "text-accent-600")}>
                          {slot === "night" ? <Moon className="size-3" /> : <Sun className="size-3" />}
                          {view.onRoute ? "On the way" : preset.structure.slots[slot].label}
                        </p>
                        {view.items.map((it, n) => {
                          const pi = ps.items.find((x) => x.key === it.item.key) ?? ps.items[n];
                          const a = it.resolved.kind === "activity" ? it.resolved.activity : null;
                          return (
                            <div key={it.item.key} className="space-y-1">
                              {it.before && <RoadTrip seg={it.before} />}
                              <ItemRow kind={slot} view={it} area={view.area} date={date} locked first={n === 0} onClick={a ? () => setDetail({ a, area: view.area }) : undefined} />
                              {pi && reasons && <ReasonChips reasons={pi.reasons} runnerUp={pi.role === "main" ? pi.runnerUp : null} className="px-1" />}
                              {pi && renderItem?.(pi, ps)}
                            </div>
                          );
                        })}
                        {renderSlot?.(ps)}
                        {view.after && <RoadTrip seg={view.after} />}
                      </section>
                    );
                  })
                )}
                {t.legsAfter.map((l) => (
                  <RoadTrip key={l.title} seg={l} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <OptionDetail open={!!detail} option={detail?.a ?? null} area={detail?.area ?? undefined} onClose={() => setDetail(null)} />
    </>
  );
}

/** The plan's route map, a day at a time if you like. */
export function PlanMap({ data, timeline }: { data: ItineraryData; timeline: Timeline }) {
  const e = useEngine();
  const routes = useMemo(() => dayRoutes(e, data, timeline), [e, data, timeline]);
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className="overflow-hidden rounded-[26px] bg-primary-800 p-3 text-paper shadow-card" aria-label="Route map">
      <TripMap routes={routes} active={active} onActive={setActive} className="rounded-2xl" />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar" role="group" aria-label="Highlight a day">
        <button
          onClick={() => setActive(null)}
          aria-pressed={active === null}
          className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-bold", active === null ? "bg-highlight-400 text-ink" : "bg-white/10 text-paper/80")}
        >
          All days
        </button>
        {timeline.days.map((t) => (
          <button
            key={t.index}
            onClick={() => setActive(active === t.index ? null : t.index)}
            aria-pressed={active === t.index}
            className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-bold", active === t.index ? "bg-highlight-400 text-ink" : "bg-white/10 text-paper/80")}
          >
            Day {t.index + 1}
          </button>
        ))}
      </div>
    </section>
  );
}

/** "≈ $460–1,110 each" (in the viewer's currency) with the group's budget check. */
export function PlanBudget({ budget }: { budget: { perPerson: [number, number]; withBudget: number; over: number; note: string | null } }) {
  const { range, money } = useCurrency();
  const mid = Math.round((budget.perPerson[0] + budget.perPerson[1]) / 2);
  return (
    <section className="flex items-start gap-3 rounded-[22px] bg-paper p-3.5 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-highlight-200 text-ink">
        <Coins className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight">≈ {range(budget.perPerson)} each</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">
          Activities, shared transport and a mid-range place to stay, per person (flights not included).
          {budget.withBudget > 0 &&
            (budget.over ? ` About ${money(mid)} is over the budget ${budget.over} of ${budget.withBudget} people set.` : " Fits every budget people set.")}
        </p>
      </div>
    </section>
  );
}
