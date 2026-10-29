import type { Metadata } from "next";
import { CaseStudy, type CaseStudyStats, type ConsensusExample } from "@/components/caravan/case-study";
import { STAY_ID } from "@/engine/itinerary";
import { compareModes, generatePlan, MODE_COPY } from "@/engine/consensus";
import { defaultRules } from "@/engine/rules";
import { createEngine } from "@/engine/structure";
import { dayLabel, rangeLabel } from "@/lib/dates";
import { demoBallots, demoById } from "@/lib/demo-crew";
import { loadPreset } from "@/presets/registry";
import stats from "../../../content/case-study-stats.json";

const title = "Case study · Planning a group trip without the group chat";
const description =
  "How 13 friends planned a trip on Caravan — 8 full plans in a week — and what it took: the problem, design decisions, the group-plan generator, architecture and the hard parts.";

// The link preview is its own image (opengraph-image.jpg next to this page,
// from scripts/make-brand-assets.mjs) so a shared link reads as the case study.
export const metadata: Metadata = {
  title: "Case study",
  description,
  openGraph: { title, description, type: "article", siteName: "Caravan" },
  twitter: { card: "summary_large_image", title, description },
};

/** The generator run on the Sri Lanka demo crew (pure engine code, so it's worked out once at build time). */
function consensusExample(): ConsensusExample {
  const { preset, catalog } = loadPreset("sri-lanka");
  const e = createEngine(catalog, defaultRules(preset));
  const ballots = demoBallots(e, demoById("sri-lanka")!);
  const plan = generatePlan(e, ballots, { mode: "together" });
  const modes = compareModes(e, ballots, { fairness: 1 });
  const fullPlans = new Map(modes.map((m) => [m.mode, m]));
  // A few picks whose reasons tell the story: a weekday-only option, NYE, a fair-floor pick, a big vote.
  const want = ["special", "weekday", "fair", "votes"] as const;
  const items: ConsensusExample["items"] = [];
  for (const kind of want) {
    for (const s of plan.slots) {
      const it = s.items.find((x) => x.id !== STAY_ID && x.reasons.some((r) => r.kind === kind) && !items.some((y) => y.title === catalog.byId[x.id]?.title));
      if (!it) continue;
      items.push({
        when: `${dayLabel(s.date)} · ${preset.structure.slots[s.slot].label}`,
        title: catalog.byId[it.id]?.title ?? it.id,
        reasons: it.reasons.map((r) => r.text).slice(0, 3),
      });
      break;
    }
  }
  return {
    people: ballots.length,
    dates: {
      chosen: rangeLabel(plan.dates.chosen.start, plan.dates.chosen.end),
      length: plan.dates.length,
      full: plan.dates.chosen.full,
      of: plan.dates.withDates,
      runnersUp: plan.dates.runnersUp.slice(0, 2).map((w) => ({ range: rangeLabel(w.start, w.end), full: w.full })),
    },
    modes: (["together", "majority", "custom"] as const).map((m) => {
      const s = fullPlans.get(m)!;
      return { label: m === "custom" ? "Custom · fairest" : MODE_COPY[m].label, min: s.fairness.min, median: s.fairness.median, index: s.fairness.index, leftOut: s.leftOut, differs: s.differs };
    }),
    items,
  };
}

export default function CaseStudyPage() {
  return <CaseStudy stats={stats as CaseStudyStats} consensus={consensusExample()} />;
}
