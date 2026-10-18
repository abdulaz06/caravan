"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Moon, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NYE_DATE, optionsById, regions } from "@/content";
import { flexibility as FLEX } from "@/content/preferences";
import { cn } from "@/lib/cn";
import { dayLabel, monthName, parseISO, rangeLabel } from "@/lib/dates";
import { balanceLabel } from "@/lib/timeline";
import type { GroupStats } from "@/lib/server/group";
import { Avatar } from "../avatar";
import { Firework, Palm } from "../brand/illustrations";
import { SiteFooter } from "../brand/site-footer";
import { Lockup } from "../brand/wordmark";
import { ButtonLink } from "../ui/button";
import { Photo } from "../ui/photo";
import { BalanceMeter } from "../trip/balance-meter";
import { RouteMap } from "../trip/route-map";

type ItinCard = {
  id: string;
  name: string;
  isMe: boolean;
  startDate: string | null;
  endDate: string | null;
  days: number;
  picks: number;
  balance: number | null;
};

type Props = {
  stats: GroupStats;
  myStatus: "new" | "draft" | "submitted";
  canBrowse: boolean;
  itineraries: ItinCard[];
  editsLocked: boolean;
};

const rise = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-30px" } };

export function GroupView({ stats, myStatus, canBrowse, itineraries, editsLocked }: Props) {
  const pct = stats.joined ? stats.submitted / stats.joined : 0;
  return (
    <div className="grain min-h-dvh">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink/[0.06] bg-sand-100/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link href="/trip" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink-2 hover:bg-sand-200">
          <ArrowLeft className="size-4" /> My trip
        </Link>
        <Lockup size="sm" className="ml-auto" />
      </header>

      {editsLocked && (
        <div className="flex items-center gap-2.5 bg-ocean-800 px-4 py-3 text-[14px] font-medium text-paper">
          <Lock className="size-4 shrink-0 text-saffron-400" /> Edits are closed — the final plan is coming!
        </div>
      )}

      <div className="relative z-[1] px-5 pt-7">
        <p className="label text-sunset-600">Group overview</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          The <span className="italic text-ocean-700">crew</span>
        </h1>
      </div>
      <div className="relative z-[1] mt-5 space-y-4 px-3">
        {/* Responses */}
        <section className="relative overflow-hidden rounded-[30px] bg-ocean-800 p-5 text-paper shadow-lift">
          <div className="sunburst absolute inset-0" />
          <Palm className="absolute -right-4 bottom-0 h-36 text-ocean-950/40" />
          <div className="relative">
            <p className="label text-saffron-400">Responses</p>
            <p className="font-display mt-2 text-[56px] font-semibold leading-none tracking-[-0.03em]">
              {stats.submitted}
              <span className="text-paper/40">/{stats.joined}</span>
            </p>
            <p className="mt-1 text-[15px] text-paper/80">
              {stats.joined === 1 ? "person has" : "friends have"} submitted their dream trip
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-saffron-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.2 }}
              />
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {stats.people.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12.5px] font-semibold",
                    p.status === "submitted" ? "bg-paper text-ink" : "bg-white/10 text-paper/75",
                  )}
                >
                  <Avatar name={p.name} className="size-6 text-[11px] ring-0" />
                  {p.name}
                  {p.status === "submitted" && <span className="text-jungle-600">✓</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Heatmap stats={stats} />

        {stats.balance !== null && (
          <motion.section {...rise} className="rounded-[26px] bg-paper p-4 shadow-card">
            <p className="label text-ink-3">The group&apos;s vibe</p>
            <p className="font-display text-[26px] font-semibold leading-tight">{balanceLabel(stats.balance).title}</p>
            <BalanceMeter
              balance={{ score: stats.balance, count: 1, nature: 0, balanced: 0, nightlife: 0 }}
              size="compact"
              className="mt-3"
            />
            <p className="mt-2 text-[12.5px] text-ink-3">Average of everyone&apos;s nature ↔ nightlife balance.</p>
          </motion.section>
        )}

        {stats.topOptions.length > 0 && (
          <motion.section {...rise} className="rounded-[26px] bg-paper p-4 shadow-card">
            <h2 className="font-display text-[24px] font-semibold">Most picked</h2>
            <ol className="mt-3 space-y-2.5">
              {stats.topOptions.slice(0, 8).map((t, i) => {
                const o = optionsById[t.optionId];
                const max = stats.topOptions[0].count;
                return (
                  <li key={t.optionId} className="flex items-center gap-3">
                    <span className="font-display w-5 text-right text-[15px] font-semibold text-ink-3">{i + 1}</span>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-ocean-800">
                      <Photo photo={o.images[0]} alt={o.title} sizes="48px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight">
                        {t.slot === "day" ? <Sun className="size-3.5 shrink-0 text-saffron-600" /> : <Moon className="size-3.5 shrink-0 text-dusk-700" />}
                        <span className="truncate">{o.title}</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-200">
                          <motion.span
                            className={cn("block h-full rounded-full", t.slot === "day" ? "bg-saffron-500" : "bg-hibiscus-500")}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(t.count / max) * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                          />
                        </span>
                        <span className="text-[12px] font-bold tabular-nums text-ink-2">{t.count}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            {stats.chillCount > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-3">
                Plus {stats.chillCount} chill {stats.chillCount === 1 ? "night" : "nights"} in 🛋️
              </p>
            )}
          </motion.section>
        )}

        {stats.regions.length > 0 && (
          <motion.section {...rise} className="rounded-[26px] bg-paper p-4 shadow-card">
            <h2 className="font-display text-[24px] font-semibold">Where people want to go</h2>
            <div className="mt-2 grid grid-cols-[1fr_1fr] items-center gap-3">
              <RouteMap stops={[]} weights={stats.regions} tone="light" />
              <ul className="space-y-1.5">
                {stats.regions.slice(0, 8).map((r) => (
                  <li key={r.region} className="flex items-center justify-between text-[13.5px]">
                    <span className="font-semibold">{regions[r.region].short}</span>
                    <span className="tabular-nums text-ink-3">{r.count} picks</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}

        {/* Browse */}
        <motion.section {...rise} className="rounded-[26px] bg-sand-50 p-4 shadow-card ring-1 ring-ink/[0.03]">
          <h2 className="font-display text-[24px] font-semibold">Everyone&apos;s trips</h2>
          {canBrowse ? (
            itineraries.length ? (
              <ul className="mt-3 grid gap-2">
                {itineraries.map((it) => (
                  <li key={it.id}>
                    <Link
                      href={`/group/${it.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-paper p-3 shadow-card transition hover:-translate-y-0.5"
                    >
                      <Avatar name={it.name} className="size-11 text-lg ring-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15.5px] font-semibold">
                          {it.name} {it.isMe && <span className="text-ink-3">(you)</span>}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-3">
                          {it.startDate && it.endDate ? `${rangeLabel(it.startDate, it.endDate)} · ${it.days} days` : "No dates"} ·{" "}
                          {balanceLabel(it.balance).title}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ink-2">Nobody else has submitted yet.</p>
            )
          ) : (
            <div className="mt-3 rounded-2xl bg-ocean-800 p-5 text-paper">
              <Lock className="size-6 text-saffron-400" />
              <p className="font-display mt-2 text-[20px] font-semibold leading-tight">Submit yours to unlock everyone&apos;s trips</p>
              <p className="mt-1.5 text-[14px] text-paper/70">
                Keeps everyone&apos;s picks independent — no copying the cool kids.
              </p>
              <ButtonLink href={myStatus === "new" ? "/trip" : "/trip?step=review"} variant="primary" size="md" className="mt-4">
                Finish my trip <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          )}
        </motion.section>
      </div>
      <SiteFooter className="relative z-[1] mt-4" />
    </div>
  );
}

// ── Date availability heatmap ────────────────────────────────────────

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function heat(count: number, max: number): string {
  if (!count || !max) return "bg-sand-100 text-ink-3/60";
  const r = count / max;
  if (r <= 0.25) return "bg-saffron-100 text-ink";
  if (r <= 0.5) return "bg-saffron-200 text-ink";
  if (r <= 0.75) return "bg-saffron-400 text-ink";
  if (r < 1) return "bg-sunset-500 text-white";
  return "bg-hibiscus-600 text-white";
}

function Heatmap({ stats }: { stats: GroupStats }) {
  const [focus, setFocus] = useState<string | null>(stats.sweetSpot?.start ?? null);
  const max = stats.maxDateCount;
  const flexEntries = FLEX.filter((f) => stats.flexibility[f.id]);

  return (
    <motion.section {...rise} className="rounded-[26px] bg-paper p-4 shadow-card">
      <h2 className="font-display text-[24px] font-semibold leading-tight">When can everyone go?</h2>
      <p className="mt-1 text-[13px] text-ink-3">
        {stats.withDates
          ? `How many of the ${stats.withDates} ${stats.withDates === 1 ? "person" : "people"} with dates can make each day.`
          : "Nobody has picked dates yet."}
      </p>

      {stats.sweetSpot && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-ocean-800 p-3.5 text-paper">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-saffron-400" />
          <p className="text-[14px] leading-snug">
            <span className="font-display text-[17px] font-semibold">Sweet spot: {rangeLabel(stats.sweetSpot.start, stats.sweetSpot.end)}</span>
            <br />
            <span className="text-paper/75">
              {stats.sweetSpot.min === stats.withDates
                ? `Everyone with dates is free all ${stats.sweetSpot.days} days.`
                : `${stats.sweetSpot.min} of ${stats.withDates} free on every one of those ${stats.sweetSpot.days} days.`}
            </span>
          </p>
        </div>
      )}

      <div className="mt-4 space-y-5">
        {[
          { y: 2026, m: 11 },
          { y: 2027, m: 0 },
        ].map(({ y, m }) => {
          const first = new Date(Date.UTC(y, m, 1));
          const lead = (first.getUTCDay() + 6) % 7;
          const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
          const cells: (string | null)[] = Array(lead).fill(null);
          for (let d = 1; d <= days; d++) cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
          return (
            <div key={m}>
              <h3 className="font-display mb-1.5 text-[17px] font-semibold">{monthName(y, m)}</h3>
              <div className="grid grid-cols-7 gap-1">
                {WEEK.map((w, i) => (
                  <div key={i} className="pb-0.5 text-center text-[10.5px] font-bold text-ink-3">
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const c = stats.dateCounts[d] ?? 0;
                  const inSweet = stats.sweetSpot && d >= stats.sweetSpot.start && d <= stats.sweetSpot.end;
                  return (
                    <button
                      key={d}
                      onClick={() => setFocus(d)}
                      aria-label={`${dayLabel(d)}: ${c} ${c === 1 ? "person" : "people"}`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] font-semibold leading-none transition",
                        heat(c, max),
                        focus === d && "ring-2 ring-ink ring-offset-1",
                        inSweet && "outline outline-2 outline-offset-[-2px] outline-ocean-600",
                      )}
                    >
                      <span className="tabular-nums opacity-70">{parseISO(d).getUTCDate()}</span>
                      {c > 0 && <span className="mt-0.5 text-[10px] font-bold tabular-nums">{c}</span>}
                      {d === NYE_DATE && <Firework className="absolute right-0.5 top-0.5 size-2.5 opacity-80" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11.5px] font-semibold text-ink-3">
        <span>Fewer</span>
        <span className="flex flex-1 gap-0.5">
          {["bg-sand-100", "bg-saffron-100", "bg-saffron-200", "bg-saffron-400", "bg-sunset-500", "bg-hibiscus-600"].map((c) => (
            <span key={c} className={cn("h-2.5 flex-1 rounded-sm", c)} />
          ))}
        </span>
        <span>Everyone</span>
      </div>
      {focus && (
        <p className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-[13.5px]">
          <b>{dayLabel(focus)}</b> · {stats.dateCounts[focus] ?? 0} of {stats.withDates} can make it
        </p>
      )}
      {flexEntries.length > 0 && (
        <p className="mt-3 text-[12.5px] text-ink-3">
          {flexEntries.map((f) => `${stats.flexibility[f.id]} ${f.label.toLowerCase()}`).join(" · ")}
          {stats.avgLength ? ` · average trip ${stats.avgLength.toFixed(1)} days` : ""}
        </p>
      )}
    </motion.section>
  );
}
