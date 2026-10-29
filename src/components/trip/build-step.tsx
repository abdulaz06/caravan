"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, Eye, GripVertical, Info, Repeat2, Sparkles, Sunrise, Trash2, Wand2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { Activity, Base } from "@/engine/catalog";
import type { BudgetResult } from "@/engine/budget";
import { lateNightItems, tripPlaceable, variantOf } from "@/engine/day-trip";
import {
  STAY_ID,
  addItem,
  canMoveItem,
  canReorder,
  clearAllPicks,
  countItems,
  dateAt,
  filledSlots,
  isSpecialOption,
  moveItem,
  moveItemWithin,
  pickFirst,
  plansOf,
  removeItem,
  reorderDays,
  replaceItem,
  resolve,
  setNote,
  setVariant,
  slotArea,
  specialAt,
  type DayEntry,
  type ItineraryData,
  type SlotKind,
} from "@/engine/itinerary";
import { quickFill } from "@/engine/quickfill";
import { daysNightsLabel, nightsFor, nightsLine, structureNote } from "@/engine/structure";
import { balanceOf, buildTimeline, type TimelineDay } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { useArt } from "../brand/art";
import { useEngine } from "../engine";
import { Button } from "../ui/button";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { BalanceMeter } from "./balance-meter";
import { BudgetPill } from "./budget";
import { CatalogSheet } from "./catalog-sheet";
import { DateStub, DayCard, StayThumb, type DragBits } from "./day-card";
import { VariantSheet } from "./day-trip";
import { MatchupSheet } from "./matchup-sheet";
import { OptionDetail } from "./option-detail";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  budget: BudgetResult;
  onOpenBudget: () => void;
  onBack: () => void;
  onNext: () => void;
};

type SlotRef = { index: number; slot: SlotKind };
type ItemRef = SlotRef & { key: string };
/** A big day trip needs a variant before it's placed (or when switching). */
type TripAsk = SlotRef & { id: string; mode: "first" | "add" | "replace" | "switch"; pairId?: string; key?: string; current?: string };

