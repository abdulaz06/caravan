// The group-plan generator on each demo crew, in every decision mode, as
// Markdown: the length trade-off and the chosen dates, the plan (day, slot,
// item, reasons) and everyone's share of their picks. Then the original
// group's shape (13 travellers, a fixed 6 days, two bases). Pure engine
// code — no database, the same output every run.
//   npx tsx --conditions=react-server scripts/consensus-report.ts > docs/CONSENSUS-DEMO.md
import { compareModes, generatePlan, MODE_COPY, type Ballot, type ConsensusPlan, type DecisionMode } from "@/engine/consensus";
import { emptyItinerary, normalize, setStart, STAY_ID } from "@/engine/itinerary";
import { quickFill } from "@/engine/quickfill";
import { defaultRules } from "@/engine/rules";
import { createEngine, tripDays, type Engine } from "@/engine/structure";
import { addDays, dayLabel, rangeLabel } from "@/lib/dates";
import { demoBallots, demoById } from "@/lib/demo-crew";
import { loadPreset } from "@/presets/registry";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const pct1 = (x: number) => `${Math.round(x * 1000) / 10}%`;
const cell = (s: string) => s.replace(/\|/g, "\\|");

function datesSection(plan: ConsensusPlan, names: Map<string, string>): string {
  const out: string[] = [];
  const d = plan.dates;
  if (d.lengths.length) {
    out.push("**Length vs attendance** (each length's best window; ★ = the most “people there for all of it × days”, never below the suggested minimum):", "");
    out.push("| Length | Can do it all | × days | Person-days | Best window |", "|---|---|---|---|---|");
    for (const o of d.lengths) if (o.full > 0 || o.recommended) out.push(`| ${o.length === 1 ? "1 day" : `${o.length} days`}${o.recommended ? " ★" : ""} | ${o.full} of ${d.withDates} | ${o.full * o.length} | ${o.personDays} | ${rangeLabel(o.start, o.end)} |`);
    out.push("");
  }
  out.push(`**Dates:** ${rangeLabel(d.chosen.start, d.chosen.end)} · ${d.length} days — ${d.lengthReason.toLowerCase()} · ${d.chosen.full} of ${d.withDates} free for all of it, ${d.chosen.personDays} person-days.`, "");
  if (d.chosen.missing.length) out.push(`Missing days: ${d.chosen.missing.map((m) => `${names.get(m.id)} ${m.days.length}`).join(", ")}.`, "");
  if (d.runnersUp.length) {
    out.push("Runners-up at this length:", "");
    for (const w of d.runnersUp) out.push(`- ${rangeLabel(w.start, w.end)} — ${w.full} free throughout, ${w.personDays} person-days; misses: ${w.missing.map((m) => `${names.get(m.id)} ${m.days.length}`).join(", ") || "nobody"}`);
    out.push("");
  }
  return out.join("\n");
}

function modeSection(e: Engine, plan: ConsensusPlan, title: string): string {
  const out: string[] = [];
  const { catalog } = e;
  const name = (id: string) => (id === STAY_ID ? "Free time / stay in" : (catalog.byId[id]?.title ?? id));
  const s = plan.settings;
  out.push(`### ${title}`, "");
  out.push(`**Mode:** ${MODE_COPY[s.mode].label} — strength ${s.strength}, λ = ${s.lambda}, may give up ${pct1(s.effectiveTolerance)} of the most popular plan's score.`, "");
  out.push("| Day | Slot | Item | Reasons | Runner-up |", "|---|---|---|---|---|");
  for (const sl of plan.slots) {
    sl.items.forEach((it, i) => {
      const reasons = it.reasons.map((r) => r.text).join(" · ");
      const lift = it.floorFor.length ? ` (lifts ${it.floorFor.join(", ")})` : "";
      out.push(
        `| ${i === 0 ? `${sl.day + 1} · ${dayLabel(sl.date)}` : ""} | ${i === 0 ? catalog.preset.structure.slots[sl.slot].label : "+ extra"} | ${cell(name(it.id))}${it.variant ? ` (${it.variant})` : ""} | ${cell(reasons + lift)} | ${it.runnerUp ? `${cell(name(it.runnerUp.id))} (${it.runnerUp.votes})` : ""} |`,
      );
    });
    if (sl.split) out.push(`| | | ↳ split ${sl.split.status}: ${sl.split.a.votes} ${cell(name(sl.split.a.id))} / ${sl.split.b.votes} ${cell(name(sl.split.b.id))} | ${sl.split.both} picked both | |`);
  }
  out.push("", "| Traveller | Status | Days there | Picks | Could fit | In the plan | Share | Added to lift them |", "|---|---|---|---|---|---|---|---|");
  for (const p of [...plan.people].sort((a, b) => (a.satisfaction ?? -1) - (b.satisfaction ?? -1) || a.name.localeCompare(b.name))) {
    out.push(`| ${p.name} | ${p.status} | ${p.daysThere} | ${p.picks} | ${p.feasible} | ${p.made.length} | ${pct(p.satisfaction)} | ${p.floorAdded || ""} |`);
  }
  const f = plan.fairness;
  out.push(
    "",
    `**Lowest ${pct(f.min)} · median ${pct(f.median)} · Jain's index ${f.index.toFixed(3)}** (mean ${pct(f.mean)}).` +
      (s.mode === "majority"
        ? ""
        : ` Versus Majority rules: lowest ${pct(f.majority.min)} → ${pct(f.min)}, median ${pct(f.majority.median)} → ${pct(f.median)}, Jain's ${f.majority.index.toFixed(3)} → ${f.index.toFixed(3)}; ${f.lifted} people lifted; score ${pct(f.scoreKept)} of the most popular plan's.`) +
      (f.note ? ` *${f.note}*` : ""),
    "",
    `Budget ≈ $${plan.budget.perPerson[0]}–${plan.budget.perPerson[1]} per person${plan.budget.note ? ` (${plan.budget.note})` : ""}.`,
    "",
  );
  if (plan.notes.length) out.push(`Notes: ${plan.notes.join(" ")}`, "");
  return out.join("\n");
}

