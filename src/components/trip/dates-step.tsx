"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical, Hand, Moon, Vote } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { clampStart, setStart, type Flexibility, type ItineraryData } from "@/engine/itinerary";
import { allowedLengths, daysNightsLabel, planDays, previewAvailable, previewDays, tripDays } from "@/engine/structure";
import { cn } from "@/lib/cn";
import { addDays, dayLabel, monthName, parseISO } from "@/lib/dates";
import { Firework } from "../brand/illustrations";
import { useEngine } from "../engine";
import { Button } from "../ui/button";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  onNext: () => void;
  /** The full trip normally (6 days), the shorter one while previewing. */
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

export function DatesStep({ data, update, locked, onNext, length, onLength }: Props) {
  const e = useEngine();
  const { preset } = e.catalog;
  const FLEX = preset.preferences.flexibility;
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
  const specialOn = (d: string) => e.catalog.specialDates.find((s) => s.date === d.slice(5)) ?? null;

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

  // Dragging the window: follow the finger across both months, auto-scrolling
  // near the top/bottom edge (the page can't scroll under a dragging finger).
  const follow = useRef<(x: number, y: number) => void>(() => {});
  useEffect(() => {
    follow.current = (x, y) => {
      if (!drag.current) return;
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-date]");
      if (!el?.dataset.date) return;
      const next = clampStart(e, addDays(el.dataset.date, -drag.current.offset), length);
      if (next !== data.startDate) {
        drag.current.moved = true;
        place(next);
      }
    };
  });
  useEffect(() => {
    let frame = 0;
    let point: { x: number; y: number } | null = null;
    const tick = () => {
      frame = 0;
      if (!drag.current || !point) return;
      const h = window.innerHeight;
      const dy = point.y > h - 200 ? 12 : point.y < 170 ? -12 : 0;
      if (dy) {
        window.scrollBy(0, dy);
        follow.current(point.x, point.y);
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.id) return;
      point = { x: e.clientX, y: e.clientY };
      follow.current(point.x, point.y);
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.id !== e.pointerId) return;
      if (drag.current.moved) justDragged.current = Date.now();
      drag.current = null;
      point = null;
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
  }, []);

  const inWindow = (d: string) => !!start && !!end && d >= start && d <= end;
  // The first special date (e.g. New Year's Eve) inside the window, and the day it lands on.
  const plans = planDays(e, length);
  const specialHit = start
    ? plans.map((p, i) => ({ p, i, s: specialOn(addDays(start, i)) })).find((x) => x.s)
    : undefined;
  const specialLine = (() => {
    if (!e.catalog.specialDates.length) return null;
    if (!specialHit?.s) return `No ${e.catalog.specialDates[0].name} in this window`;
    const { p, i, s } = specialHit;
    if (p.kind === "departure") return `You'd fly home on ${s.name}`;
    return `🎆 ${s.short} on Day ${i + 1} · ${p.kind === "transfer" ? "road-trip day" : p.base.name}`;
  })();

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
        {months.map(({ y, m }) => {
          const cells = monthCells(y, m);
          const lastOfMonth = cells.filter(Boolean).at(-1);
          return (
            <div key={m} className="rounded-[26px] bg-paper p-3 pb-4 shadow-card">
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
                  const special = specialOn(d);
                  const nye = !!special;
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
                        onPointerDown={(e) => {
                          if (!on || locked) return;
                          drag.current = { offset: idx, id: e.pointerId, moved: false };
                          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                        }}
                        onClick={() => {
                          // A drag ends in a click — ignore it; a plain tap starts the window here.
                          if (Date.now() - justDragged.current < 400) return;
                          place(d);
                        }}
                        onKeyDown={(e) => {
                          if (!on || !start) return;
                          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                          if (step) {
                            e.preventDefault();
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
                        <span className={cn(nye && on && "rounded-full px-1.5 ring-2 ring-highlight-200")}>{parseISO(d).getUTCDate()}</span>
                        {on && (first || last) && (
                          <span className="text-[9px] font-bold uppercase leading-none tracking-wide text-white/80">
                            {first ? preset.structure.arrival.label : "Fly"}
                          </span>
                        )}
                        {nye && (
                          <Firework className={cn("absolute right-0.5 top-0.5 size-4", on ? "text-highlight-200" : "text-pop-500")} />
                        )}
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
              {months.indexOf(months.find((x) => x.m === m && x.y === y)!) === 0 && (
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
              )}
            </div>
          );
        })}
      </section>

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
