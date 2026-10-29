"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  CalendarRange,
  Check,
  GitCompareArrows,
  History,
  Loader2,
  Lock,
  Megaphone,
  Pin,
  Scale,
  SlidersHorizontal,
  Split,
  Trophy,
  Unlock,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MODE_COPY, type ConsensusPlan, type DecisionMode, type ModeSummary, type PlanSettings, type PlanSlot } from "@/engine/consensus";
import { STAY_ID } from "@/engine/itinerary";
import { daysNightsLabel, lengthBounds } from "@/engine/structure";
import { buildTimeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { addDays, dayLabel, rangeLabel } from "@/lib/dates";
import type { PlanState } from "@/lib/server/plan";
import { useEngine, useTrip } from "../engine";
import { PlanBudget, PlanDays, PlanMap, type PlanItemLike, type PlanSlotLike } from "../plan/plan-days";
import { Avatar } from "../avatar";
import { Button } from "../ui/button";
import { LocalTime } from "../ui/local-time";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";

type Props = {
  /** The knobs stored with the trip (the demo: the defaults, kept in this browser). */
  settings: PlanSettings;
  state: PlanState | null;
  /** The public demo: everything works as a preview; nothing is saved or published. */
  demo: boolean;
};

const MODE_ICONS: Record<DecisionMode, typeof Users> = { together: Users, majority: Trophy, custom: SlidersHorizontal };
const pct = (x: number) => `${Math.round(x * 100)}%`;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

export function PlanTab({ settings: initialSettings, state: initialState, demo }: Props) {
  const e = useEngine();
  const trip = useTrip();
  const toast = useToast();
  const { catalog } = e;
  const [settings, setSettings] = useState<PlanSettings>(initialSettings);
  const [plan, setPlan] = useState<ConsensusPlan | null>(null);
  const [state, setState] = useState<PlanState | null>(initialState);
  const [busy, setBusy] = useState<null | "generate" | "compare" | "save">(null);
  const [choosing, setChoosing] = useState(!initialSettings.mode);
  const [knobs, setKnobs] = useState(false);
  const [modes, setModes] = useState<ModeSummary[] | null>(null);
  const [swap, setSwap] = useState<PlanSlot | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const generate = useCallback(
    async (next: PlanSettings) => {
      setSettings(next);
      if (!next.mode) return;
      setBusy("generate");
      const r = await post(trip.api("/admin/plan"), { action: "generate", settings: next });
      setBusy(null);
      if (r.ok) setPlan(r.body.plan);
      else toast(r.body.error ?? "Couldn't make the plan — try again", "error");
    },
    [trip, toast],
  );

  // Open on the plan the knobs make now (there's no plan to show before a mode is chosen).
  useEffect(() => {
    if (!initialSettings.mode) return;
    const t = setTimeout(() => void generate(initialSettings), 0);
    return () => clearTimeout(t);
  }, [initialSettings, generate]);

  async function compare() {
    setBusy("compare");
    const r = await post(trip.api("/admin/plan"), { action: "compare", settings });
    setBusy(null);
    if (r.ok) setModes(r.body.modes);
    else toast(r.body.error ?? "Couldn't compare", "error");
  }

  async function save(publish: boolean) {
    setBusy("save");
    const r = await post(trip.api("/admin/plan"), { action: "save", settings, publish });
    setBusy(null);
    if (!r.ok) {
      toast(r.body.error ?? "Couldn't save the plan", "error");
      return;
    }
    setPlan(r.body.plan);
    setState(r.body.state);
    toast(publish ? `Published — version ${r.body.saved} is the plan everyone sees` : `Saved as version ${r.body.saved}`);
  }

  async function publish(versionId: string) {
    const r = await post(trip.api("/admin/plan"), { action: "publish", versionId });
    if (!r.ok) {
      toast(r.body.error ?? "Couldn't publish", "error");
      return;
    }
    setState(r.body.state);
    toast(`Version ${r.body.published} is now the plan everyone sees`);
  }

  const lockOf = (s: PlanSlotLike, id: string) => settings.locks.find((l) => l.date === s.date && l.slot === s.slot && l.id === id);
  const toggleLock = (s: PlanSlotLike, item: PlanItemLike) => {
    const has = lockOf(s, item.id);
    const locks = has
      ? settings.locks.filter((l) => l !== has)
      : [...settings.locks.filter((l) => !(l.date === s.date && l.slot === s.slot && l.role === "main" && item.role === "main")), { date: s.date, slot: s.slot, id: item.id, role: item.role, ...(item.variant ? { variant: item.variant } : {}) }];
    void generate({ ...settings, locks });
  };
  const swapTo = (s: PlanSlot, id: string) => {
    const locks = [...settings.locks.filter((l) => !(l.date === s.date && l.slot === s.slot && l.role === "main")), { date: s.date, slot: s.slot, id, role: "main" as const }];
    setSwap(null);
    void generate({ ...settings, locks });
  };
  const decideSplit = (s: PlanSlot, status: "accepted" | "rejected" | null) => {
    const splits = { ...settings.splits };
    if (status && s.split) splits[s.key] = { status, a: s.split.a.id, b: s.split.b.id };
    else delete splits[s.key];
    void generate({ ...settings, splits });
  };

  const timeline = useMemo(() => (plan ? buildTimeline(e, plan.itinerary) : null), [e, plan]);
  const title = (id: string) => (id === STAY_ID ? "Free time" : (catalog.byId[id]?.title ?? id));

  return (
    <>
      {demo && (
        <p className="rounded-2xl bg-highlight-100 px-3.5 py-2.5 text-[13px] leading-snug text-ink ring-1 ring-highlight-200">
          <b>Try it:</b> choose how the group decides, generate, swap, lock and compare. It&apos;s a preview — nothing here is saved or published, and the
          crew&apos;s published plan stays as it is.
        </p>
      )}

      <section className="rounded-[24px] bg-paper p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-800 text-highlight-400">
            <Wand2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[24px] font-semibold leading-tight">The group plan</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
              Everyone&apos;s plans, turned into one suggested trip. Deterministic and explained: every pick says why it&apos;s there.
            </p>
          </div>
        </div>
        {settings.mode && !choosing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setChoosing(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary-800 pl-2.5 pr-3.5 text-[13px] font-bold text-paper"
              aria-label={`Decision mode: ${MODE_COPY[settings.mode].label}. Change`}
            >
              {(() => {
                const Icon = MODE_ICONS[settings.mode];
                return <Icon className="size-4 text-highlight-400" />;
              })()}
              {MODE_COPY[settings.mode].label}
              <span className="font-semibold text-paper/60">· change</span>
            </button>
            <Button size="sm" variant="light" onClick={() => setKnobs(true)}>
              <SlidersHorizontal className="size-4" /> Knobs
            </Button>
            <Button size="sm" variant="light" onClick={compare} disabled={!!busy}>
              {busy === "compare" ? <Loader2 className="size-4 animate-spin" /> : <GitCompareArrows className="size-4" />} Compare modes
            </Button>
            <Button size="sm" variant="ocean" onClick={() => generate(settings)} disabled={!!busy}>
              {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Regenerate
            </Button>
          </div>
        )}
        <AnimatePresence initial={false}>
          {choosing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <ModeChooser
                value={settings.mode}
                fairness={settings.fairness}
                onCancel={settings.mode ? () => setChoosing(false) : undefined}
                onChoose={(mode, fairness) => {
                  setChoosing(false);
                  void generate({ ...settings, mode, fairness });
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {busy === "generate" && !plan && (
        <p className="flex items-center justify-center gap-2 py-8 text-[14px] font-semibold text-ink-3">
          <Loader2 className="size-5 animate-spin" /> Weighing everyone&apos;s picks…
        </p>
      )}

      {modes && <CompareModes modes={modes} current={settings.mode} onPick={(m) => generate({ ...settings, mode: m })} onClose={() => setModes(null)} />}

      {plan && timeline && (
        <div className={cn("space-y-4 transition-opacity", busy === "generate" && "opacity-60")}>
          <DatesCard
            plan={plan}
            chosenLength={settings.length}
            onPin={(start) => generate({ ...settings, start, length: plan.dates.length })}
            onLength={(length) => generate({ ...settings, start: null, length })}
            onUnpin={() => generate({ ...settings, start: null, length: null })}
          />
          {plan.notes.map((n) => (
            <p key={n} className="rounded-2xl bg-accent-100 px-3.5 py-2.5 text-[13px] font-semibold text-accent-700">
              {n}
            </p>
          ))}
          <Satisfaction plan={plan} />
          <PlanBudget budget={plan.budget} />
          <PlanMap data={plan.itinerary} timeline={timeline} />
          <PlanDays
            data={plan.itinerary}
            timeline={timeline}
            slots={plan.slots}
            renderItem={(item, s) => {
              const full = plan.slots.find((x) => x.key === s.key)!;
              const locked = !!lockOf(s, item.id);
              const floorFor = full.items.find((i) => i.key === item.key)?.floorFor ?? [];
              // Answers on the published plan, where this item is the same thing on the same date.
              const rsvp = state?.rsvps[item.key];
              return (
                <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
                  <button
                    onClick={() => toggleLock(s, item)}
                    aria-pressed={locked}
                    aria-label={`${locked ? "Unlock" : "Lock"} ${title(item.id)}`}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold transition",
                      locked ? "bg-ink text-paper" : "bg-surface-100 text-ink-2 ring-1 ring-surface-200 hover:bg-surface-200",
                    )}
                  >
                    {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />} {locked ? "Locked" : "Lock"}
                  </button>
                  {item.role === "main" && !full.special && (
                    <button
                      onClick={() => setSwap(full)}
                      aria-label={`Swap ${title(item.id)}`}
                      className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-100 px-2.5 text-[12px] font-bold text-ink-2 ring-1 ring-surface-200 hover:bg-surface-200"
                    >
                      <ArrowLeftRight className="size-3" /> Swap
                    </button>
                  )}
                  {floorFor.length > 0 && <span className="text-[11.5px] font-semibold text-secondary-700">For {floorFor.join(", ")}</span>}
                  {rsvp && rsvp.in + rsvp.skip > 0 && (
                    <span className="ml-auto text-[11.5px] font-semibold text-ink-3" title={`In: ${rsvp.names?.in.join(", ")}\nSkipping: ${rsvp.names?.skip.join(", ")}`}>
                      ✓ {rsvp.in} in · {rsvp.skip} skipping
                    </span>
                  )}
                </div>
              );
            }}
            renderSlot={(s) => {
              const full = plan.slots.find((x) => x.key === s.key)!;
              return full.split ? <SplitCard slot={full} onDecide={(st) => decideSplit(full, st)} /> : null;
            }}
          />
          <Versions
            state={state}
            demo={demo}
            busy={busy === "save"}
            onSave={save}
            onPublish={publish}
            onDiff={() => setDiffOpen(true)}
          />
        </div>
      )}

      <Sheet open={knobs} onClose={() => setKnobs(false)} size="auto" eyebrow="The group plan" title="Knobs">
        <Knobs
          settings={settings}
          onApply={(next) => {
            setKnobs(false);
            void generate(next);
          }}
        />
      </Sheet>
      <Sheet open={!!swap} onClose={() => setSwap(null)} size="auto" eyebrow={swap ? `${dayLabel(swap.date)} · ${catalog.preset.structure.slots[swap.slot].label}` : ""} title="Swap for…">
        {swap && (
          <div className="px-4 pb-8">
            <p className="px-1 text-[13px] text-ink-3">Ranked by the group&apos;s votes. Swapping locks your choice in, so regenerating keeps it.</p>
            <ul className="mt-3 space-y-1.5">
              {swap.alternatives.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => swapTo(swap, a.id)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-100 p-3 text-left hover:bg-surface-200"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{title(a.id)}</span>
                      <span className="text-[12px] text-ink-3">
                        {a.id === STAY_ID ? `${a.present} want some slower time` : `${a.votes} picked it${a.present < a.votes ? ` · ${a.present} there that day` : ""}`}
                        {a.elsewhere && " · moves it from another day"}
                      </span>
                    </span>
                    <ArrowLeftRight className="size-4 shrink-0 text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
      <Sheet open={diffOpen} onClose={() => setDiffOpen(false)} eyebrow="Versions" title="The latest two, side by side">
        {state && state.latest.length === 2 && <VersionDiff a={state.latest[1]} b={state.latest[0]} />}
      </Sheet>
    </>
  );
}

// ── Choosing how the group decides ────────────────────────────────────

function ModeChooser({
  value,
  fairness,
  onChoose,
  onCancel,
}: {
  value: DecisionMode | null;
  fairness: number;
  onChoose: (mode: DecisionMode, fairness: number) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<DecisionMode | null>(value);
  const [t, setT] = useState(fairness);
  return (
    <div className="mt-4 border-t border-ink/5 pt-4">
      <p className="text-[15px] font-bold">How should the group decide?</p>
      <p className="mt-0.5 text-[12.5px] text-ink-3">There&apos;s no default — it&apos;s your call, and you can switch any time.</p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Decision mode">
        {(Object.keys(MODE_COPY) as DecisionMode[]).map((m) => {
          const Icon = MODE_ICONS[m];
          const on = mode === m;
          return (
            <button
              key={m}
              role="radio"
              aria-checked={on}
              onClick={() => setMode(m)}
              className={cn("flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition", on ? "border-primary-600 bg-primary-100/60" : "border-transparent bg-surface-100")}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-primary-700 text-paper" : "bg-paper text-primary-700")}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-tight">{MODE_COPY[m].label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{MODE_COPY[m].how}</span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === "custom" && <FairnessSlider value={t} onChange={setT} className="mt-3" />}
      <div className="mt-3 flex gap-2">
        <Button size="md" disabled={!mode} onClick={() => mode && onChoose(mode, t)} className="flex-1">
          <Wand2 className="size-[18px]" /> {value ? "Use this & regenerate" : "Generate the plan"}
        </Button>
        {onCancel && (
          <Button size="md" variant="light" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function FairnessSlider({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <label className={cn("block rounded-2xl bg-surface-100 p-3", className)}>
      <span className="flex justify-between text-[12px] font-bold text-ink-3">
        <span>Most popular</span>
        <span>Fair to everyone</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(ev) => onChange(Number(ev.target.value))}
        aria-label="Popularity to fairness"
        className="mt-1.5 w-full accent-primary-700"
      />
    </label>
  );
}

// ── Knobs ─────────────────────────────────────────────────────────────

function Knobs({ settings, onApply }: { settings: PlanSettings; onApply: (s: PlanSettings) => void }) {
  const e = useEngine();
  const [s, setS] = useState(settings);
  const bounds = lengthBounds(e);
  const row = (title: string, hint: string, control: React.ReactNode) => (
    <div className="border-t border-ink/5 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>
        </div>
        {control}
      </div>
    </div>
  );
  const unitSlider = (k: "draftWeight" | "variety" | "budgetFit", label: string) => (
    <input type="range" min={0} max={1} step={0.25} value={s[k]} onChange={(ev) => setS({ ...s, [k]: Number(ev.target.value) })} aria-label={label} className="w-32 accent-primary-700" />
  );
  const rangeSlider = (k: "tolerance" | "splitShare", min: number, max: number, label: string) => (
    <input type="range" min={min} max={max} step={0.05} value={s[k]} onChange={(ev) => setS({ ...s, [k]: Number(ev.target.value) })} aria-label={label} className="w-32 accent-primary-700" />
  );
  // Custom gives up a share of the tolerance in step with the slider.
  const giveUp = s.mode === "custom" ? s.tolerance * s.fairness : s.tolerance;
  const stepper = (value: number | null, min: number, max: number, set: (v: number | null) => void, label: string, autoLabel: string) => (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button aria-label={`Less ${label}`} onClick={() => set(value === null ? max : value <= min ? null : value - 1)} className="grid size-8 place-items-center rounded-full bg-surface-200 font-bold">
        −
      </button>
      <span className="min-w-12 text-center text-[13px] font-bold tabular-nums">{value === null ? autoLabel : value}</span>
      <button aria-label={`More ${label}`} onClick={() => set(value === null ? min : Math.min(max, value + 1))} className="grid size-8 place-items-center rounded-full bg-surface-200 font-bold">
        +
      </button>
    </div>
  );
  return (
    <div className="px-5 pb-8">
      {s.mode === "custom" && <FairnessSlider value={s.fairness} onChange={(v) => setS({ ...s, fairness: v })} className="mb-3" />}
      {row("Drafts count for", `${pct(s.draftWeight)} of a submitted plan's say.`, unitSlider("draftWeight", "Draft weight"))}
      {row(
        "Popularity it may give up",
        s.mode === "majority"
          ? "Majority rules never gives any up. Used by Everyone gets a say and Custom."
          : `Up to ${pct(giveUp)} of the plan's popularity, to lift whoever gets the smallest share of their picks${s.mode === "custom" ? " (at this slider)" : ""}.`,
        rangeSlider("tolerance", 0, 0.5, "Popularity it may give up"),
      )}
      {row(
        "Suggest splitting up",
        `When both camps are at least ${pct(s.splitShare)} of the people there (and 3 or more), and mostly different people.`,
        rangeSlider("splitShare", 0.15, 0.75, "Split threshold"),
      )}
      {row("Variety", s.variety === 0 ? "Repeats are fine." : s.variety === 1 ? "Mix it up as much as possible." : "Avoid the same place or kind of thing back to back.", unitSlider("variety", "Variety"))}
      {row("Fit the budget", s.budgetFit ? "Lean towards what fits the budgets people set." : "Cost doesn't steer the plan (it's still estimated).", unitSlider("budgetFit", "Budget fit"))}
      {row(
        "Trip length",
        s.length ? daysNightsLabel(s.length) : "Auto: the best balance of days and people there for all of them.",
        stepper(s.length, bounds.min, bounds.max, (v) => setS({ ...s, length: v, start: v === null ? null : s.start }), "days", "Auto"),
      )}
      <div className="mt-3 grid gap-2">
        <Button size="lg" onClick={() => onApply(s)}>
          <Wand2 className="size-[18px]" /> Regenerate with these
        </Button>
        {(s.locks.length > 0 || Object.keys(s.splits).length > 0) && (
          <Button size="md" variant="light" onClick={() => onApply({ ...s, locks: [], splits: {} })}>
            Clear {s.locks.length} {s.locks.length === 1 ? "lock" : "locks"} and split decisions
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Dates, satisfaction, compare, splits, versions ────────────────────

function DatesCard({
  plan,
  chosenLength,
  onPin,
  onLength,
  onUnpin,
}: {
  plan: ConsensusPlan;
  chosenLength: number | null;
  onPin: (start: string) => void;
  onLength: (length: number) => void;
  onUnpin: () => void;
}) {
  const { chosen, runnersUp, length, lengthReason, pinned, withDates } = plan.dates;
  const names = new Map(plan.people.map((p) => [p.id, p.name]));
  const { rules } = useEngine();
  const lastStart = addDays(rules.window.end, -(length - 1));
  const [pinAt, setPinAt] = useState(chosen.start);
  return (
    <section className="rounded-[24px] bg-primary-800 p-4 text-paper shadow-card">
      <p className="label flex items-center gap-1.5 text-highlight-400">
        <CalendarRange className="size-3.5" /> The dates {pinned && "· pinned"}
      </p>
      <p className="font-display mt-1.5 text-[26px] font-semibold leading-tight">{rangeLabel(chosen.start, chosen.end)}</p>
      <p className="text-[13.5px] text-paper/75">
        {daysNightsLabel(length)} · {lengthReason}
      </p>
      <p className="mt-2 text-[14px] font-semibold">
        {chosen.full} of {withDates} free for all of it{chosen.missing.length > 0 && ` · ${chosen.missing.length} would miss some days`}
      </p>
      {chosen.missing.length > 0 && <MissList missing={chosen.missing} names={names} />}
      {(pinned || chosenLength !== null) && (
        <button onClick={onUnpin} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12.5px] font-bold hover:bg-white/20">
          <X className="size-3.5" /> {pinned ? "Unpin" : "Back to auto"} — let the group&apos;s dates decide
        </button>
      )}
      {(plan.dates.lengths ?? []).length > 0 && <LengthTable plan={plan} onLength={onLength} />}
      {runnersUp.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="label text-paper/60">Runners-up</p>
          <ul className="mt-2 space-y-2">
            {runnersUp.map((w) => (
              <li key={w.start} className="rounded-2xl bg-white/[0.07] p-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold">{rangeLabel(w.start, w.end)}</span>
                    <span className="text-[12.5px] text-paper/70">
                      {w.full} of {withDates} free for all of it · {w.personDays} person-days
                    </span>
                  </span>
                  <button onClick={() => onPin(w.start)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-highlight-400 px-3 text-[12.5px] font-bold text-ink">
                    <Pin className="size-3.5" /> Use these
                  </button>
                </div>
                {w.missing.length > 0 && <MissList missing={w.missing} names={names} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {lastStart >= rules.window.start && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (pinAt >= rules.window.start && pinAt <= lastStart) onPin(pinAt);
          }}
        >
          <label htmlFor="pin-start" className="text-[12.5px] font-semibold text-paper/75">
            Or pin any {length}-day window from
          </label>
          <input
            id="pin-start"
            type="date"
            value={pinAt}
            min={rules.window.start}
            max={lastStart}
            onChange={(ev) => setPinAt(ev.target.value)}
            className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-bold text-paper [color-scheme:dark]"
          />
          <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-full bg-white/15 px-3 text-[12.5px] font-bold hover:bg-white/25">
            <Pin className="size-3.5" /> Pin
          </button>
        </form>
      )}
    </section>
  );
}

/** Length vs attendance: each length's best window and how many can do all of it. */
function LengthTable({ plan, onLength }: { plan: ConsensusPlan; onLength: (length: number) => void }) {
  const { length, withDates } = plan.dates;
  const all = plan.dates.lengths.filter((o) => o.full > 0 || o.length === length);
  const [more, setMore] = useState(false);
  // Around the chosen length first (the rest one tap away).
  const at = Math.max(0, all.findIndex((o) => o.length === length));
  const from = Math.max(0, Math.min(at - 3, all.length - 7));
  const shown = more ? all : all.slice(from, from + 7);
  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="label text-paper/60">How long? Days vs who can do it all</p>
      <ul className="mt-2 space-y-1" aria-label="Trip length trade-off">
        {shown.map((o) => {
          const on = o.length === length;
          return (
            <li key={o.length} className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-1.5", on ? "bg-white/[0.14]" : "bg-white/[0.05]")}>
              <span className="w-14 shrink-0 text-[14px] font-bold tabular-nums">{o.length === 1 ? "1 day" : `${o.length} days`}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-highlight-400" style={{ width: pct(withDates ? o.full / withDates : 0) }} />
                  </span>
                  <span className="text-[12.5px] font-semibold">
                    {o.full} of {withDates} can do it all
                  </span>
                </span>
                <span className="block truncate text-[11.5px] text-paper/60">
                  {rangeLabel(o.start, o.end)}
                  {o.recommended && " · best balance"}
                </span>
              </span>
              {on ? (
                <span className="shrink-0 text-[11.5px] font-bold text-highlight-400">Chosen</span>
              ) : (
                <button onClick={() => onLength(o.length)} className="h-7 shrink-0 rounded-full bg-white/10 px-2.5 text-[12px] font-bold hover:bg-white/20" aria-label={`Use ${o.length} days`}>
                  Use
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {all.length > shown.length && (
        <button onClick={() => setMore(true)} className="mt-1.5 text-[12px] font-bold text-paper/70 underline-offset-2 hover:underline">
          All {all.length} lengths
        </button>
      )}
      <p className="mt-1.5 text-[11.5px] leading-snug text-paper/55">Best balance: the most “people there for all of it × days”, never shorter than the suggested minimum.</p>
    </div>
  );
}

function MissList({ missing, names }: { missing: { id: string; days: string[] }[]; names: Map<string, string> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Who'd miss days">
      {missing.map((m) => (
        <li key={m.id} className="rounded-full bg-white/10 px-2 py-0.5 text-[11.5px] font-semibold text-paper/85">
          {names.get(m.id) ?? "Someone"} misses {m.days.length === 1 ? dayLabel(m.days[0]) : `${m.days.length} days`}
        </li>
      ))}
    </ul>
  );
}

function Satisfaction({ plan }: { plan: ConsensusPlan }) {
  const { fairness } = plan;
  const [open, setOpen] = useState<string | null>(null);
  const { catalog } = useEngine();
  const people = [...plan.people].sort((a, b) => (a.satisfaction ?? 2) - (b.satisfaction ?? 2) || a.name.localeCompare(b.name));
  return (
    <section className="rounded-[24px] bg-paper p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Scale className="size-[18px] text-primary-600" /> Everyone&apos;s picks
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { l: "Lowest", v: pct(fairness.min) },
          { l: "Median", v: pct(fairness.median) },
          { l: "Fairness", v: fairness.index.toFixed(2) },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl bg-surface-100 p-2.5 text-center">
            <p className="font-display text-[24px] font-semibold leading-none">{x.v}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">{x.l}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-3">
        Share of each person&apos;s picks that made the plan, of the ones that could fit the days they&apos;re there. Fairness is Jain&apos;s index: 1.00 means
        everyone did equally well.
      </p>
      {plan.settings.mode !== "majority" && (
        <p className="mt-2 rounded-xl bg-secondary-100/70 px-3 py-2 text-[12.5px] leading-snug text-ink-2">
          {fairness.min > fairness.majority.min + 1e-9 ? (
            <>
              Versus Majority rules, the lowest share went from <b>{pct(fairness.majority.min)}</b> to <b>{pct(fairness.min)}</b>
              {fairness.lifted > 0 && ` (${fairness.lifted} lifted)`}, keeping {pct(Math.min(1, fairness.scoreKept))} of its popularity.
            </>
          ) : (
            (fairness.note ?? "The most popular plan is already the fairest here.")
          )}
        </p>
      )}
      <ul className="mt-3 space-y-1.5" aria-label="Satisfaction per person">
        {people.map((p) => (
          <li key={p.id}>
            <button onClick={() => setOpen(open === p.id ? null : p.id)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1 text-left hover:bg-surface-100" aria-expanded={open === p.id}>
              <Avatar name={p.name} className="size-7 text-[12px] ring-0" />
              <span className="w-20 shrink-0 truncate text-[13.5px] font-semibold">{p.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-200">
                <span className="block h-full rounded-full bg-secondary-600" style={{ width: pct(p.satisfaction ?? 0) }} />
              </span>
              <span className="w-[5.5rem] shrink-0 text-right text-[12px] font-bold tabular-nums text-ink-2">
                {p.satisfaction === null ? <span className="font-semibold text-ink-3">{p.picks ? "away" : "no picks"}</span> : `${pct(p.satisfaction)} · ${p.made.length}/${p.feasible}`}
              </span>
            </button>
            {open === p.id && (
              <div className="mb-2 ml-10 mt-1 space-y-1 text-[12.5px] leading-snug">
                {p.daysThere < plan.dates.length && <p className="text-ink-3">There {p.daysThere} of {plan.dates.length} days.</p>}
                {p.feasible < p.picks && (
                  <p className="text-ink-3">
                    {p.feasible} of their {p.picks} picks could fit the days they&apos;re there.
                  </p>
                )}
                {p.floorAdded > 0 && <p className="font-semibold text-secondary-700">{p.floorAdded} added to lift them.</p>}
                {p.missed.slice(0, 8).map((m) => (
                  <p key={m.id} className="text-ink-2">
                    <span className="font-semibold">{catalog.byId[m.id]?.title ?? m.id}</span> — {m.reason}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareModes({ modes, current, onPick, onClose }: { modes: ModeSummary[]; current: DecisionMode | null; onPick: (m: DecisionMode) => void; onClose: () => void }) {
  const same = modes.every((m) => m.differs === 0);
  const together = modes.find((m) => m.mode === "together");
  return (
    <section className="rounded-[24px] bg-paper p-4 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="flex flex-1 items-center gap-2 text-[17px] font-bold">
          <GitCompareArrows className="size-[18px] text-primary-600" /> Compare modes
        </h2>
        <button onClick={onClose} aria-label="Close compare" className="grid size-8 place-items-center rounded-full hover:bg-surface-100">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-3">
        Same picks, same dates, same locks — only how the group decides changes.
      </p>
      {same && (
        <p className="mt-2 rounded-xl bg-highlight-100 px-3 py-2 text-[12.5px] leading-snug text-ink ring-1 ring-highlight-200">
          <b>Every mode makes the same plan here.</b> {together?.fairness.note ?? "The most popular plan is already the fairest."}
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => onPick(m.mode)}
            aria-pressed={current === m.mode}
            className={cn("rounded-2xl border-2 p-2.5 text-left transition", current === m.mode ? "border-primary-600 bg-primary-100/60" : "border-transparent bg-surface-100 hover:bg-surface-200")}
          >
            <span className="block text-[12.5px] font-bold leading-tight">{m.label}</span>
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-3">Lowest</span>
            <span className="font-display block text-[20px] font-semibold leading-none">{pct(m.fairness.min)}</span>
            <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-3">Median</span>
            <span className="font-display block text-[20px] font-semibold leading-none">{pct(m.fairness.median)}</span>
            <span className="mt-1.5 block text-[11.5px] leading-snug text-ink-2">
              Fairness {m.fairness.index.toFixed(2)} · {m.picksMade} picks in
              {m.leftOut > 0 && <span className="block font-bold text-accent-700">{m.leftOut} with none of theirs</span>}
              {m.mode !== "majority" && m.fairness.scoreKept < 0.995 && <span className="block text-ink-3">{pct(m.fairness.scoreKept)} of the popularity</span>}
              {m.differs > 0 && <span className="block text-ink-3">{m.differs} slots differ</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SplitCard({ slot, onDecide }: { slot: PlanSlot; onDecide: (s: "accepted" | "rejected" | null) => void }) {
  const { catalog } = useEngine();
  const sp = slot.split!;
  const name = (id: string) => catalog.byId[id]?.title.split(/[:·(]/)[0].trim() ?? id;
  return (
    <div className={cn("rounded-2xl p-3", sp.status === "accepted" ? "bg-secondary-800 text-paper" : sp.status === "rejected" ? "bg-surface-100 text-ink-3" : "bg-highlight-100 ring-1 ring-highlight-200")}>
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        <Split className="size-4" />
        {sp.status === "accepted" ? "Splitting up for this one" : sp.status === "rejected" ? "Staying together (split declined)" : "Split suggestion"}
      </p>
      <p className={cn("mt-1 text-[13px] leading-snug", sp.status === "accepted" ? "text-paper/80" : "text-ink-2")}>
        {sp.a.votes} want {name(sp.a.id)} / {sp.b.votes} want {name(sp.b.id)}
        {sp.both > 0 ? ` (${sp.both} picked both)` : " — mostly different people"}.
      </p>
      <p className={cn("mt-1 text-[11.5px]", sp.status === "accepted" ? "text-paper/60" : "text-ink-3")}>
        {name(sp.a.id)}: {sp.aBy.join(", ")} · {name(sp.b.id)}: {sp.bBy.join(", ")}
      </p>
      <div className="mt-2 flex gap-1.5">
        {sp.status !== "accepted" && (
          <button onClick={() => onDecide("accepted")} className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[12.5px] font-bold text-paper">
            <Check className="size-3.5" /> Split up
          </button>
        )}
        {sp.status === "suggested" && (
          <button onClick={() => onDecide("rejected")} className="inline-flex h-8 items-center rounded-full bg-paper px-3 text-[12.5px] font-bold text-ink ring-1 ring-ink/10">
            Stay together
          </button>
        )}
        {sp.status !== "suggested" && (
          <button onClick={() => onDecide(null)} className={cn("inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-bold", sp.status === "accepted" ? "bg-white/10" : "bg-paper ring-1 ring-ink/10")}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

function Versions({
  state,
  demo,
  busy,
  onSave,
  onPublish,
  onDiff,
}: {
  state: PlanState | null;
  demo: boolean;
  busy: boolean;
  onSave: (publish: boolean) => void;
  onPublish: (id: string) => void;
  onDiff: () => void;
}) {
  const versions = state?.versions ?? [];
  return (
    <section className="rounded-[24px] bg-paper p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <History className="size-[18px] text-primary-600" /> Versions
      </h2>
      <p className="mt-0.5 text-[12.5px] text-ink-3">Save what you see as a version; publish one to show it to everyone as “The plan”.</p>
      {demo ? (
        <p className="mt-3 rounded-2xl bg-surface-100 px-3 py-2.5 text-[13px] text-ink-2">Saving and publishing are switched off in the demo.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="md" variant="light" disabled={busy} onClick={() => onSave(false)}>
            Save version
          </Button>
          <Button size="md" disabled={busy} onClick={() => onSave(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />} Publish
          </Button>
        </div>
      )}
      {versions.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/5" aria-label="Saved versions">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2 py-2.5">
              <span className="font-display w-9 text-[18px] font-semibold text-ink-3">v{v.version}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {MODE_COPY[v.mode].label} · {rangeLabel(v.start, v.end)}
                </span>
                <span className="block text-[12px] text-ink-3">
                  {v.createdBy || "An organizer"} · <LocalTime iso={v.createdAt} as="date" /> · lowest {pct(v.fairness.min)}
                </span>
              </span>
              {v.id === state?.publishedId ? (
                <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-bold text-secondary-700">Published</span>
              ) : (
                !demo && (
                  <button onClick={() => onPublish(v.id)} className="h-8 rounded-full bg-surface-100 px-3 text-[12px] font-bold ring-1 ring-surface-200 hover:bg-surface-200">
                    Publish
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {versions.length >= 2 && (
        <Button size="sm" variant="light" className="mt-2" onClick={onDiff}>
          <GitCompareArrows className="size-4" /> Compare the latest two
        </Button>
      )}
    </section>
  );
}

function VersionDiff({ a, b }: { a: { version: number; plan: ConsensusPlan }; b: { version: number; plan: ConsensusPlan } }) {
  const { catalog } = useEngine();
  const title = (id: string) => (id === STAY_ID ? "Free time" : (catalog.byId[id]?.title ?? id));
  const before = new Map(a.plan.slots.map((s) => [s.key, s]));
  const changes = b.plan.slots
    .map((s) => ({ s, old: before.get(s.key) }))
    .filter(({ s, old }) => !old || old.items.map((i) => i.id).join() !== s.items.map((i) => i.id).join());
  const row = (l: string, x: string, y: string) => (
    <tr className="border-t border-ink/5">
      <td className="py-1.5 pr-2 text-[12.5px] font-semibold text-ink-3">{l}</td>
      <td className="py-1.5 pr-2 text-[13px]">{x}</td>
      <td className="py-1.5 text-[13px] font-semibold">{y}</td>
    </tr>
  );
  return (
    <div className="px-5 pb-10">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-ink-3">
            <th />
            <th className="pb-1">v{a.version}</th>
            <th className="pb-1">v{b.version}</th>
          </tr>
        </thead>
        <tbody>
          {row("Mode", MODE_COPY[a.plan.settings.mode].label, MODE_COPY[b.plan.settings.mode].label)}
          {row("Dates", rangeLabel(a.plan.dates.chosen.start, a.plan.dates.chosen.end), rangeLabel(b.plan.dates.chosen.start, b.plan.dates.chosen.end))}
          {row("Lowest", pct(a.plan.fairness.min), pct(b.plan.fairness.min))}
          {row("Median", pct(a.plan.fairness.median), pct(b.plan.fairness.median))}
          {row("Fairness", a.plan.fairness.index.toFixed(2), b.plan.fairness.index.toFixed(2))}
        </tbody>
      </table>
      <h3 className="mt-5 text-[14px] font-bold">{changes.length ? `${changes.length} slots changed` : "Every slot is the same"}</h3>
      <ul className="mt-2 space-y-1.5">
        {changes.map(({ s, old }) => (
          <li key={s.key} className="rounded-xl bg-surface-100 px-3 py-2 text-[13px] leading-snug">
            <span className="font-semibold">
              {dayLabel(s.date)} · {catalog.preset.structure.slots[s.slot].label}:
            </span>{" "}
            <span className="text-ink-3 line-through">{old ? old.items.map((i) => title(i.id)).join(" + ") : "—"}</span> → {s.items.map((i) => title(i.id)).join(" + ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
