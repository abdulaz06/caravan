"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import { useState } from "react";
import { MAX_TRIP_DAYS, NYE_DATE, TRIP_WINDOW } from "@/content";
import { flexibility as FLEX } from "@/content/preferences";
import { cn } from "@/lib/cn";
import { addDays, dayLabel, diffDays, monthName, parseISO } from "@/lib/dates";
import { countPicks, setDates, tripLength, type Flexibility, type ItineraryData } from "@/lib/itinerary";
import { Firework } from "../brand/illustrations";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  onNext: () => void;
};

const MONTHS = [
  { y: 2026, m: 11 },
  { y: 2027, m: 0 },
];
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

export function DatesStep({ data, update, locked, onNext }: Props) {
  const toast = useToast();
  const [anchor, setAnchor] = useState<string | null>(null);
  const start = anchor ?? data.startDate;
  const end = anchor ? null : data.endDate;
  const len = tripLength(data);

  function tap(d: string) {
    if (locked) return;
    if (!anchor) {
      setAnchor(d);
      return;
    }
    let s = anchor;
    let e = d;
    if (e < s) {
      setAnchor(d);
      return;
    }
    if (diffDays(s, e) + 1 > MAX_TRIP_DAYS) {
      e = addDays(s, MAX_TRIP_DAYS - 1);
      toast(`Max ${MAX_TRIP_DAYS} days — we trimmed it for you`);
    }
    if (e > TRIP_WINDOW.end) e = TRIP_WINDOW.end;
    if (s < TRIP_WINDOW.start) s = TRIP_WINDOW.start;
    setAnchor(null);
    const before = countPicks(data);
    update((cur) => {
      const next = setDates(cur, s, e);
      return next;
    });
    if (before > 0 && (s !== data.startDate || e !== data.endDate)) {
      toast("Dates updated — we kept your picks where we could");
    }
  }

  const inRange = (d: string) => !!start && !!end && d >= start && d <= end;

  return (
    <div className="grain pb-40">
      <section className="relative z-[1] px-5 pt-7">
        <p className="label text-sunset-600">Step 1 · Dates</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          When are <span className="italic text-ocean-700">you</span> in?
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">Tap your first day, then your last. Anywhere from 1 Dec to 31 Jan.</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-saffron-200 px-3 py-1.5 text-[13px] font-semibold text-ink">
          <Star className="size-3.5 fill-current" /> Recommended: 4–5 days
        </span>
      </section>

      <section className="relative z-[1] mt-6 space-y-6 px-3">
        {MONTHS.map(({ y, m }) => {
          const cells = monthCells(y, m);
          const lastOfMonth = cells.filter(Boolean).at(-1);
          return (
            <div key={m} className="rounded-[26px] bg-paper p-3 pb-4 shadow-card">
              <h2 className="font-display px-2 pb-2 pt-1 text-[22px] font-semibold">{monthName(y, m)}</h2>
              <div className="grid grid-cols-7 text-center">
                {WEEK.map((w, i) => (
                  <div key={i} className={cn("pb-1.5 text-[11px] font-bold", i >= 5 ? "text-sunset-600/70" : "text-ink-3")}>
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const col = i % 7;
                  const isStart = d === start;
                  const isEnd = d === end;
                  const mid = inRange(d) && !isStart && !isEnd;
                  const band = inRange(d) && start !== end;
                  const nye = d === NYE_DATE;
                  return (
                    <div key={d} className="relative h-12">
                      {band && (
                        <div
                          className={cn(
                            "absolute inset-y-1 bg-saffron-200",
                            isStart ? "left-1/2 right-0" : isEnd ? "left-0 right-1/2" : "inset-x-0",
                            mid && (col === 0 || d.endsWith("-01")) && "left-1 rounded-l-full",
                            mid && (col === 6 || d === lastOfMonth) && "right-1 rounded-r-full",
                          )}
                        />
                      )}
                      <button
                        onClick={() => tap(d)}
                        disabled={locked}
                        aria-label={`${dayLabel(d)}${nye ? ", New Year's Eve" : ""}`}
                        aria-pressed={inRange(d) || isStart}
                        className={cn(
                          "relative mx-auto grid size-10 place-items-center rounded-full text-[15px] font-semibold tabular-nums transition",
                          isStart || isEnd
                            ? "bg-sunset-500 text-white shadow-[0_3px_0_0_var(--color-sunset-700)]"
                            : mid
                              ? "text-ink"
                              : "text-ink hover:bg-sand-200",
                        )}
                      >
                        {parseISO(d).getUTCDate()}
                        {nye && (
                          <Firework
                            className={cn(
                              "absolute -right-1 -top-1 size-4",
                              isStart || isEnd ? "text-saffron-200" : "text-hibiscus-500",
                            )}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              {m === 11 && (
                <p className="mt-2 flex items-center gap-1.5 px-2 text-[12px] font-medium text-ink-3">
                  <Firework className="size-3.5 text-hibiscus-500" /> 31 Dec has its own New Year&apos;s Eve picks
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
                  on ? "border-ocean-600 bg-ocean-100/60" : "border-transparent bg-paper shadow-card",
                )}
              >
                <span>
                  <span className="block text-[15px] font-semibold">{f.label}</span>
                  <span className="text-[13px] text-ink-3">{f.hint}</span>
                </span>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border-2",
                    on ? "border-ocean-600 bg-ocean-600" : "border-sand-300",
                  )}
                >
                  {on && <span className="size-2 rounded-full bg-paper" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky summary + CTA */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-3 lg:left-auto lg:w-[480px]">
        <div className="rounded-[26px] bg-ink p-3 pl-5 text-paper shadow-lift">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={anchor ? "pending" : `${data.startDate}-${data.endDate}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {anchor ? (
                    <>
                      <p className="font-display text-[19px] font-semibold">From {dayLabel(anchor)}…</p>
                      <p className="text-[13px] text-paper/60">Now tap your last day</p>
                    </>
                  ) : data.startDate && data.endDate ? (
                    <>
                      <p className="font-display text-[19px] font-semibold">
                        {len} {len === 1 ? "day" : "days"}
                        <span className="ml-2 text-[13px] font-sans font-semibold text-saffron-400">
                          {len >= 4 && len <= 5 ? "Sweet spot ✓" : len > 7 ? "Big trip!" : len < 3 ? "Short & sweet" : ""}
                        </span>
                      </p>
                      <p className="truncate text-[13px] text-paper/60">
                        {dayLabel(data.startDate)} → {dayLabel(data.endDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-[19px] font-semibold">No dates yet</p>
                      <p className="text-[13px] text-paper/60">Tap your first day above</p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <Button onClick={onNext} disabled={!data.startDate || !!anchor} size="md" className="shrink-0">
              Build days <ArrowRight className="size-[18px]" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
