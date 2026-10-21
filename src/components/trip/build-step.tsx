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
import { ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, Eye, GripVertical, Repeat2, Sparkles, Sunrise, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { activitiesById, stays, type Activity } from "@/content";
import { ELLA_ID, lateNightItems, tripPlaceable, tripVariant, tripVariants } from "@/lib/day-trip";
import type { BudgetResult } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import {
  DAY_NAMES,
  STAY_ID,
  addItem,
  canMoveItem,
  canReorder,
  clearAllPicks,
  countItems,
  dateAt,
  filledSlots,
  isNyeOption,
  moveItem,
  moveItemWithin,
  nights,
  pickFirst,
  removeItem,
  reorderDays,
  replaceItem,
  resolve,
  roleAt,
  setNote,
  setVariant,
  slotWhere,
  type DayEntry,
  type ItineraryData,
  type SlotKind,
} from "@/lib/itinerary";
import { quickFill } from "@/lib/quickfill";
import { balanceOf, buildTimeline, type TimelineDay } from "@/lib/timeline";
import { Van } from "../brand/illustrations";
import { Button } from "../ui/button";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { BalanceMeter } from "./balance-meter";
import { BudgetPill } from "./budget";
import { CatalogSheet } from "./catalog-sheet";
import { DateStub, DayCard, StayThumb, type DragBits } from "./day-card";
import { MatchupSheet } from "./matchup-sheet";
import { OptionDetail } from "./option-detail";
import { VariantSheet } from "./day-trip";

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
/** The Ella day trip needs a variant before it's placed (or when switching). */
type TripAsk = SlotRef & { mode: "first" | "add" | "replace" | "switch"; pairId?: string; key?: string; current?: string };

export function BuildStep({ data, update, locked, budget, onOpenBudget, onBack, onNext }: Props) {
  const toast = useToast();
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const balance = useMemo(() => balanceOf(data), [data]);
  const filled = filledSlots(data);
  const items = countItems(data);
  const n = data.days.length;
  const nts = nights(n);

  const [matchup, setMatchup] = useState<SlotRef | null>(null);
  const [catalog, setCatalog] = useState<(SlotRef & { replace?: string }) | null>(null);
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

  const all = data.days.map((_, i) => i);
  const colomboIdx = all.filter((i) => roleAt(data, i) === "colombo");
  const transferIdx = all.filter((i) => roleAt(data, i) === "transfer");
  const galleIdx = all.filter((i) => roleAt(data, i) === "galle");

  /** Options with variants (the Ella day trip) ask how first; everything else goes straight in. */
  function needsVariant(id: string, ask: TripAsk): boolean {
    if (!activitiesById[id]?.variants) return false;
    const ok = tripPlaceable(data, ask.index);
    if (!ok.ok) {
      toast(ok.reason);
      return true;
    }
    setTripAsk(ask);
    return true;
  }

  function chooseTrip(variant: string) {
    const ask = tripAsk;
    setTripAsk(null);
    if (!ask) return;
    update((d) => {
      if (ask.mode === "first") return pickFirst(d, ask.index, ask.slot, ELLA_ID, ask.pairId, variant);
      if (ask.mode === "add") return addItem(d, ask.index, ask.slot, ELLA_ID, undefined, variant);
      if (ask.mode === "replace") return replaceItem(d, ask.index, ask.slot, ask.key!, ELLA_ID, undefined, variant);
      return setVariant(d, ask.index, ask.slot, ask.key!, variant);
    });
    const v = tripVariant(variant);
    toast(`${v?.emoji ?? "⛰"} ${v?.title} on Day ${ask.index + 1}`);
    // A gentle heads-up, never a block: the sunrise van leaves after midnight.
    const late = v?.eveBefore && ask.index > 0 ? lateNightItems(data, ask.index - 1) : [];
    if (late.length) toast(`Heads-up: Day ${ask.index}'s evening has ${late[0].title.split(":")[0]} and the van leaves ${v!.leave} — maybe keep it short`);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = data.days.findIndex((d) => d.id === e.active.id);
    const to = data.days.findIndex((d) => d.id === e.over!.id);
    if (from < 0 || to < 0) return;
    if (!canReorder(data, from, to)) {
      toast("Only the Galle days can swap around");
      return;
    }
    update((d) => reorderDays(d, from, to));
  }

  function runQuickFill(onlyEmpty: boolean) {
    setFillAsk(false);
    update((d) => quickFill(d, { onlyEmpty }));
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
    t: timeline.days[i],
    locked,
    onFirst: (slot: SlotKind) => !locked && setMatchup({ index: i, slot }),
    onAdd: (slot: SlotKind) => !locked && setCatalog({ index: i, slot }),
    onStayIn: () => {
      if (locked) return;
      update((d) => (d.days[i].night.length ? addItem(d, i, "night", STAY_ID) : pickFirst(d, i, "night", STAY_ID)));
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
  const itWhere = itemRef ? slotWhere(roleAt(data, itemRef.index), itemRef.slot) : null;
  const itResolved = itemRef && it ? resolve(it, itemRef.slot, itWhere) : null;
  const itActivity = itResolved?.kind === "activity" ? itResolved.activity : null;
  const itTitle = itResolved ? (itResolved.kind === "stay" ? itResolved.stay.title : itResolved.activity.title) : "";
  const moveTargets = itemRef && it ? data.days.map((_, i) => canMoveItem(data, itemRef.slot, itemRef.index, i, it.id)) : [];
  const canMoveAnywhere = moveTargets.some(Boolean);
  const closeItem = () => setItemRef(null);

  return (
    <div className="grain pb-36">
      <section className="relative z-[1] px-5 pt-6">
        <p className="label text-sunset-600">Step 2 · Your days</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          Build your <span className="italic text-ocean-700">days</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          {n} days · {nts.total} nights: {nts.colombo === 1 ? "one night" : `${nts.colombo} nights`} in Colombo, then down the coast to Galle.
          Pick a daytime and an evening — and add as much to each as you like.
        </p>
        <StaysBanner colombo={nts.colombo} galle={nts.galle} className="mt-4" />
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

      {/* Colombo · Day 1 (… or more Colombo days, per the Trip rules) */}
      <section className="relative z-[1] mt-5" aria-label="Colombo">
        <SectionHeader
          stay="colombo"
          kicker={colomboIdx.length > 1 ? `Days 1–${colomboIdx.length} · ${nts.colombo} nights` : `Day 1 · ${nts.colombo} night`}
        />
        <ol key={`c${fillKey}`} className="mt-3 space-y-3 px-3">
          {colomboIdx.map((i) => row(i))}
        </ol>
      </section>

      {/* Galle · the road trip, the Galle days and the fly-home day */}
      {n > 1 && (
        <section className="relative z-[1] mt-6" aria-label="Galle">
          <SectionHeader stay="galle" kicker={`Days ${colomboIdx.length + 1}–${n} · ${nts.galle} nights`} />
          <ol key={`r${fillKey}`} className="mt-3 space-y-3 px-3">
            {transferIdx.map((i) => row(i))}
          </ol>
          {galleIdx.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={galleIdx.map((i) => data.days[i].id)} strategy={verticalListSortingStrategy}>
                <ol key={`g${fillKey}`} className="mt-3 space-y-3 px-3">
                  {galleIdx.map((i) => row(i, true))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
          <ol key={`d${fillKey}`} className="mt-3 space-y-3 px-3">
            {row(n - 1)}
          </ol>
        </section>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 flex gap-2.5 bg-gradient-to-t from-sand-100 via-sand-100/90 to-transparent px-4 pt-6 lg:left-auto lg:w-[480px]">
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
            update((d) => pickFirst(d, matchup.index, matchup.slot, id, pairId));
          }}
          onStay={() => update((d) => pickFirst(d, matchup.index, matchup.slot, STAY_ID))}
        />
      )}
      {catalog && (
        <CatalogSheet
          open={!!catalog}
          onClose={() => setCatalog(null)}
          data={data}
          index={catalog.index}
          slot={catalog.slot}
          mode={catalog.replace ? "replace" : "add"}
          onChoose={(id) => {
            const c = catalog;
            if (needsVariant(id, { index: c.index, slot: c.slot, mode: c.replace ? "replace" : "add", key: c.replace })) return;
            update((d) => (c.replace ? replaceItem(d, c.index, c.slot, c.replace, id) : addItem(d, c.index, c.slot, id)));
            toast(c.replace ? "Swapped" : `Added to Day ${c.index + 1}`);
          }}
        />
      )}

      <Sheet
        open={!!itemRef && !!it}
        onClose={closeItem}
        eyebrow={
          itemRef
            ? `Day ${itemRef.index + 1} · ${itemRef.slot === "day" ? (itWhere === "enroute" ? "On the way" : "Daytime") : "Evening"}${itCount > 1 ? ` · ${itPos + 1} of ${itCount}` : ""}`
            : ""
        }
        title={itTitle}
      >
        {itemRef && it && !moving && (
          <div className="grid gap-2 px-4 pb-10 pt-1">
            {itActivity && <ActionRow icon={Eye} label="See details" onClick={() => setDetail(itActivity)} />}
            {it.id === ELLA_ID && (
              <ActionRow
                icon={Sunrise}
                label={`Switch to ${tripVariants().find((v) => v.id !== tripVariant(it.variant)?.id)?.title ?? "the other way"}`}
                onClick={() => {
                  const ref = itemRef;
                  closeItem();
                  setTripAsk({ index: ref.index, slot: ref.slot, mode: "switch", key: ref.key, current: tripVariant(it.variant)?.id });
                }}
              />
            )}
            {itCount > 1 && (
              <div className="grid grid-cols-2 gap-2">
                <ActionRow
                  icon={ArrowUp}
                  label="Earlier"
                  disabled={itPos <= 0}
                  onClick={() => update((d) => moveItemWithin(d, itemRef.index, itemRef.slot, it.key, itPos - 1))}
                />
                <ActionRow
                  icon={ArrowDown}
                  label="Later"
                  disabled={itPos >= itCount - 1}
                  onClick={() => update((d) => moveItemWithin(d, itemRef.index, itemRef.slot, it.key, itPos + 1))}
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
                else setCatalog({ index: ref.index, slot: ref.slot, replace: ref.key });
              }}
            />
            {canMoveAnywhere && <ActionRow icon={ArrowRightLeft} label="Move to another day" onClick={() => setMoving(true)} />}
            {!canMoveAnywhere && isNyeOption(it.id) && (
              <p className="px-1 text-[12.5px] text-ink-3">New Year&apos;s Eve picks stay pinned to 31 Dec.</p>
            )}
            <ActionRow
              icon={Trash2}
              label="Remove"
              danger
              onClick={() => {
                update((d) => removeItem(d, itemRef.index, itemRef.slot, it.key));
                closeItem();
              }}
            />
          </div>
        )}
        {itemRef && it && moving && (
          <div className="px-4 pb-8">
            <p className="px-1 pb-3 text-[14px] text-ink-2">Pick a Galle day — it goes to the end of that day&apos;s {itemRef.slot === "day" ? "daytime" : "evening"}.</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {data.days.map((d, i) => {
                if (i === itemRef.index) return null;
                const ok = moveTargets[i];
                return (
                  <li key={d.id}>
                    <MoveTarget
                      data={data}
                      day={d}
                      index={i}
                      slot={itemRef.slot}
                      t={timeline.days[i]}
                      ok={ok}
                      onClick={() => {
                        update((cur) => moveItem(cur, itemRef.slot, itemRef.index, it.key, i));
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

      {tripAsk && (
        <VariantSheet open data={data} index={tripAsk.index} current={tripAsk.current} onClose={() => setTripAsk(null)} onChoose={chooseTrip} />
      )}

      <OptionDetail
        open={!!detail}
        option={detail}
        where={itWhere ?? undefined}
        onClose={() => setDetail(null)}
      />

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
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="e.g. My birthday! · Would love to do this with Priya · Could skip if we're tired"
            className="w-full resize-none rounded-2xl border-2 border-sand-300 bg-paper p-4 text-[16px] outline-none focus:border-ocean-600"
          />
          <p className="mt-1 text-right text-xs text-ink-3">{noteText.length}/280</p>
        </div>
      </Sheet>

      <Sheet open={fillAsk} onClose={() => setFillAsk(false)} size="auto" eyebrow="Quick fill" title="Keep your picks?">
        <div className="grid gap-2.5 px-5 pb-8">
          <p className="pb-1 text-[15px] text-ink-2">
            We&apos;ll put one balanced pick in each empty slot — adventures, beaches and nights out — keeping travel light.
          </p>
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
        className="grid size-8 cursor-grab touch-none place-items-center rounded-full text-ink-3 transition hover:bg-sand-200 active:cursor-grabbing"
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
  const first = day[slot][0];
  const r = first ? resolve(first, slot, slotWhere(t.role, slot)) : null;
  const label = r ? (r.kind === "stay" ? r.stay.title : r.activity.title) : "Nothing yet";
  const why =
    t.role === "colombo"
      ? "Colombo day"
      : t.role === "departure"
        ? "Fly-home day"
        : t.role === "transfer" && slot === "day"
          ? "Stops on the way only"
          : "New Year's Eve stays put";
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
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-sand-200">
          {r?.kind === "activity" && <Photo photo={r.activity.images[0]} alt={label} sizes="44px" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[14px] font-semibold", !first && "text-ink-3")}>{ok ? label : why}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{DAY_NAMES[t.role]}</span>
      </span>
    </button>
  );
}

/** "Colombo · 1 night → Galle · 4 nights" */
export function StaysBanner({ colombo, galle, className }: { colombo: number; galle: number; className?: string }) {
  const tile = (id: "colombo" | "galle", nightsHere: number) => (
    <div className="relative flex h-[68px] min-w-0 flex-1 items-end overflow-hidden rounded-2xl bg-ocean-800 p-2.5 text-paper">
      <Photo photo={stays[id].images[0]} alt={stays[id].name} sizes="200px" />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/5" />
      <span className="relative [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
        <span className="font-display block text-[19px] font-semibold leading-none">{stays[id].name}</span>
        <span className="text-[12px] font-semibold text-paper/85">
          {nightsHere} {nightsHere === 1 ? "night" : "nights"}
        </span>
      </span>
    </div>
  );
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={`Colombo ${colombo} ${colombo === 1 ? "night" : "nights"}, then Galle ${galle} ${galle === 1 ? "night" : "nights"}`}
    >
      {tile("colombo", colombo)}
      <span className="flex shrink-0 flex-col items-center text-ocean-600">
        <Van className="h-5 w-8" />
        <ArrowRight className="size-4" strokeWidth={2.5} />
      </span>
      {tile("galle", galle)}
    </div>
  );
}

function SectionHeader({ stay, kicker }: { stay: "colombo" | "galle"; kicker: string }) {
  const s = stays[stay];
  return (
    <div className="mx-3 overflow-hidden rounded-[22px] bg-ocean-800 text-paper shadow-card">
      <div className="relative h-24">
        <Photo photo={s.images[0]} alt={s.name} sizes="(min-width: 1024px) 460px, 94vw" />
        <span className="absolute inset-0 bg-gradient-to-r from-ocean-950/90 via-ocean-950/55 to-transparent" />
        <div className="relative flex h-full flex-col justify-center px-4">
          <p className="label text-saffron-400">{kicker}</p>
          <h2 className="font-display text-[28px] font-semibold leading-none">{s.name}</h2>
          <p className="mt-1 text-[12.5px] text-paper/80">{s.tagline}</p>
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
        danger && "text-sunset-600",
      )}
    >
      <Icon className={cn("size-5", danger ? "text-sunset-500" : "text-ocean-600")} />
      {label}
    </button>
  );
}