function compareTable(e: Engine, ballots: Ballot[], fairness: number): string {
  const rows = compareModes(e, ballots, { fairness });
  const out = ["| Mode | Lowest | Median | Jain's | Picks in the plan | With none of theirs | Score vs most popular | Slots unlike Everyone gets a say |", "|---|---|---|---|---|---|---|---|"];
  for (const m of rows) {
    const label = m.mode === "custom" ? `Custom (slider ${fairness})` : m.label;
    out.push(`| ${label} | ${pct(m.fairness.min)} | ${pct(m.fairness.median)} | ${m.fairness.index.toFixed(3)} | ${m.picksMade} | ${m.leftOut} | ${pct(m.fairness.scoreKept)} | ${m.differs} |`);
  }
  const t = rows[0];
  if (rows.every((m) => m.differs === 0)) out.push("", `Every mode makes the same plan here. ${t.fairness.note ?? ""}`);
  return out.join("\n") + "\n";
}

/** Fictional travellers on a fixed-length trip: a seeded quick fill each, on staggered windows. */
function fixedCrew(e: Engine, count: number): Ballot[] {
  let s = 2027;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const len = tripDays(e);
  return Array.from({ length: count }, (_, k) => {
    const start = addDays("2026-12-26", Math.floor(rng() * 4));
    const d = quickFill(e, setStart(e, emptyItinerary(), start, len), { rng });
    return { id: `t${String(k).padStart(2, "0")}`, name: `Traveller ${k + 1}`, status: k < 11 ? "submitted" : "draft", data: normalize(e, d) } as Ballot;
  });
}

const lines = [
  "# The group plan on the demo crews",
  "",
  "Generated by `npx tsx --conditions=react-server scripts/consensus-report.ts` — the consensus generator (docs/CONSENSUS.md) on each demo trip's fictional crew, in every decision mode, with the default knobs (Everyone gets a say may give up 15% of the most popular plan's score; Custom at the slider's halfway gives up 7.5%). Pure engine code: the same output every run.",
  "",
  "A traveller's **share** is the picks of theirs in the plan ÷ their picks that could fit the days they're there in the chosen window.",
  "",
];
for (const id of ["sri-lanka", "georgia"]) {
  const { preset, catalog } = loadPreset(id);
  const e = createEngine(catalog, defaultRules(preset));
  const ballots = demoBallots(e, demoById(id)!);
  lines.push(`## ${preset.name} — ${ballots.length} travellers (${ballots.filter((b) => b.status === "submitted").length} submitted)`, "");
  const first = generatePlan(e, ballots, { mode: "together" });
  lines.push(datesSection(first, new Map(first.people.map((p) => [p.id, p.name]))));
  lines.push("**The three modes side by side:**", "", compareTable(e, ballots, 0.5));
  const modes: [DecisionMode, number, string][] = [
    ["together", 0.5, "Everyone gets a say"],
    ["majority", 0.5, "Majority rules"],
    ["custom", 0.5, "Custom — slider halfway"],
  ];
  for (const [mode, fairness, title] of modes) lines.push(modeSection(e, generatePlan(e, ballots, { mode, fairness }), title));
}

{
  const { preset, catalog } = loadPreset("sri-lanka");
  const e = createEngine(catalog, { ...defaultRules(preset), fixedLength: true });
  const ballots = fixedCrew(e, 13);
  lines.push(
    `## The original group's shape — 13 travellers, a fixed ${tripDays(e)} days, two bases`,
    "",
    "Thirteen fictional travellers (11 submitted, 2 drafts), each a seeded quick fill on Sri Lanka with **Fixed trip length** on, starting 26–29 Dec. With a fixed length there's no length trade-off: only the window is chosen.",
    "",
  );
  const plan = generatePlan(e, ballots, { mode: "together" });
  lines.push(datesSection(plan, new Map(plan.people.map((p) => [p.id, p.name]))));
  lines.push("**What the fairness step uses here:** there's no K any more — every mode works on shares, and the knob is how much popularity it may give up:", "");
  lines.push("| Mode | Strength | λ | May give up | Lowest | Median | Jain's | Score vs most popular | People lifted |", "|---|---|---|---|---|---|---|---|---|");
  for (const [mode, fairness, label] of [
    ["together", 0.5, "Everyone gets a say"],
    ["majority", 0.5, "Majority rules"],
    ["custom", 0.5, "Custom (slider halfway)"],
    ["custom", 1, "Custom (slider at fairness)"],
  ] as const) {
    const p = generatePlan(e, ballots, { mode, fairness });
    const f = p.fairness;
    lines.push(`| ${label} | ${p.settings.strength} | ${p.settings.lambda} | ${pct1(p.settings.effectiveTolerance)} | ${pct(f.min)} | ${pct(f.median)} | ${f.index.toFixed(3)} | ${pct(f.scoreKept)} | ${f.lifted} |`);
  }
  lines.push("");
  lines.push(modeSection(e, plan, "Everyone gets a say"));
}
console.log(lines.join("\n"));
