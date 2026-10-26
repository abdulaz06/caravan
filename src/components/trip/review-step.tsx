"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, FlaskConical, Pencil, Send, Share2, SlidersHorizontal, Smile, Users, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { familySwapCount, familyView } from "@/engine/family";
import { countItems, type ItineraryData, type ItineraryStatus } from "@/engine/itinerary";
import { daysNightsLabel, tripDays } from "@/engine/structure";
import { balanceOf, buildTimeline } from "@/engine/timeline";
import { useCatalog, useEngine } from "../engine";
import { cn } from "@/lib/cn";
import { SiteFooter } from "../brand/site-footer";
import { Lockup, Stamp } from "../brand/wordmark";
import { Button, ButtonLink } from "../ui/button";
import { LocalTime } from "../ui/local-time";
import { BalanceMeter } from "./balance-meter";
import { HighlightsCard } from "./highlights-card";
import type { Step } from "./header";
import { ItineraryTimeline } from "./itinerary-timeline";
import { ShareSheet } from "./share-sheet";
import { TripPoster } from "./trip-poster";
import { VerdictChip } from "./budget";
import { useCurrency } from "../currency";
import type { BudgetResult } from "@/engine/budget";
import type { SaveState } from "./use-autosave";

type Props = {
  name: string;
  data: ItineraryData;
  status: ItineraryStatus;
  updatedAt: string | null;
  locked: boolean;
  saveState: SaveState;
  onEdit: (s: Step) => void;
  /** The shorter preview sandbox can't be submitted — unless the rules allow it. */
  previewing?: boolean;
  canSubmitPreview?: boolean;
  onExitPreview?: () => void;
  /** Unique people who peeked at this plan (anonymous). */
  peekCount?: number;
  /** An organizer editing on someone's behalf: no submitting, no family-friendly mode. */
  adminMode?: boolean;
  budget: BudgetResult;
  onOpenBudget: () => void;
  onSubmit: () => Promise<boolean>;
  /** Family-friendly mode (view only) — state lives in TripApp so it can lock editing everywhere. */
  family?: boolean;
  onFamily?: (on: boolean) => void;
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Relative times depend on "now" — rendered in the browser only (see LocalTime). */
const agoOf = (d: Date) => ago(d.toISOString());

export function ReviewStep({
  name,
  data: saved,
  status,
  updatedAt,
  locked,
  saveState,
  onEdit,
  onSubmit,
  budget,
  onOpenBudget,
  previewing,
  canSubmitPreview = false,
  onExitPreview,
  peekCount = 0,
  adminMode = false,
  family = false,
  onFamily,
}: Props) {
  const e = useEngine();
  const { rules } = e;
  const { preset } = e.catalog;
  // Family-friendly mode only changes what's shown — `saved` is never touched.
  const data = useMemo(() => (family ? familyView(e, saved) : saved), [e, saved, family]);
  const swaps = useMemo(() => familySwapCount(e, saved), [e, saved]);
  const timeline = useMemo(() => buildTimeline(e, data), [e, data]);
  const balance = useMemo(() => balanceOf(e, data), [e, data]);
  const [sharing, setSharing] = useState(false);
  const editable = !locked && !family;
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const submitted = status === "submitted";
  const picks = countItems(data);

  async function submit() {
    setBusy(true);
    const ok = await onSubmit();
    setBusy(false);
    if (!ok) return;
    setCelebrate(true);
    const colors = preset.theme.confetti;
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    setTimeout(
      () => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true }),
      250,
    );
    setTimeout(
      () => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true }),
      400,
    );
  }

  return (
    <div className="grain pb-40">
      <section className="relative z-[1] px-5 pt-7">
        <p className="label text-accent-600">Step 4 · Review</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          {submitted ? (
            <>
              Your trip is <span className="italic text-secondary-600">in</span>
            </>
          ) : (
            <>
              Looking <span className="italic text-primary-700">good</span>
            </>
          )}
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          {locked
            ? "Edits are closed. Here's what you sent in."
            : submitted
              ? (
                <>
                  Submitted · last updated <LocalTime iso={updatedAt} as={agoOf} fallback="" />. You can keep tweaking — changes save
                  automatically until edits close.
                </>
              )
              : "Here's your dream trip. Happy with it? Send it in — you can still change things after."}
        </p>
      </section>

      {family && (
        <div
          role="status"
          className="relative z-[2] mx-3 mt-4 flex items-center gap-3 rounded-2xl bg-secondary-800 p-3 text-[13.5px] leading-snug text-paper shadow-card"
        >
          <Smile className="size-5 shrink-0 text-highlight-400" />
          <p className="flex-1">
            <b>Family-friendly mode: preview only, your real plan is untouched.</b>{" "}
            <span className="text-paper/70">
              {swaps ? `${swaps} ${swaps === 1 ? "pick" : "picks"} swapped for family-friendly alternatives.` : "Nothing needed swapping."}
            </span>
          </p>
          <button
            onClick={() => onFamily?.(false)}
            aria-label="Turn family-friendly mode off"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="relative z-[1] mt-6 space-y-4 px-3">
        <TripPoster name={name} data={data} timeline={timeline} />
        <button
          onClick={() => setSharing(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-paper text-[16px] font-bold text-ink shadow-card ring-1 ring-ink/5 transition hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <Share2 className="size-5 text-accent-500" /> Share my trip
          <span className="rounded-full bg-highlight-200 px-2 py-0.5 text-[11px] font-bold text-ink">Story · Square</span>
        </button>
        <BudgetSummary budget={budget} onOpen={onOpenBudget} />
        <div className="rounded-[26px] bg-paper p-4 shadow-card">
          {/* Family-friendly mode: no Nature ↔ Nightlife scale at all — the plan's highlights instead. */}
          {family ? (
            <HighlightsCard data={data} action={onFamily ? <FamilySwitch on={family} onChange={onFamily} /> : undefined} />
          ) : (
            <BalanceMeter
              balance={balance}
              action={onFamily && !previewing && rules.familyButton ? <FamilySwitch on={family} onChange={onFamily} /> : undefined}
            />
          )}
        </div>
        {peekCount > 0 && (
          <p aria-label="Peek counter" className="flex items-center justify-center gap-2 rounded-2xl bg-night-900 px-4 py-3 text-[14px] font-semibold text-paper shadow-card">
            <span aria-hidden="true" className="text-[18px]">👀</span>
            {peekCount} {peekCount === 1 ? "person" : "people"} peeked at your plan
          </p>
        )}

        {editable && (
          <div className="flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            <EditChip icon={CalendarDays} label="Dates" onClick={() => onEdit("dates")} />
            <EditChip icon={Pencil} label="Days" onClick={() => onEdit("build")} />
            <EditChip icon={SlidersHorizontal} label="Extras" onClick={() => onEdit("prefs")} />
          </div>
        )}

        <section className="rounded-[26px] bg-surface-50 p-4 pt-5 shadow-card ring-1 ring-ink/[0.03]">
          <h2 className="font-display mb-4 text-[24px] font-semibold">Day by day</h2>
          {picks === 0 && (
            <button onClick={() => onEdit("build")} className="mb-4 w-full rounded-2xl bg-highlight-100 p-3.5 text-left text-[14px] text-ink-2">
              You haven&apos;t picked anything yet — <b className="text-ink">try Quick fill</b>, it takes a second.
            </button>
          )}
          <ItineraryTimeline data={data} timeline={timeline} hideNotes={family} />
        </section>

        {/* Their own free-text answers can say anything — family-friendly mode leaves them out. */}
        {!family && <PrefsSummary data={data} />}
      </div>
      <SiteFooter className="relative z-[1] mt-6" />

      {editable && !adminMode && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-surface-100 via-surface-100/90 to-transparent px-4 pt-6 lg:left-auto lg:w-[480px]">
          {previewing && canSubmitPreview ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-highlight-100 px-3 py-2 text-[13px] font-semibold leading-snug text-ink shadow-card ring-1 ring-highlight-200">
                <FlaskConical className="size-4 shrink-0 text-accent-600" />
                <span className="flex-1">The organizers allow shorter trips — submitting makes this your plan.</span>
              </div>
              <Button size="lg" block onClick={submit} disabled={busy || !data.startDate}>
                {busy ? "Sending…" : `Submit my ${daysNightsLabel(data.days.length).split(" · ")[0]} trip`} <Send className="size-[18px]" strokeWidth={2.5} />
              </Button>
            </div>
          ) : previewing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-highlight-100 px-3 py-2 text-[13px] font-semibold leading-snug text-ink shadow-card ring-1 ring-highlight-200">
                <FlaskConical className="size-4 shrink-0 text-accent-600" />
                <span className="flex-1">This trip is {tripDays(e)} days. Switch back to submit.</span>
                <button onClick={onExitPreview} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-paper">
                  Back to {tripDays(e)} days
                </button>
              </div>
              <Button size="lg" block disabled>
                Submit my trip <Send className="size-[18px]" strokeWidth={2.5} />
              </Button>
            </div>
          ) : submitted ? (
            <div className="flex gap-2.5">
              <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary-100 px-4 text-[14px] font-semibold text-secondary-700">
                <CheckCircle2 className="size-5 shrink-0" />
                {saveState === "saving" ? "Saving changes…" : "Submitted · changes auto-save"}
              </div>
              <ButtonLink href="/group" size="lg" variant="ocean" className="px-5">
                <Users className="size-5" /> Group
              </ButtonLink>
            </div>
          ) : (
            <Button size="lg" block onClick={submit} disabled={busy || !data.startDate}>
              {busy ? "Sending…" : "Submit my trip"} <Send className="size-[18px]" strokeWidth={2.5} />
            </Button>
          )}
        </div>
      )}

      {sharing && <ShareSheet onClose={() => setSharing(false)} name={name} data={data} family={family} />}

      <AnimatePresence>
        {celebrate && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-primary-950/60 p-6 backdrop-blur-sm lg:left-auto lg:w-[480px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebrate(false)}
          >
            <motion.div
              initial={{ scale: 0.7, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-paper p-6 pt-20 text-center shadow-lift"
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-highlight-400 sunburst" />
              <Stamp className="absolute left-1/2 top-5 size-28 -translate-x-1/2 text-accent-500" text={preset.destination.stampText} />
              <h2 className="font-display mt-10 text-[34px] font-semibold leading-none">
                You&apos;re <span className="italic text-accent-600">in!</span>
              </h2>
              <p className="mt-3 text-[15px] text-ink-2">
                Your dream trip is in with the crew. Now see where everyone overlaps — and peek at their picks.
              </p>
              <ButtonLink href="/group" size="lg" block className="mt-6">
                See the group <ArrowRight className="size-5" strokeWidth={2.5} />
              </ButtonLink>
              <button onClick={() => setCelebrate(false)} className="mt-3 text-sm font-semibold text-ink-3">
                Back to my trip
              </button>
              <div className="mt-6 flex justify-center border-t border-dashed border-surface-300 pt-5">
                <Lockup size="sm" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Family-friendly mode: a little switch tucked into the vibe card. */
function FamilySwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Family-friendly mode"
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full pl-2 pr-1 text-[11px] font-bold uppercase tracking-wide transition",
        on ? "bg-secondary-800 text-highlight-400" : "bg-surface-100 text-ink-3 hover:text-ink-2",
      )}
    >
      <Smile className="size-3.5" strokeWidth={2.5} />
      Family
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-highlight-400" : "bg-surface-300")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-paper shadow transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

function EditChip({ icon: Icon, label, onClick }: { icon: typeof Pencil; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-paper px-4 text-[14px] font-semibold shadow-card transition hover:-translate-y-0.5">
      <Icon className="size-4 text-primary-600" /> Edit {label.toLowerCase()}
    </button>
  );
}

export function PrefsSummary({ data, title = "Your extras" }: { data: ItineraryData; title?: string }) {
  const p = data.preferences;
  const { budgets, stays, sharedRooms, earlyMornings, transport, interests, dietary } = useCatalog().preset.preferences;
  const find = (list: readonly { id: string; label: string }[], id?: string) => list.find((x) => x.id === id)?.label;
  const rows: [string, string | undefined][] = [
    ["Budget", find(budgets, p.budget)],
    ["Stay", find(stays, p.stay)],
    ["Rooms", find(sharedRooms, p.sharedRooms)],
    ["Early mornings", find(earlyMornings, p.earlyMornings)],
    ["Getting around", find(transport, p.transport)],
    ["Into", p.interests?.map((i) => find(interests, i)).join(", ")],
    ["Dietary", [...(p.dietary?.map((i) => find(dietary, i)) ?? []), p.dietaryOther].filter(Boolean).join(", ")],
    ["Flying from", p.flyingFrom],
    ["Must-do", p.mustDo],
    ["Hard no", p.hardNo],
    ["Ideas", p.suggestions],
    ["Notes", p.notes],
    ["Roommates", p.roommates?.map((r, i) => `${i + 1}. ${r.name}${r.id ? "" : " (not joined yet)"}`).join("\n")],
  ];
  const shown = rows.filter(([, v]) => v && v.trim());
  if (!shown.length) return null;
  return (
    <section className="rounded-[26px] bg-paper p-4 shadow-card">
      <h2 className="font-display text-[22px] font-semibold">{title}</h2>
      <dl className="mt-3 divide-y divide-ink/5">
        {shown.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-2.5 text-[14px]">
            <dt className="font-semibold text-ink-3">{k}</dt>
            <dd className="whitespace-pre-line text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BudgetSummary({ budget, onOpen }: { budget: BudgetResult; onOpen: () => void }) {
  const { range, rateNote } = useCurrency();
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[26px] bg-paper p-4 text-left shadow-card transition hover:-translate-y-0.5 lg:pointer-events-none"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-100 text-primary-700">
        <Wallet className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label block text-ink-3">Trip budget · per person</span>
        <span className="font-display block text-[24px] font-semibold leading-tight tabular-nums">≈ {range(budget.total)}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <VerdictChip verdict={budget.verdict} />
          <span className="text-[11px] text-ink-3">Excl. flights · ≈ {rateNote}</span>
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-3 min-[1360px]:hidden" />
    </button>
  );
}
