"use client";

import { motion } from "framer-motion";
import { BedDouble, Check, ChevronRight, Pencil, Wallet } from "lucide-react";
import type { BudgetResult, Verdict } from "@/engine/budget";
import { cn } from "@/lib/cn";
import { useCurrency } from "../currency";
import { useCatalog } from "../engine";
import { Sheet } from "../ui/sheet";

type PanelProps = {
  budget: BudgetResult;
  locked: boolean;
  onToggleLine: (id: string, include: boolean) => void;
  onToggleAccommodation: (on: boolean) => void;
  onEditBudget: () => void;
};

const VERDICT_STYLE: Record<Verdict["kind"], string> = {
  within: "bg-secondary-100 text-secondary-700",
  under: "bg-primary-100 text-primary-800",
  near: "bg-highlight-200 text-ink",
  over: "bg-accent-100 text-accent-700",
  none: "bg-surface-200 text-ink-2",
};

export function VerdictChip({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold", VERDICT_STYLE[verdict.kind], className)}>
      {verdict.text}
    </span>
  );
}

/** Compact pill for the sticky header card on mobile. */
export function BudgetPill({ budget, onOpen, className }: { budget: BudgetResult; onOpen: () => void; className?: string }) {
  const { range } = useCurrency();
  const amount = range(budget.total);
  const long = amount.length > 13;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl bg-surface-100 px-2.5 py-1.5 text-left transition hover:bg-surface-200 min-[1360px]:hidden",
        className,
      )}
      aria-label="Open trip budget"
    >
      <Wallet className="size-4 shrink-0 text-primary-600" />
      {!long && <span className="text-[12.5px] font-semibold text-ink-2">Budget</span>}
      <span className={cn("whitespace-nowrap font-bold tabular-nums", long ? "text-[12.5px]" : "text-[13px]")}>≈ {amount}</span>
      <span className="text-[11px] font-semibold text-ink-3">pp</span>
      <span
        className={cn(
          "ml-auto truncate rounded-full px-2 py-0.5 text-[11px] font-bold",
          VERDICT_STYLE[budget.verdict.kind],
        )}
      >
        {budget.verdict.kind === "none" ? (long ? "Set budget" : "Set a budget") : budget.verdict.text}
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

/** The full checklist. Used in the mobile sheet and the desktop side panel. */
export function BudgetPanel({ budget, locked, onToggleLine, onToggleAccommodation, onEditBudget }: PanelProps) {
  const { range, money, rateNote } = useCurrency();
  const { preset } = useCatalog();
  const { costs, travel } = preset;
  const tierText = budget.tier
    ? `Your budget: ${range(budget.tier.bounds)} per person`
    : null;
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[24px] bg-primary-800 p-4 text-paper">
        <div className="sunburst absolute inset-0 opacity-70" />
        <div className="relative">
          <p className="label text-highlight-400">Estimated total · per person</p>
          <p
            className={cn(
              "font-display mt-1 font-semibold leading-none tracking-[-0.02em] tabular-nums",
              range(budget.total).length > 14 ? "text-[26px]" : "text-[34px]",
            )}
          >
            ≈ {range(budget.total)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VerdictChip verdict={budget.verdict} />
            {tierText && <span className="text-[12px] text-paper/70">{tierText}</span>}
          </div>
          <p className="mt-3 text-[11.5px] leading-snug text-paper/60">
            Excludes flights · estimates only · ≈ {rateNote}
          </p>
          {!locked && (
            <button
              onClick={onEditBudget}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-highlight-400 hover:underline"
            >
              <Pencil className="size-3" /> {budget.tier ? "Change your budget" : "Set your budget"}
            </button>
          )}
        </div>
      </section>

      <label
        className={cn(
          "flex items-center gap-3 rounded-2xl bg-paper p-3 shadow-card",
          locked ? "opacity-70" : "cursor-pointer",
        )}
      >
        <BedDouble className="size-5 shrink-0 text-primary-600" />
        <span className="flex-1">
          <span className="block text-[14px] font-semibold">Include places to stay</span>
          <span className="text-[12px] text-ink-3">
            {budget.accommodation.styleLabel} · {budget.accommodation.nights.reduce((n, b) => n + b.nights, 0)} nights
          </span>
        </span>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={budget.accommodation.on}
          disabled={locked}
          onChange={(e) => onToggleAccommodation(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-highlight-500",
            budget.accommodation.on ? "bg-primary-600" : "bg-surface-300",
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 600, damping: 34 }}
            className={cn("absolute top-1 size-5 rounded-full bg-paper shadow", budget.accommodation.on ? "right-1" : "left-1")}
          />
        </span>
      </label>

      {budget.groups.length === 0 && (
        <p className="rounded-2xl bg-surface-100 p-4 text-[14px] text-ink-2">Pick some days and the costs show up here.</p>
      )}

      {budget.groups.map((g) => (
        <section key={g.id} className="rounded-2xl bg-paper p-3 shadow-card">
          <div className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
            <h3 className="font-display text-[17px] font-semibold">{g.title}</h3>
            {g.subtitle && <span className="truncate text-[12px] text-ink-3">{g.subtitle}</span>}
          </div>
          <ul className="divide-y divide-ink/5">
            {g.lines.map((l) => (
              <li key={l.id}>
                <label className={cn("flex items-start gap-2.5 px-1 py-2", !locked && "cursor-pointer")}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={l.included}
                    disabled={locked}
                    onChange={(e) => onToggleLine(l.id, e.target.checked)}
                    aria-label={`Include ${l.label}`}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-highlight-500",
                      l.included ? "border-primary-600 bg-primary-600 text-white" : "border-surface-300 bg-paper",
                    )}
                  >
                    {l.included && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                  <span className={cn("min-w-0 flex-1", !l.included && "opacity-50")}>
                    <span className={cn("block text-[13.5px] font-semibold leading-snug", !l.included && "line-through")}>
                      {l.label}
                    </span>
                    {l.detail && <span className="block text-[11.5px] leading-snug text-ink-3">{l.detail}</span>}
                  </span>
                  <span className={cn("shrink-0 pt-0.5 text-[13px] font-bold tabular-nums", !l.included && "text-ink-3 line-through")}>
                    {l.range[1] === 0 ? "Free" : range(l.range)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-1 text-[11.5px] leading-snug text-ink-3">
        Transport is split across {costs.vehicles} {travel.selfDrive ? "" : "shared "}
        {travel.vehicle}s for a group of {costs.groupSize}. Untick anything you&apos;d skip or that
        someone else covers. Activity prices are rough per-person ranges; your picks set the total, not a
        quote (≈ {money(1)} = 1 USD).
      </p>
    </div>
  );
}

export function BudgetSheet({ open, onClose, ...props }: PanelProps & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Per person · excl. flights" title="Trip budget">
      <div className="px-4 pb-10">
        <BudgetPanel {...props} />
      </div>
    </Sheet>
  );
}

/** Desktop: a docked panel beside the phone-width column. */
export function BudgetSidePanel(props: PanelProps) {
  return (
    <aside
      aria-label="Trip budget"
      className="fixed bottom-6 right-[504px] top-6 z-30 hidden w-[372px] flex-col overflow-hidden rounded-[28px] bg-surface-50/95 shadow-lift ring-1 ring-white/40 backdrop-blur-xl min-[1360px]:flex"
    >
      <div className="flex items-center gap-2 px-5 pb-2 pt-5">
        <Wallet className="size-5 text-primary-600" />
        <h2 className="font-display text-[22px] font-semibold">Trip budget</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <BudgetPanel {...props} />
      </div>
    </aside>
  );
}
