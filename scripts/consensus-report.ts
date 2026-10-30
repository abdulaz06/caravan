// The group-plan generator on each demo crew, in every decision mode, as
// Markdown: the length trade-off and the chosen dates, the plan (day, slot,
// item, reasons) and everyone's share of their picks. Then the original
// group's shape (13 travellers, a fixed 6 days, two bases). Pure engine
// code — no database, the same output every run.
//   npx tsx --conditions=react-server scripts/consensus-report.ts > docs/CONSENSUS-DEMO.md
import { compareModes, generatePlan, MODE_COPY, protectEffect, type Ballot, type ConsensusPlan, type DecisionMode } from "@/engine/consensus";
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
    out.push("**Length vs attendance** (each length's best window; ★ = the most “people there for all of it × days”; ties go to more people there for all of it, then the suggested range, then the longer trip):", "");
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
  out.push(
    `**Mode:** ${MODE_COPY[s.mode].label} — strength ${s.strength}, λ = ${s.lambda}, may give up ${pct1(s.effectiveTolerance)} of the most popular plan's score${s.mode === "majority" ? "" : `, Protect everyone else ${plan.fairness.protect ? "on" : "off"}`}.`,
    "",
  );
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
  out.push(
    "",
    "| Traveller | Status | Days there | Picks | Free slots asked for | Could fit | In the plan | Share | vs Majority rules | Added to lift them |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  const delta = (n: number | undefined) => (s.mode === "majority" || !n ? "" : n > 0 ? `+${n}` : `−${-n}`);
  for (const p of [...plan.people].sort((a, b) => (a.satisfaction ?? -1) - (b.satisfaction ?? -1) || a.name.localeCompare(b.name))) {
    const rest = p.rest ?? { feasible: 0, made: 0 };
    out.push(
      `| ${p.name} | ${p.status} | ${p.daysThere} | ${p.picks} | ${rest.feasible ? `${rest.made} of ${rest.feasible} free` : ""} | ${p.feasible} | ${p.made.length + rest.made} | ${pct(p.satisfaction)} | ${delta(p.vsMajority)} | ${p.floorAdded || ""} |`,
    );
  }
  const f = plan.fairness;
  out.push(
    "",
    `**Lowest ${pct(f.min)} · median ${pct(f.median)} · Jain's index ${f.index.toFixed(3)}** (mean ${pct(f.mean)}).` +
      (s.mode === "majority"
        ? ""
        : ` Versus Majority rules: lowest ${pct(f.majority.min)} → ${pct(f.min)}, median ${pct(f.majority.median)} → ${pct(f.median)}, Jain's ${f.majority.index.toFixed(3)} → ${f.index.toFixed(3)}; ${f.lifted} people lifted, ${f.losers ?? 0} lost a pick (at most ${f.maxLoss ?? 0}); score ${pct(f.scoreKept)} of the most popular plan's.`) +
      (f.note ? ` *${f.note}*` : "") +
      (f.aboveNote ? ` *${f.aboveNote}*` : ""),
    "",
    `Budget ≈ $${plan.budget.perPerson[0]}–${plan.budget.perPerson[1]} per person${plan.budget.note ? ` (${plan.budget.note})` : ""}.`,
    "",
  );
  if (plan.notes.length) out.push(`Notes: ${plan.notes.join(" ")}`, "");
  return out.join("\n");
}

function compareTable(e: Engine, ballots: Ballot[], fairness: number): string {
  const rows = compareModes(e, ballots, { fairness });
  const flipped = protectEffect(e, ballots, { fairness, protect: true });
  const out = [
    "| Mode | Lowest | Median | Jain's | Picks in the plan | With none of theirs | Score vs most popular | Most anyone lost | Slots unlike Everyone gets a say |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  const row = (label: string, m: (typeof rows)[number]) =>
    `| ${label} | ${pct(m.fairness.min)} | ${pct(m.fairness.median)} | ${m.fairness.index.toFixed(3)} | ${m.picksMade} | ${m.leftOut} | ${pct(m.fairness.scoreKept)} | ${m.fairness.maxLoss ?? 0} | ${m.differs} |`;
  for (const m of rows) out.push(row(m.mode === "custom" ? `Custom (slider ${fairness})` : m.label, m));
  out.push(row("Everyone gets a say, Protect everyone else off", flipped).replace(/\| [^|]* \|$/, "| — |"));
  const t = rows[0];
  if (rows.every((m) => m.differs === 0)) out.push("", `Every mode makes the same plan here. ${t.fairness.note ?? ""}`);
  else if (rows[2].sameWhy) out.push("", `Custom matches ${rows[2].sameAs === "together" ? "Everyone gets a say" : "Majority rules"} here. ${rows[2].sameWhy}`);
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
  "Generated by `npx tsx --conditions=react-server scripts/consensus-report.ts` — the consensus generator (docs/CONSENSUS.md) on each demo trip's fictional crew, in every decision mode, with the default knobs: Everyone gets a say may give up 15% of the most popular plan's score, Protect everyone else is on (nobody ends more than one pick down on Majority rules), and Custom at the slider's halfway makes the first half of Everyone gets a say's lifts. Pure engine code: the same output every run.",
  "",
  "A traveller's **share** is what of theirs is in the plan ÷ what could fit the days they're there in the chosen window: their activity picks, plus the free slots they asked for (their stay-ins, scaled to their days here). **vs Majority rules** is picks (and free slots) gained or lost compared with the most popular plan.",
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
  lines.push("**What the fairness step uses here:** there's no K — every mode works on shares. Everyone gets a say may give up up to 15% of the most popular plan's score (and actually gives up what its lifts cost); Custom makes its slider's share of those lifts; Protect everyone else keeps everyone within one pick of Majority rules:", "");
  lines.push(
    "| Mode | Strength | λ | May give up | Lowest | Median | Jain's | Score vs most popular | People lifted | Most anyone lost |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const [mode, fairness, protect, label] of [
    ["together", 0.5, true, "Everyone gets a say"],
    ["together", 0.5, false, "Everyone gets a say, Protect off"],
    ["majority", 0.5, true, "Majority rules"],
    ["custom", 0.5, true, "Custom (slider halfway)"],
    ["custom", 1, true, "Custom (slider at fairness)"],
  ] as const) {
    const p = generatePlan(e, ballots, { mode, fairness, protect });
    const f = p.fairness;
    lines.push(
      `| ${label} | ${p.settings.strength} | ${p.settings.lambda} | ${pct1(p.settings.effectiveTolerance)} | ${pct(f.min)} | ${pct(f.median)} | ${f.index.toFixed(3)} | ${pct(f.scoreKept)} | ${f.lifted} | ${f.maxLoss ?? 0} |`,
    );
  }
  lines.push("");
  lines.push(modeSection(e, plan, "Everyone gets a say"));
}
console.log(lines.join("\n"));