export function BuildStep({ data, update, locked, budget, onOpenBudget, onBack, onNext }: Props) {
  const e = useEngine();
  const { catalog } = e;
  const toast = useToast();
  const timeline = useMemo(() => buildTimeline(e, data), [e, data]);
  const balance = useMemo(() => balanceOf(e, data), [e, data]);
  const filled = filledSlots(e, data);
  const items = countItems(data);
  const n = data.days.length;
  const plans = plansOf(e, data);

  const [matchup, setMatchup] = useState<SlotRef | null>(null);
  const [catalogRef, setCatalogRef] = useState<(SlotRef & { replace?: string }) | null>(null);
  const [itemRef, setItemRef] = useState<ItemRef | null>(null);
  const [moving, setMoving] = useState(false);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [fillAsk, setFillAsk] = useState(false);
  const [fillKey, setFillKey] = useState(0);
  const [tripAsk, setTripAsk] = useState<TripAsk | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** One section per base: its days in order (the fly-home day goes with the last). */
  const sections = useMemo(() => {
    // A 1-day trip has no nights: its one day sits with the first base.
    const split = n === 1 ? [{ base: plans[0].base, nights: 0 }] : nightsFor(e, n).filter((s) => s.nights > 0);
    return split.map(({ base, nights }, k) => {
      const days = plans.filter((p) => p.base.id === base.id && p.kind !== "departure").map((p) => p.index);
      const last = k === split.length - 1;
      return { base, nights, from: days[0] ?? 0, days, departure: last && n > 1 ? n - 1 : null };
    });
  }, [e, n, plans]);

  /** Options with variants (big day trips) ask how first; everything else goes straight in. */
  function needsVariant(id: string, ask: Omit<TripAsk, "id">): boolean {
    const a = catalog.byId[id];
    if (!a?.variants) return false;
    const ok = tripPlaceable(e, data, ask.index, a);
    if (!ok.ok) {
      toast(ok.reason);
      return true;
    }
    setTripAsk({ ...ask, id });
    return true;
  }

  function chooseTrip(variant: string) {
    const ask = tripAsk;
    setTripAsk(null);
    if (!ask) return;
    update((d) => {
      if (ask.mode === "first") return pickFirst(e, d, ask.index, ask.slot, ask.id, ask.pairId, variant);
      if (ask.mode === "add") return addItem(e, d, ask.index, ask.slot, ask.id, undefined, variant);
      if (ask.mode === "replace") return replaceItem(e, d, ask.index, ask.slot, ask.key!, ask.id, undefined, variant);
      return setVariant(e, d, ask.index, ask.slot, ask.key!, variant);
    });
    const v = variantOf(catalog.byId[ask.id], variant);
    toast(`${v?.emoji ?? "⛰"} ${v?.title} on Day ${ask.index + 1}`);
    // A gentle heads-up, never a block: a very early variant leaves in the small hours.
    const late = v?.eveBefore && ask.index > 0 ? lateNightItems(e, data, ask.index - 1) : [];
    if (late.length) toast(`Heads-up: Day ${ask.index}'s evening has ${late[0].title.split(":")[0]} and you leave ${v!.leave} — maybe keep it short`);
  }

  function onDragEnd(ev: DragEndEvent) {
    if (!ev.over || ev.active.id === ev.over.id) return;
    const from = data.days.findIndex((d) => d.id === ev.active.id);
    const to = data.days.findIndex((d) => d.id === ev.over!.id);
    if (from < 0 || to < 0) return;
    if (!canReorder(e, data, from, to)) {
      toast(`Only the ${plans[from]?.base.name} days can swap around`);
      return;
    }
    update((d) => reorderDays(e, d, from, to));
  }

  function runQuickFill(onlyEmpty: boolean) {
    setFillAsk(false);
    update((d) => quickFill(e, d, { onlyEmpty }));
    setFillKey((k) => k + 1);
    toast("✨ Filled! Tweak anything you like.");
  }

  if (!data.startDate) {
    return (
      <div className="px-5 pt-16 text-center">
        <p className="font-display text-2xl font-semibold">Place your dates first</p>
        <Button className="mt-6" onClick={onBack}>
          <ArrowLeft className="size-4" /> Choose dates
        </Button>
      </div>
    );
  }

  const cardProps = (i: number) => ({
    entry: data.days[i],
    index: i,
    length: n,
    t: timeline.days[i],
    locked,
    onFirst: (slot: SlotKind) => !locked && setMatchup({ index: i, slot }),
    onAdd: (slot: SlotKind) => !locked && setCatalogRef({ index: i, slot }),
    onStayIn: () => {
      if (locked) return;
      update((d) => (d.days[i].night.length ? addItem(e, d, i, "night", STAY_ID) : pickFirst(e, d, i, "night", STAY_ID)));
      toast(`Stay in added to Day ${i + 1}'s evening`);
    },
    onItem: (slot: SlotKind, key: string) => {
      if (locked) return;
      setMoving(false);
      setItemRef({ index: i, slot, key });
    },
    onNote: () => {
      setNoteText(data.days[i].note ?? "");
      setNoteFor(i);
    },
  });

  const row = (i: number, sortable = false) => (
    <motion.li
      key={sortable ? data.days[i].id : `fixed-${i}`}
      initial={fillKey ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="flex"
    >
      <DateStub date={dateAt(data, i)} index={i} t={timeline.days[i]} />
      {sortable ? <SortableDay {...cardProps(i)} /> : <DayCard {...cardProps(i)} />}
    </motion.li>
  );

  // Item sheet state
  const it = itemRef ? data.days[itemRef.index]?.[itemRef.slot].find((x) => x.key === itemRef.key) : undefined;
  const itPos = itemRef && it ? data.days[itemRef.index][itemRef.slot].indexOf(it) : -1;
  const itCount = itemRef ? data.days[itemRef.index][itemRef.slot].length : 0;
  const itArea = itemRef ? slotArea(e, data, itemRef.index, itemRef.slot) : null;
  const itResolved = itemRef && it ? resolve(e, it, itemRef.slot, itArea) : null;
  const itActivity = itResolved?.kind === "activity" ? itResolved.activity : null;
  const itTitle = itResolved ? (itResolved.kind === "stay" ? itResolved.stay.title : itResolved.activity.title) : "";
  const itOnRoute = !!itemRef && itemRef.slot === "day" && plans[itemRef.index]?.transfer?.dayArea === itArea;
  const moveTargets = itemRef && it ? data.days.map((_, i) => canMoveItem(e, data, itemRef.slot, itemRef.index, i, it.id)) : [];
  const canMoveAnywhere = moveTargets.some(Boolean);
  const closeItem = () => setItemRef(null);
  const itSpecial = itemRef ? specialAt(e, data, itemRef.index) : null;
  const otherVariant = itActivity?.variants?.find((v) => v.id !== variantOf(itActivity, it?.variant)?.id);
  const slotLabel = (slot: SlotKind) => catalog.preset.structure.slots[slot].label;

  return (
    <div className="grain pb-36">
      <section className="relative z-[1] px-5 pt-6">
        <p className="label text-accent-600">Step 2 · Your days</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          Build your <span className="italic text-primary-700">days</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          {daysNightsLabel(n)}: {nightsLine(e, n)}. Pick a {slotLabel("day").toLowerCase()} and an {slotLabel("night").toLowerCase()} — and add as
          much to each as you like.
        </p>
        {structureNote(e, n) && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-highlight-100 px-3 py-2 text-[13px] leading-snug text-ink-2 ring-1 ring-highlight-200">
            <Info className="mt-0.5 size-4 shrink-0 text-highlight-600" />
            {structureNote(e, n)} — longer dates bring it back.
          </p>
        )}
        <StaysBanner stays={sections.map((s) => ({ base: s.base, nights: s.nights }))} className="mt-4" />
        {!locked && (
          <div className="mt-4 flex gap-2.5">
            <Button variant="ocean" size="md" className="flex-1" onClick={() => (items > 0 ? setFillAsk(true) : runQuickFill(false))}>
              <Wand2 className="size-[18px]" /> Quick fill
            </Button>
            {items > 0 && (
              <Button
                variant="light"
                size="md"
                onClick={() => {
                  update(clearAllPicks);
                  toast("Cleared — a fresh start");
                }}
              >
                <Trash2 className="size-4" /> Clear
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="sticky top-[calc(5.75rem+env(safe-area-inset-top))] z-30 mt-5 px-3">
        <div className="space-y-2 rounded-[22px] bg-paper/90 px-3.5 py-3 shadow-card ring-1 ring-ink/[0.04] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-0.5 text-[12.5px] font-semibold">
            <span className="text-ink-2">
              {filled.filled}/{filled.total} slots planned · {items} {items === 1 ? "thing" : "things"}
            </span>
            <span className="shrink-0 text-ink-3">~{Math.round(timeline.totalHours)} hrs on the road</span>
          </div>
          <BalanceMeter balance={balance} size="compact" />
          <BudgetPill budget={budget} onOpen={onOpenBudget} />
        </div>
      </div>

      {sections.map((s, k) => {
        const fixed = s.days.filter((i) => !plans[i].reorderable);
        const sortable = s.days.filter((i) => plans[i].reorderable);
        const to = s.from + s.days.length + (s.departure !== null ? 1 : 0);
        return (
          <section key={s.base.id} className={cn("relative z-[1]", k ? "mt-6" : "mt-5")} aria-label={s.base.name}>
            <SectionHeader
              base={s.base}
              kicker={`${to - s.from > 1 ? `Days ${s.from + 1}–${to}` : `Day ${s.from + 1}`} · ${s.nights} ${s.nights === 1 ? "night" : "nights"}`}
            />
            {fixed.length > 0 && (
              <ol key={`f${s.base.id}${fillKey}`} className="mt-3 space-y-3 px-3">
                {fixed.map((i) => row(i))}
              </ol>
            )}
            {sortable.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
                <SortableContext items={sortable.map((i) => data.days[i].id)} strategy={verticalListSortingStrategy}>
                  <ol key={`s${s.base.id}${fillKey}`} className="mt-3 space-y-3 px-3">
                    {sortable.map((i) => row(i, true))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
            {s.departure !== null && (
              <ol key={`d${fillKey}`} className="mt-3 space-y-3 px-3">
                {row(s.departure)}
              </ol>
            )}
          </section>
        );
      })}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 flex gap-2.5 bg-gradient-to-t from-surface-100 via-surface-100/90 to-transparent px-4 pt-6 lg:left-auto lg:w-[480px]">
        <Button variant="light" size="lg" onClick={onBack} aria-label="Back to dates" className="px-5">
          <ArrowLeft className="size-5" />
        </Button>
        <Button size="lg" className="flex-1" onClick={onNext}>
          Next: a few extras <ArrowRight className="size-5" strokeWidth={2.5} />
        </Button>
      </div>

      {/* ── Sheets ─────────────────────────────────────────── */}
      {matchup && (
        <MatchupSheet
          open={!!matchup}
          onClose={() => setMatchup(null)}
          data={data}
          index={matchup.index}
          slot={matchup.slot}
          onPick={(id, pairId) => {
            if (needsVariant(id, { index: matchup.index, slot: matchup.slot, mode: "first", pairId })) return;
            update((d) => pickFirst(e, d, matchup.index, matchup.slot, id, pairId));
          }}
          onStay={() => update((d) => pickFirst(e, d, matchup.index, matchup.slot, STAY_ID))}
        />
      )}
      {catalogRef && (
        <CatalogSheet
          open={!!catalogRef}
          onClose={() => setCatalogRef(null)}
          data={data}
          index={catalogRef.index}
          slot={catalogRef.slot}
          mode={catalogRef.replace ? "replace" : "add"}
          onChoose={(id) => {
            const c = catalogRef;
            if (needsVariant(id, { index: c.index, slot: c.slot, mode: c.replace ? "replace" : "add", key: c.replace })) return;
            update((d) => (c.replace ? replaceItem(e, d, c.index, c.slot, c.replace, id) : addItem(e, d, c.index, c.slot, id)));
            toast(c.replace ? "Swapped" : `Added to Day ${c.index + 1}`);
          }}
        />
      )}

      <Sheet
        open={!!itemRef && !!it}
        onClose={closeItem}
        eyebrow={itemRef ? `Day ${itemRef.index + 1} · ${itOnRoute ? "On the way" : slotLabel(itemRef.slot)}${itCount > 1 ? ` · ${itPos + 1} of ${itCount}` : ""}` : ""}
        title={itTitle}
      >
        {itemRef && it && !moving && (
          <div className="grid gap-2 px-4 pb-10 pt-1">
            {itActivity && <ActionRow icon={Eye} label="See details" onClick={() => setDetail(itActivity)} />}
            {itActivity?.variants && otherVariant && (
              <ActionRow
                icon={Sunrise}
                label={`Switch to ${otherVariant.title}`}
                onClick={() => {
                  const ref = itemRef;
                  closeItem();
                  setTripAsk({ index: ref.index, slot: ref.slot, id: it.id, mode: "switch", key: ref.key, current: variantOf(itActivity, it.variant)?.id });
                }}
              />
            )}
            {itCount > 1 && (
              <div className="grid grid-cols-2 gap-2">
                <ActionRow icon={ArrowUp} label="Earlier" disabled={itPos <= 0} onClick={() => update((d) => moveItemWithin(e, d, itemRef.index, itemRef.slot, it.key, itPos - 1))} />
                <ActionRow
                  icon={ArrowDown}
                  label="Later"
                  disabled={itPos >= itCount - 1}
                  onClick={() => update((d) => moveItemWithin(e, d, itemRef.index, itemRef.slot, it.key, itPos + 1))}
                />
              </div>
            )}
            <ActionRow
              icon={Repeat2}
              label={itPos === 0 ? "Change pick" : "Swap for something else"}
              onClick={() => {
                const ref = itemRef;
                closeItem();
                if (itPos === 0) setMatchup({ index: ref.index, slot: ref.slot });
                else setCatalogRef({ index: ref.index, slot: ref.slot, replace: ref.key });
              }}
            />
            {canMoveAnywhere && <ActionRow icon={ArrowRightLeft} label="Move to another day" onClick={() => setMoving(true)} />}
            {!canMoveAnywhere && isSpecialOption(e, it.id) && itSpecial && (
              <p className="px-1 text-[12.5px] text-ink-3">
                {itSpecial.name} picks stay pinned to {dayLabel(dateAt(data, itemRef.index)!).split(" ").slice(1).join(" ")}.
              </p>
            )}
            <ActionRow
              icon={Trash2}
              label="Remove"
              danger
              onClick={() => {
                update((d) => removeItem(e, d, itemRef.index, itemRef.slot, it.key));
                closeItem();
              }}
            />
          </div>
        )}
        {itemRef && it && moving && (
          <div className="px-4 pb-8">
            <p className="px-1 pb-3 text-[14px] text-ink-2">Pick a day — it goes to the end of that day&apos;s {slotLabel(itemRef.slot).toLowerCase()}.</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {data.days.map((d, i) => {
                if (i === itemRef.index) return null;
                return (
                  <li key={d.id}>
                    <MoveTarget
                      data={data}
                      day={d}
                      index={i}
                      slot={itemRef.slot}
                      t={timeline.days[i]}
                      ok={moveTargets[i]}
                      onClick={() => {
                        update((cur) => moveItem(e, cur, itemRef.slot, itemRef.index, it.key, i));
                        closeItem();
                        toast(`Moved to Day ${i + 1}`);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Sheet>

      {tripAsk && catalog.byId[tripAsk.id] && (
        <VariantSheet
          open
          activity={catalog.byId[tripAsk.id]}
          data={data}
          index={tripAsk.index}
          current={tripAsk.current}
          onClose={() => setTripAsk(null)}
          onChoose={chooseTrip}
        />
      )}

      <OptionDetail open={!!detail} option={detail} area={itArea ?? undefined} onClose={() => setDetail(null)} />

      <Sheet
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        size="auto"
        eyebrow={noteFor !== null ? `Day ${noteFor + 1} · ${dayLabel(dateAt(data, noteFor)!)}` : ""}
        title="A note for this day"
        footer={
          <Button
            size="lg"
            block
            onClick={() => {
              if (noteFor !== null) update((d) => setNote(d, noteFor, noteText));
              setNoteFor(null);
            }}
          >
            Save note
          </Button>
        }
      >
        <div className="px-5 pb-4">
          <textarea
            autoFocus
            value={noteText}
            maxLength={280}
            onChange={(ev) => setNoteText(ev.target.value)}
            rows={4}
            placeholder="e.g. My birthday! · Would love to do this with Sam · Could skip if we're tired"
            className="w-full resize-none rounded-2xl border-2 border-surface-300 bg-paper p-4 text-[16px] outline-none focus:border-primary-600"
          />
          <p className="mt-1 text-right text-xs text-ink-3">{noteText.length}/280</p>
        </div>
      </Sheet>

      <Sheet open={fillAsk} onClose={() => setFillAsk(false)} size="auto" eyebrow="Quick fill" title="Keep your picks?">
        <div className="grid gap-2.5 px-5 pb-8">
          <p className="pb-1 text-[15px] text-ink-2">We&apos;ll put one balanced pick in each empty slot — adventures, food and nights out — keeping travel light.</p>
          <Button size="lg" variant="ocean" onClick={() => runQuickFill(true)}>
            <Sparkles className="size-5" /> Fill the empty slots
          </Button>
          <Button size="lg" variant="light" onClick={() => runQuickFill(false)}>
            Start fresh — replace everything
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function SortableDay(props: React.ComponentProps<typeof DayCard>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.id,
    disabled: props.locked,
  });
  const drag: DragBits = {
    setNodeRef,
    handle: (
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder day ${props.index + 1}`}
        className="grid size-8 cursor-grab touch-none place-items-center rounded-full text-ink-3 transition hover:bg-surface-200 active:cursor-grabbing"
      >
        <GripVertical className="size-[18px]" />
      </button>
    ),
    style: { transform: CSS.Translate.toString(transform), transition },
    isDragging,
  };
  return <DayCard {...props} drag={drag} />;
}

function MoveTarget({
  data,
  day,
  index,
  slot,
  t,
  ok,
  onClick,
}: {
  data: ItineraryData;
  day: DayEntry;
  index: number;
  slot: SlotKind;
  t: TimelineDay;
  ok: boolean;
  onClick: () => void;
}) {
  const e = useEngine();
  const first = day[slot][0];
  const r = first ? resolve(e, first, slot, t.plan.areas[slot]) : null;
  const label = r ? (r.kind === "stay" ? r.stay.title : r.activity.title) : "Nothing yet";
  const why =
    t.plan.kind === "departure"
      ? "Fly-home day"
      : t.special?.slot === slot
        ? `${t.special.name} stays put`
        : slot === "day" && t.day.onRoute
          ? "Stops on the way only"
          : `${t.plan.base.name} day`;
  return (
    <button
      disabled={!ok}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-paper p-2.5 text-left shadow-card transition enabled:hover:-translate-y-0.5 disabled:opacity-40"
    >
      <span className="grid w-12 shrink-0 text-center">
        <span className="label text-ink-3">Day {index + 1}</span>
        <span className="text-[12px] font-semibold">{dayLabel(dateAt(data, index)!).split(" ").slice(1).join(" ")}</span>
      </span>
      {r?.kind === "stay" ? (
        <StayThumb kind={slot} className="size-11" />
      ) : (
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-surface-200">
          {r?.kind === "activity" && <Photo photo={r.activity.images[0]} alt={label} sizes="44px" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[14px] font-semibold", !first && "text-ink-3")}>{ok ? label : why}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{t.name}</span>
      </span>
    </button>
  );
}

/** "Colombo · 1 night → Galle · 4 nights" as photo tiles. */
export function StaysBanner({ stays, className }: { stays: { base: Base; nights: number }[]; className?: string }) {
  const { Vehicle } = useArt();
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={stays.map((s) => `${s.base.name} ${s.nights} ${s.nights === 1 ? "night" : "nights"}`).join(", then ")}>
      {stays.map((s, k) => (
        <Fragment key={s.base.id}>
          {k > 0 && (
            <span className="flex shrink-0 flex-col items-center text-primary-600">
              <Vehicle className="h-5 w-8" />
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </span>
          )}
          <div className="relative flex h-[68px] min-w-0 flex-1 items-end overflow-hidden rounded-2xl bg-primary-800 p-2.5 text-paper">
            <Photo photo={s.base.images[0]} alt={s.base.name} sizes="200px" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/5" />
            <span className="relative [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
              <span className="font-display block text-[19px] font-semibold leading-none">{s.base.name}</span>
              <span className="text-[12px] font-semibold text-paper/85">
                {s.nights} {s.nights === 1 ? "night" : "nights"}
              </span>
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function SectionHeader({ base, kicker }: { base: Base; kicker: string }) {
  return (
    <div className="mx-3 overflow-hidden rounded-[22px] bg-primary-800 text-paper shadow-card">
      <div className="relative h-24">
        <Photo photo={base.images[0]} alt={base.name} sizes="(min-width: 1024px) 460px, 94vw" />
        <span className="absolute inset-0 bg-gradient-to-r from-primary-950/90 via-primary-950/55 to-transparent" />
        <div className="relative flex h-full flex-col justify-center px-4">
          <p className="label text-highlight-400">{kicker}</p>
          <h2 className="font-display text-[28px] font-semibold leading-none">{base.name}</h2>
          <p className="mt-1 text-[12.5px] text-paper/80">{base.tagline}</p>
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-14 items-center gap-3 rounded-2xl bg-paper px-4 text-left text-[16px] font-semibold shadow-card transition enabled:hover:-translate-y-0.5 enabled:active:scale-[0.99] disabled:opacity-40",
        danger && "text-accent-600",
      )}
    >
      <Icon className={cn("size-5", danger ? "text-accent-500" : "text-primary-600")} />
      {label}
    </button>
  );
}
