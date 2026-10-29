"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical, Hand, Info, Minus, Moon, Plus, Vote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampStart, setStart, type Flexibility, type ItineraryData } from "@/engine/itinerary";
import {
  allowedLengths,
  daysNightsLabel,
  lengthBounds,
  lengthRangeLabel,
  isFixed,
  planDays,
  previewAvailable,
  previewDays,
  structureNote,
  tripDays,
  type Engine,
} from "@/engine/structure";
import { cn } from "@/lib/cn";
import { addDays, dayLabel, diffDays, monthName, parseISO } from "@/lib/dates";
import { Firework } from "../brand/illustrations";
import { useEngine } from "../engine";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  /** Free dates: a new start and end (the trip re-flows its days, keeping every pick that still fits). */
  onRange: (start: string, end: string) => void;
  locked: boolean;
  onNext: () => void;
  /** The trip's length now (fixed length: the full trip, or the shorter one while previewing). */
  length: number;
  onLength: (len: number) => void;
};

/** Every month the trip window touches. */
function monthsOf(start: string, end: string) {
  const out: { y: number; m: number }[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7)) - 1;
  const last = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
  while (y * 12 + m <= last) {
    out.push({ y, m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function monthCells(y: number, m: number): (string | null)[] {
  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

const buzz = () => {
  try {
    navigator.vibrate?.(6);
  } catch {
    /* not supported */
  }
};

const specialOn = (e: Engine, d: string) => e.catalog.specialDates.find((s) => s.date === d.slice(5)) ?? null;

/** "🎆 NYE on Day 5 · Galle", "You'd fly home on New Year's Eve", or "No New Year's Eve in this window". */
function specialLineFor(e: Engine, start: string | null, length: number): string | null {
  if (!e.catalog.specialDates.length) return null;
  const plans = planDays(e, length);
  const hit = start ? plans.map((p, i) => ({ p, i, s: specialOn(e, addDays(start, i)) })).find((x) => x.s) : undefined;
  if (!hit?.s) return `No ${e.catalog.specialDates[0].name} in these dates`;
  const { p, i, s } = hit;
  if (p.kind === "departure") return `You'd fly home on ${s.name}`;
  return `🎆 ${s.short} on Day ${i + 1} · ${p.kind === "transfer" ? "road-trip day" : p.base.name}`;
}

/** Follow a finger across the calendar while dragging, auto-scrolling near the edges (the page can't scroll under it). */
function useDragFollow(active: () => { id: number } | null, follow: React.RefObject<(x: number, y: number) => void>, end: (id: number) => void) {
  useEffect(() => {
    let frame = 0;
    let point: { x: number; y: number } | null = null;
    const tick = () => {
      frame = 0;
      if (!active() || !point) return;
      const h = window.innerHeight;
      const dy = point.y > h - 200 ? 12 : point.y < 170 ? -12 : 0;
      if (dy) {
        window.scrollBy(0, dy);
        follow.current(point.x, point.y);
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (active()?.id !== e.pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      follow.current(point.x, point.y);
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const up = (e: PointerEvent) => {
      if (active()?.id !== e.pointerId) return;
      point = null;
      end(e.pointerId);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [active, follow, end]);
}

const dateAtPoint = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-date]")?.dataset.date ?? null;

export function DatesStep(props: Props) {
  const e = useEngine();
  return isFixed(e) ? <FixedDates {...props} /> : <FreeDates {...props} />;
}

// ── Free dates: pick any start and end ────────────────────────────────

type Range = { start: string; end: string };
type Drag = { id: number; mode: "start" | "end" | "move"; anchor: Range; offset: number; moved: boolean };

function FreeDates({ data, update, onRange, locked, onNext }: Props) {
  const e = useEngine();
  const toast = useToast();
  const win = e.rules.window;
  const { min, max } = lengthBounds(e);
  const rec = e.rules.recommended;
  const months = monthsOf(win.start, win.end);
  // A first tap waits here for the second (the day you fly home); the plan changes only once both are in.
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // While dragging, the range moves here and is saved on release — so a drag through a too-short trip never clears picks.
  const [draft, setDraft] = useState<Range | null>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(0);

  const saved: Range | null = useMemo(
    () => (data.startDate && data.endDate ? { start: data.startDate, end: data.endDate } : null),
    [data.startDate, data.endDate],
  );
  const shown = draft ?? saved;
  const len = shown ? diffDays(shown.start, shown.end) + 1 : 0;

  /** Keep a range inside the window and the allowed lengths, holding `anchor`'s side still. */
  const fit = useCallback(
    (s: string, en: string, hold: "start" | "end" = "start"): Range => {
      if (en < s) [s, en] = [en, s];
      if (s < win.start) s = win.start;
      if (en > win.end) en = win.end;
      const n = diffDays(s, en) + 1;
      if (n > max) {
        if (hold === "start") en = addDays(s, max - 1);
        else s = addDays(en, -(max - 1));
      }
      if (n < min) {
        if (hold === "start") en = addDays(s, min - 1);
        else s = addDays(en, -(min - 1));
        if (en > win.end) [s, en] = [addDays(win.end, -(min - 1)), win.end];
        if (s < win.start) [s, en] = [win.start, addDays(win.start, min - 1)];
      }
      return { start: s, end: en };
    },
    [win.start, win.end, min, max],
  );

  const commit = useCallback(
    (r: Range) => {
      if (locked || (saved && r.start === saved.start && r.end === saved.end)) return;
      buzz();
      onRange(r.start, r.end);
    },
    [locked, onRange, saved],
  );

  function tap(d: string) {
    if (locked || d < win.start || d > win.end) return;
    if (!pending || d < pending) {
      setPending(d);
      setHover(null);
      return;
    }
    const n = diffDays(pending, d) + 1;
    if (n > max) toast(`Trips here are ${lengthRangeLabel({ min, max })} — that's the longest`);
    setPending(null);
    setHover(null);
    commit(fit(pending, d));
  }

  const follow = useRef<(x: number, y: number) => void>(() => {});
  useEffect(() => {
    follow.current = (x, y) => {
      const g = drag.current;
      const d = dateAtPoint(x, y);
      if (!g || !d) return;
      let next: Range;
      if (g.mode === "move") {
        const n = diffDays(g.anchor.start, g.anchor.end);
        let s = addDays(d, -g.offset);
        if (s < win.start) s = win.start;
        if (addDays(s, n) > win.end) s = addDays(win.end, -n);
        next = { start: s, end: addDays(s, n) };
      } else {
        // The dragged end follows the finger; the other end stays put (crossing over swaps them).
        const still = g.mode === "start" ? g.anchor.end : g.anchor.start;
        next = d <= still ? fit(d, still, "end") : fit(still, d, "start");
      }
      setDraft((cur) => {
        if (cur && cur.start === next.start && cur.end === next.end) return cur;
        g.moved = true;
        buzz();
        return next;
      });
    };
  });
  const active = useCallback(() => drag.current, []);
  const endDrag = useCallback(() => {
    const g = drag.current;
    drag.current = null;
    if (g?.moved) justDragged.current = Date.now();
    setDraft((cur) => {
      if (cur) queueMicrotask(() => commit(cur));
      return null;
    });
  }, [commit]);
  useDragFollow(active, follow, endDrag);

  function nudge(by: number) {
    if (!saved) return;
    const n = diffDays(saved.start, saved.end);
    const s = addDays(saved.start, by);
    if (s < win.start || addDays(s, n) > win.end) return;
    commit({ start: s, end: addDays(s, n) });
  }
  function resize(by: number) {
    if (!saved) return;
    const next = len + by;
    if (next < min || next > max) return;
    const end = addDays(saved.start, next - 1);
    // No room at the end of the window: grow at the start instead.
    commit(end > win.end ? { start: addDays(saved.start, -by), end: saved.end } : { start: saved.start, end });
  }

  const preview: Range | null = pending && hover && hover >= pending ? fit(pending, hover) : null;
  const inRange = (d: string, r: Range | null) => !!r && d >= r.start && d <= r.end;
  const note = shown ? structureNote(e, len) : null;
  const recommendedHere = !!rec && len >= rec.min && len <= rec.max;
  const specialLine = shown ? specialLineFor(e, shown.start, len) : null;

  return (
    <div className="grain pb-44">
      <section className="relative z-[1] px-5 pt-7">
        <p className="label text-accent-600">Step 1 · Dates</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          When are <span className="italic text-primary-700">you</span> in?
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          Tap the day you&apos;d land, then the day you&apos;d fly home — or drag either end. Anywhere from {dayLabel(win.start).split(" ").slice(1).join(" ")} to{" "}
          {dayLabel(win.end).split(" ").slice(1).join(" ")}, {lengthRangeLabel({ min, max })}.
        </p>
      </section>

      {/* Trip length */}
      <section className="relative z-[1] mt-5 px-3" aria-label="Trip length">
        <div className="flex items-center gap-3 rounded-2xl bg-paper p-3 shadow-card">
          <button
            onClick={() => resize(-1)}
            disabled={locked || !saved || len <= min}
            aria-label="One day shorter"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-200 text-ink transition hover:bg-surface-300 active:scale-95 disabled:opacity-35"
          >
            <Minus className="size-4" strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-display text-[20px] font-semibold leading-tight" data-testid="trip-length">
              {shown ? daysNightsLabel(len) : "Your trip length"}
            </p>
            <p className={cn("text-[12.5px] font-semibold", recommendedHere ? "text-secondary-700" : "text-ink-3")}>
              {rec ? (recommendedHere ? `✓ Most groups do ${lengthRangeLabel(rec)}` : `Most groups do ${lengthRangeLabel(rec)}`) : `Anything from ${lengthRangeLabel({ min, max })}`}
            </p>
          </div>
          <button
            onClick={() => resize(1)}
            disabled={locked || !saved || len >= max}
            aria-label="One day longer"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-200 text-ink transition hover:bg-surface-300 active:scale-95 disabled:opacity-35"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        {note && (
          <p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-highlight-100 px-3 py-2 text-[12.5px] leading-snug text-ink-2 ring-1 ring-highlight-200">
            <Info className="mt-px size-3.5 shrink-0 text-highlight-600" /> {note}.
          </p>
        )}
      </section>

      <section className="relative z-[1] mt-5 space-y-5 px-3">
        {months.map(({ y, m }, mi) => {
          const cells = monthCells(y, m);
          const lastOfMonth = cells.filter(Boolean).at(-1);
          return (
            <div key={`${y}-${m}`} className="rounded-[26px] bg-paper p-3 pb-4 shadow-card">
              <h2 className="font-display px-2 pb-2 pt-1 text-[22px] font-semibold">{monthName(y, m)}</h2>
              <div className="grid grid-cols-7 text-center" onPointerLeave={() => setHover(null)}>
                {WEEK.map((w, i) => (
                  <div key={i} className={cn("pb-1.5 text-[11px] font-bold", i >= 5 ? "text-accent-600/70" : "text-ink-3")}>
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const col = i % 7;
                  const range = preview ?? (pending ? null : shown);
                  const on = inRange(d, range);
                  const faded = !!pending && !preview && inRange(d, saved);
                  const first = !!range && d === range.start;
                  const last = !!range && d === range.end;
                  const isPending = d === pending;
                  const special = specialOn(e, d);
                  const idx = on && range ? diffDays(range.start, d) : -1;
                  const out = d < win.start || d > win.end;
                  const tooLong = !!pending && diffDays(pending, d) + 1 > max;
                  return (
                    <div key={d} className="relative h-[52px]" data-date={d}>
                      {(on || faded) && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-1",
                            on ? (preview ? "bg-accent-300" : "bg-accent-500") : "bg-accent-100",
                            first ? "left-1 rounded-l-2xl" : "left-0",
                            last ? "right-1 rounded-r-2xl" : "right-0",
                            !first && (col === 0 || d.endsWith("-01")) && "left-1 rounded-l-xl",
                            !last && (col === 6 || d === lastOfMonth) && "right-1 rounded-r-xl",
                            faded && !on && d === saved?.start && "left-1 rounded-l-2xl",
                            faded && !on && d === saved?.end && "right-1 rounded-r-2xl",
                          )}
                        />
                      )}
                      {isPending && <div aria-hidden="true" className="absolute inset-1 rounded-2xl bg-accent-500 ring-4 ring-accent-300/60" />}
                      <button
                        onPointerDown={(ev) => {
                          if (locked || pending || !saved || !inRange(d, saved)) return;
                          const mode = d === saved.end ? "end" : d === saved.start ? "start" : "move";
                          drag.current = { id: ev.pointerId, mode, anchor: saved, offset: diffDays(saved.start, d), moved: false };
                          (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
                        }}
                        onPointerEnter={() => pending && setHover(d)}
                        onClick={() => {
                          // A drag ends in a click — ignore it.
                          if (Date.now() - justDragged.current < 400) return;
                          tap(d);
                        }}
                        onKeyDown={(ev) => {
                          if (!saved || !inRange(d, saved)) return;
                          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
                          if (!step) return;
                          ev.preventDefault();
                          if (ev.shiftKey) resize(step > 0 ? 1 : -1);
                          else nudge(step);
                        }}
                        disabled={locked || out}
                        aria-label={`${dayLabel(d)}${special ? `, ${special.name}` : ""}${on && !preview ? `, day ${idx + 1} of your trip` : ""}${isPending ? ", your first day" : ""}`}
                        aria-pressed={on || isPending}
                        className={cn(
                          "relative mx-auto flex h-full w-full flex-col items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums transition",
                          on || isPending ? "text-white" : out ? "text-ink-3/35" : tooLong ? "text-ink-3/60 hover:bg-surface-200" : "text-ink hover:bg-surface-200",
                          on && !preview && !pending && "cursor-grab touch-none active:cursor-grabbing",
                        )}
                      >
                        <span className={cn(special && (on || isPending) && "rounded-full px-1.5 ring-2 ring-highlight-200")}>{parseISO(d).getUTCDate()}</span>
                        {((on && (first || last)) || isPending) && (
                          <span className="text-[9px] font-bold uppercase leading-none tracking-wide text-white/85">
                            {isPending ? e.catalog.preset.structure.arrival.label : first && last ? "Day trip" : first ? e.catalog.preset.structure.arrival.label : "Fly"}
                          </span>
                        )}
                        {special && <Firework className={cn("absolute right-0.5 top-0.5 size-4", on || isPending ? "text-highlight-200" : "text-pop-500")} />}
                      </button>
                      {on && !last && !preview && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -right-2 top-1/2 z-[1] grid size-4 -translate-y-1/2 place-items-center rounded-full bg-accent-700 ring-2 ring-accent-500"
                        >
                          <Moon className="size-2.5 fill-highlight-200 text-highlight-200" strokeWidth={0} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {mi === 0 && <CalendarLegend />}
            </div>
          );
        })}
      </section>

      <FlexibilityPicker data={data} update={update} locked={locked} />

      {/* Sticky summary + CTA */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-3 lg:left-auto lg:w-[480px]">
        <div className="rounded-[26px] bg-ink p-3 pl-4 text-paper shadow-lift">
          <div className="flex items-center gap-2">
            {saved && !pending && (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => nudge(-1)}
                  disabled={locked || saved.start <= win.start}
                  aria-label="Move a day earlier"
                  className="grid size-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => nudge(1)}
                  disabled={locked || saved.end >= win.end}
                  aria-label="Move a day later"
                  className="grid size-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pending ?? shown?.start ?? "none"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {pending ? (
                    <>
                      <p className="font-display truncate text-[17px] font-semibold leading-tight">Landing {dayLabel(pending)}</p>
                      <p className="flex items-center gap-1 text-[13px] text-paper/70">
                        <Hand className="size-3.5" /> Now tap the day you fly home
                      </p>
                    </>
                  ) : shown ? (
                    <>
                      <p className="font-display whitespace-nowrap text-[17px] font-semibold leading-tight">{daysNightsLabel(len)}</p>
                      <p className="truncate text-[12px] text-paper/70">
                        {dayLabel(shown.start)} → {dayLabel(shown.end)}
                      </p>
                      {specialLine && <p className="truncate text-[11.5px] font-semibold text-highlight-400">{specialLine}</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-display whitespace-nowrap text-[17px] font-semibold">Pick your dates</p>
                      <p className="flex items-center gap-1 text-[13px] text-paper/70">
                        <Hand className="size-3.5" /> Tap the day you&apos;d land
                      </p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {pending ? (
              <button
                onClick={() => {
                  setPending(null);
                  setHover(null);
                }}
                className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[14px] font-semibold hover:bg-white/20"
              >
                <X className="size-4" /> Cancel
              </button>
            ) : (
              <Button onClick={onNext} disabled={!saved} size="md" className="shrink-0">
                Build days <ArrowRight className="size-[18px]" strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fixed trip length: one draggable window ───────────────────────────

function FixedDates({ data, update, locked, onNext, length, onLength }: Props) {
  const e = useEngine();
  const start = data.startDate;
  const end = start ? addDays(start, length - 1) : null;
  const drag = useRef<{ offset: number; id: number; moved: boolean } | null>(null);
  const justDragged = useRef(0);
  const full = tripDays(e);
  const short = previewDays(e);
  const preview = length === short && short !== full;
  const win = e.rules.window;
  const months = monthsOf(win.start, win.end);
  const shortAllowed = allowedLengths(e).includes(short);

  const place = useCallback(
    (s: string) => {
      if (locked) return;
      const next = clampStart(e, s, length);
      if (next === data.startDate) return;
      buzz();
      update((cur) => setStart(e, cur, next, length));
    },
    [e, data.startDate, length, locked, update],
  );

  // Dragging the window: follow the finger across the months.
  const follow = useRef<(x: number, y: number) => void>(() => {});
  useEffect(() => {
    follow.current = (x, y) => {
      const d = dateAtPoint(x, y);
      if (!drag.current || !d) return;
      const next = clampStart(e, addDays(d, -drag.current.offset), length);
      if (next !== data.startDate) {
        drag.current.moved = true;
        place(next);
      }
    };
  });
  const active = useCallback(() => drag.current, []);
  const endDrag = useCallback(() => {
    if (drag.current?.moved) justDragged.current = Date.now();
    drag.current = null;
  }, []);
  useDragFollow(active, follow, endDrag);

  const inWindow = (d: string) => !!start && !!end && d >= start && d <= end;
  const plans = planDays(e, length);
  const specialLine = specialLineFor(e, start, length);

  return (
    <div className="grain pb-44">
      <section className="relative z-[1] px-5 pt-7">
        <p className="label text-accent-600">Step 1 · Dates</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          When are <span className="italic text-primary-700">you</span> in?
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          Tap the day you&apos;d land, or drag the window around. Anywhere from {dayLabel(win.start).split(" ").slice(1).join(" ")} to{" "}
          {dayLabel(win.end).split(" ").slice(1).join(" ")}.
        </p>
      </section>

      {/* Trip length preset */}
      <section className="relative z-[1] mt-5 px-3" aria-label="Trip length">
        <p className="label px-2 text-ink-3">Trip length</p>
        <div className={cn("mt-2 grid gap-2", previewAvailable(e) ? "grid-cols-[1fr_auto]" : "grid-cols-1")}>
          <button
            onClick={() => onLength(full)}
            aria-pressed={!preview}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[0.99]",
              !preview ? "border-primary-600 bg-primary-100/70" : "border-transparent bg-paper shadow-card",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-paper">
              <Vote className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="font-display block text-[19px] font-semibold leading-tight">{daysNightsLabel(full)}</span>
              <span className="text-[12.5px] font-semibold text-primary-700">The trip ✓</span>
            </span>
          </button>
          {previewAvailable(e) && (
            <button
              onClick={() => onLength(preview ? full : short)}
              aria-pressed={preview}
              className={cn(
                "flex w-[118px] flex-col justify-center rounded-2xl border-2 border-dashed px-3 py-2 text-left transition active:scale-[0.99]",
                preview ? "border-highlight-500 bg-highlight-100" : "border-surface-300 bg-paper/60",
              )}
            >
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
                <FlaskConical className="size-3" /> {shortAllowed ? "Shorter" : "Preview"}
              </span>
              <span className="text-[13.5px] font-semibold leading-tight">{daysNightsLabel(short)}</span>
            </button>
          )}
        </div>
        {preview && (
          <p className="mt-2 rounded-xl bg-highlight-100 px-3 py-2 text-[12.5px] leading-snug text-ink-2 ring-1 ring-highlight-200">
            {shortAllowed
              ? `Try the shorter trip — submit it from Review if you prefer it. Your ${full}-day plan stays until you do.`
              : `Just a sandbox: try a shorter trip without touching your real ${full}-day plan. Nothing here is saved.`}
          </p>
        )}
      </section>

      <section className="relative z-[1] mt-5 space-y-5 px-3">
        {months.map(({ y, m }, mi) => {
          const cells = monthCells(y, m);
          const lastOfMonth = cells.filter(Boolean).at(-1);
          return (
            <div key={`${y}-${m}`} className="rounded-[26px] bg-paper p-3 pb-4 shadow-card">
              <h2 className="font-display px-2 pb-2 pt-1 text-[22px] font-semibold">{monthName(y, m)}</h2>
              <div className="grid grid-cols-7 text-center">
                {WEEK.map((w, i) => (
                  <div key={i} className={cn("pb-1.5 text-[11px] font-bold", i >= 5 ? "text-accent-600/70" : "text-ink-3")}>
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const col = i % 7;
                  const on = inWindow(d);
                  const first = d === start;
                  const last = d === end;
                  const special = specialOn(e, d);
                  const idx = on ? plans.findIndex((_, i) => addDays(start!, i) === d) : -1;
                  const out = d < win.start || d > win.end;
                  return (
                    <div key={d} className="relative h-[52px]" data-date={d}>
                      {on && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-1 bg-accent-500",
                            first ? "left-1 rounded-l-2xl" : "left-0",
                            last ? "right-1 rounded-r-2xl" : "right-0",
                            !first && (col === 0 || d.endsWith("-01")) && "left-1 rounded-l-xl",
                            !last && (col === 6 || d === lastOfMonth) && "right-1 rounded-r-xl",
                          )}
                        />
                      )}
                      <button
                        onPointerDown={(ev) => {
                          if (!on || locked) return;
                          drag.current = { offset: idx, id: ev.pointerId, moved: false };
                          (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
                        }}
                        onClick={() => {
                          // A drag ends in a click — ignore it; a plain tap starts the window here.
                          if (Date.now() - justDragged.current < 400) return;
                          place(d);
                        }}
                        onKeyDown={(ev) => {
                          if (!on || !start) return;
                          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
                          if (step) {
                            ev.preventDefault();
                            place(addDays(start, step));
                          }
                        }}
                        disabled={locked || out}
                        aria-label={`${dayLabel(d)}${special ? `, ${special.name}` : ""}${on ? `, day ${idx + 1} of your trip` : ""}`}
                        aria-pressed={on}
                        className={cn(
                          "relative mx-auto flex h-full w-full flex-col items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums transition",
                          on ? "cursor-grab touch-none text-white active:cursor-grabbing" : "text-ink hover:bg-surface-200",
                        )}
                      >
                        <span className={cn(special && on && "rounded-full px-1.5 ring-2 ring-highlight-200")}>{parseISO(d).getUTCDate()}</span>
                        {on && (first || last) && (
                          <span className="text-[9px] font-bold uppercase leading-none tracking-wide text-white/80">
                            {first ? e.catalog.preset.structure.arrival.label : "Fly"}
                          </span>
                        )}
                        {special && <Firework className={cn("absolute right-0.5 top-0.5 size-4", on ? "text-highlight-200" : "text-pop-500")} />}
                      </button>
                      {/* night marker between this day and the next */}
                      {on && !last && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -right-2 top-1/2 z-[1] grid size-4 -translate-y-1/2 place-items-center rounded-full bg-accent-700 ring-2 ring-accent-500"
                        >
                          <Moon className="size-2.5 fill-highlight-200 text-highlight-200" strokeWidth={0} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {mi === 0 && <CalendarLegend />}
            </div>
          );
        })}
      </section>

      <FlexibilityPicker data={data} update={update} locked={locked} />

      {/* Sticky summary + CTA */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-3 lg:left-auto lg:w-[480px]">
        <div className="rounded-[26px] bg-ink p-3 pl-4 text-paper shadow-lift">
          <div className="flex items-center gap-2">
            {start && (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => place(addDays(start, -1))}
                  disabled={locked || start <= win.start}
                  aria-label="Move a day earlier"
                  className="grid size-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => place(addDays(start, 1))}
                  disabled={locked || end! >= win.end}
                  aria-label="Move a day later"
                  className="grid size-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={start ?? "none"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {start && end ? (
                    <>
                      <p className="font-display whitespace-nowrap text-[17px] font-semibold leading-tight">
                        {daysNightsLabel(length)}
                        {preview && <span className="ml-1.5 text-[12px] font-sans font-bold text-highlight-400">{shortAllowed ? "shorter" : "preview"}</span>}
                      </p>
                      <p className="truncate text-[12px] text-paper/70">
                        {dayLabel(start)} → {dayLabel(end)}
                      </p>
                      {specialLine && <p className="truncate text-[11.5px] font-semibold text-highlight-400">{specialLine}</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-display whitespace-nowrap text-[17px] font-semibold">{daysNightsLabel(length)}</p>
                      <p className="flex items-center gap-1 text-[13px] text-paper/70">
                        <Hand className="size-3.5" /> Tap the day you&apos;d land
                      </p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <Button onClick={onNext} disabled={!start} size="md" className="shrink-0">
              Build days <ArrowRight className="size-[18px]" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────

function CalendarLegend() {
  const e = useEngine();
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[12px] font-medium text-ink-3">
      {e.catalog.specialDates.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          <Firework className="size-3.5 text-pop-500" /> {s.calendarNote}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Moon className="size-3 fill-accent-600 text-accent-600" strokeWidth={0} /> a night away
      </span>
    </p>
  );
}

function FlexibilityPicker({ data, update, locked }: Pick<Props, "data" | "update" | "locked">) {
  const FLEX = useEngine().catalog.preset.preferences.flexibility;
  return (
    <section className="relative z-[1] mt-8 px-5">
      <h2 className="font-display text-[22px] font-semibold">How set are these dates?</h2>
      <div className="mt-3 grid gap-2">
        {FLEX.map((f) => {
          const on = data.flexibility === f.id;
          return (
            <button
              key={f.id}
              disabled={locked}
              onClick={() => update((d) => ({ ...d, flexibility: f.id as Flexibility }))}
              aria-pressed={on}
              className={cn(
                "flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition",
                on ? "border-primary-600 bg-primary-100/60" : "border-transparent bg-paper shadow-card",
              )}
            >
              <span>
                <span className="block text-[15px] font-semibold">{f.label}</span>
                <span className="text-[13px] text-ink-3">{f.hint}</span>
              </span>
              <span className={cn("grid size-6 place-items-center rounded-full border-2", on ? "border-primary-600 bg-primary-600" : "border-surface-300")}>
                {on && <span className="size-2 rounded-full bg-paper" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
