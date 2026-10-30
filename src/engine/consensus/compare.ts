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
  /** Slots whose items (main or extras) differ from the first mode's plan. */
  differs: number;
  /** Each slot's main item, in order (for a mini side-by-side). */
  mains: { key: string; id: string }[];
  /** Another mode that makes exactly this plan (Custom only), and why, in plain words. */
  sameAs?: DecisionMode | null;
  sameWhy?: string | null;
};

const signature = (plan: ConsensusPlan) => plan.slots.map((s) => `${s.key}=${s.items.map((x) => x.id).join("+")}`).join("|");

export function summarize(plan: ConsensusPlan, against?: ConsensusPlan): ModeSummary {
  const mains = plan.slots.map((s) => ({ key: s.key, id: s.items[0].id }));
  const ids = (s: ConsensusPlan["slots"][number]) => s.items.map((x) => x.id).join("+");
  const ref = new Map(against?.slots.map((s) => [s.key, ids(s)]) ?? []);
  return {
    mode: plan.settings.mode,
    label: MODE_COPY[plan.settings.mode].label,
    fairness: plan.fairness,
    picksMade: plan.people.reduce((n, p) => n + p.made.length, 0),
    // Someone whose picks could fit their days, but none made it (not someone who's away).
    leftOut: plan.people.filter((p) => p.satisfaction !== null && p.made.length === 0).length,
    differs: against ? plan.slots.filter((s) => ref.get(s.key) !== ids(s)).length : 0,
    mains,
  };
}

/** Everyone gets a say, Majority rules and Custom (at the current slider), on the same inputs. */
export function compareModes(...args: [Parameters<typeof generatePlan>[0], Ballot[], Partial<PlanSettings>]): ModeSummary[] {
  const [e, ballots, settings] = args;
  const modes: DecisionMode[] = ["together", "majority", "custom"];
  const plans = modes.map((mode) => generatePlan(e, ballots, { ...settings, mode }));
  const out = plans.map((p) => summarize(p, plans[0]));
  // When Custom lands on one of the other two, say so — and why.
  const [together, majority, custom] = plans;
  const lifts = together.fairness.steps?.length ?? 0;
  const c = out[2];
  if (signature(custom) === signature(together)) {
    c.sameAs = "together";
    c.sameWhy =
      signature(together) === signature(majority)
        ? "All three make the same plan: there was nothing to lift."
        : lifts <= 1
          ? "Everyone gets a say needed just one lift, and at this slider Custom makes it too."
          : "At this slider Custom makes all of Everyone gets a say's lifts.";
  } else if (signature(custom) === signature(majority)) {
    c.sameAs = "majority";
    c.sameWhy = lifts
      ? `Everyone gets a say made ${lifts === 1 ? "one lift" : `${lifts} lifts`}; at this slider Custom makes none of them — slide towards fairness to see them.`
      : "There was nothing to lift, so Custom stays with the most popular plan.";
  }
  return out;
}

/** Everyone gets a say with "Protect everyone else" switched the other way: what the guard holds back (or would). */
export function protectEffect(e: Parameters<typeof generatePlan>[0], ballots: Ballot[], settings: Partial<PlanSettings>): ModeSummary {
  const protect = settings.protect ?? true;
  return summarize(generatePlan(e, ballots, { ...settings, mode: "together", protect: !protect }));
}
