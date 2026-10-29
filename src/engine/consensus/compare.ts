// "Compare modes": the same inputs through each decision mode, side by side,
// so organizers choose knowingly. Locks and pinned dates apply to every mode.
import { generatePlan } from "./generate";
import { MODE_COPY, type Ballot, type ConsensusPlan, type DecisionMode, type FairnessStats, type PlanSettings } from "./types";

export type ModeSummary = {
  mode: DecisionMode;
  label: string;
  fairness: FairnessStats;
  /** Picks that made the plan, summed over everyone (on days they're there). */
  picksMade: number;
  /** People with none of their picks in the plan (who had any that could fit). */
  leftOut: number;
  /** Slots whose main item differs from the first mode's plan. */
  differs: number;
  /** Each slot's main item, in order (for a mini side-by-side). */
  mains: { key: string; id: string }[];
};

export function summarize(plan: ConsensusPlan, against?: ConsensusPlan): ModeSummary {
  const mains = plan.slots.map((s) => ({ key: s.key, id: s.items[0].id }));
  const ref = new Map(against?.slots.map((s) => [s.key, s.items[0].id]) ?? []);
  return {
    mode: plan.settings.mode,
    label: MODE_COPY[plan.settings.mode].label,
    fairness: plan.fairness,
    picksMade: plan.people.reduce((n, p) => n + p.made.length, 0),
    leftOut: plan.people.filter((p) => p.picks > 0 && p.daysThere > 0 && p.made.length === 0).length,
    differs: against ? mains.filter((m) => ref.get(m.key) !== m.id).length : 0,
    mains,
  };
}

/** Everyone gets a say, Majority rules and Custom (at the current slider), on the same inputs. */
export function compareModes(...args: [Parameters<typeof generatePlan>[0], Ballot[], Partial<PlanSettings>]): ModeSummary[] {
  const [e, ballots, settings] = args;
  const modes: DecisionMode[] = ["together", "majority", "custom"];
  const plans = modes.map((mode) => generatePlan(e, ballots, { ...settings, mode }));
  return plans.map((p) => summarize(p, plans[0]));
}
