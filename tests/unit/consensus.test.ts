import { describe, expect, it } from "vitest";
import { compareModes, generatePlan, isBigTrip, isMeal, itemKey, lengthOptions, medianLength, modeParams, pickWindows, protectEffect, recommendLength, type Ballot, type ConsensusPlan } from "@/engine/consensus";
import { STAY_ID, emptyItinerary, isSpecialOption, makeItem, normalize, setStart, type ItineraryData } from "@/engine/itinerary";
import { quickFill } from "@/engine/quickfill";
import { isRouteArea, planDays, tripDays, type Engine } from "@/engine/structure";
import { buildTimeline, homeRegion } from "@/engine/timeline";
import { addDays, parseISO } from "@/lib/dates";
import { demoBallots, demoById } from "@/lib/demo-crew";
import { engineFor, mini, readPreset, seeded, sriLanka } from "./helpers";

const georgia = (rules = {}) => engineFor(readPreset("georgia"), rules);

/** A ballot from explicit picks: `slots` maps day index → [daytime ids, evening ids]. */
function ballot(e: Engine, id: string, start: string, length: number, slots: Record<number, [string[], string[]]>, status: Ballot["status"] = "submitted"): Ballot {
  const d = setStart(e, emptyItinerary(), start, length);
  for (const [i, [day, night]] of Object.entries(slots)) {
    d.days[Number(i)].day = day.map((x) => makeItem(e, x));
    d.days[Number(i)].night = night.map((x) => makeItem(e, x));
  }
  return { id, name: id, status, data: normalize(e, d) };
}

/** Random but valid plans: a seeded quick fill on random dates and lengths inside the rules. */
function randomBallots(e: Engine, count: number, seed: number): Ballot[] {
  const rng = seeded(seed);
  const win = e.rules.window;
  const out: Ballot[] = [];
  for (let k = 0; k < count; k++) {
    const len = 1 + Math.floor(rng() * 14);
    const start = addDays(win.start, 15 + Math.floor(rng() * 30));
    let d = setStart(e, emptyItinerary(), start, len);
    d = quickFill(e, d, { rng });
    if (rng() < 0.3) d.days = d.days.map((x, i) => (i % 2 ? { ...x, night: [makeItem(e, STAY_ID)] } : x));
    out.push({ id: `p${String(k).padStart(2, "0")}`, name: `Traveller ${k}`, status: rng() < 0.75 ? "submitted" : "draft", data: normalize(e, d) });
  }
  return out;
}

const ids = (p: ConsensusPlan) => p.slots.flatMap((s) => s.items.map((i) => i.id));

/** Every rule the trip enforces, checked on a generated plan. */
function assertValid(e: Engine, p: ConsensusPlan, ballots?: Ballot[]) {
  const data = p.itinerary;
  const plans = planDays(e, p.dates.length);
  const { catalog } = e;
  const radius = catalog.preset.structure.extraRadiusHours;
  const landing = catalog.legs[catalog.preset.structure.arrival.leg]?.from;
  const near = (a: string, b: string) => catalog.travelHours(a, b) <= radius;
  const mealish = (id: string) => {
    const a = catalog.byId[id];
    return !!a && (isMeal(a) || (!!a.familySwap && !!catalog.byId[a.familySwap] && isMeal(catalog.byId[a.familySwap])));
  };
  const timeline = buildTimeline(e, data);
  // No plan scores above the most popular one — or it says why.
  if (p.fairness.scoreKept > 1 + 1e-9) expect(p.fairness.aboveNote).toBeTruthy();
  // "Protect everyone else": nobody ends more than one pick down on Majority rules.
  if (p.fairness.protect) for (const person of p.people) expect(person.vsMajority ?? 0).toBeGreaterThanOrEqual(-1);
  const thereOn = (date: string) => (ballots ?? []).filter((b) => !b.data.startDate || !b.data.endDate || (date >= b.data.startDate && date <= b.data.endDate)).length;
  expect(data.days).toHaveLength(p.dates.length);
  expect(data.startDate! >= e.rules.window.start && data.endDate! <= e.rules.window.end).toBe(true);
  // Nothing the trip's own validation would drop: pools, special dates, big day trips, extras with their trip.
  expect(normalize(e, data, data.days.length)).toEqual(data);
  // No duplicates (stay-in can repeat), split alternatives included.
  const placed = [...ids(p), ...p.slots.flatMap((s) => (s.split?.status === "accepted" ? [s.split.b.id] : []))].filter((x) => x !== STAY_ID);
  expect(new Set(placed).size).toBe(placed.length);
  for (const s of p.slots) {
    const plan = plans[s.day];
    expect(plan.areas[s.slot]).toBe(s.area);
    expect(s.items.length).toBeGreaterThan(0);
    for (const it of s.items) {
      const a = e.catalog.byId[it.id];
      if (!a) continue;
      // A big day trip is only ever the day's main item.
      if (it.role === "extra") expect(a.onlyBaseDays || a.tags.includes("big day trip")).toBeFalsy();
      // Day-of-week availability.
      if (a.availableDays) expect(a.availableDays).toContain(parseISO(s.date).getUTCDay());
      expect(e.rules.hidden).not.toContain(it.id);
    }
    // A special date's slot holds its special option first.
    if (s.special) expect(s.items[0].id === STAY_ID || isSpecialOption(e, s.items[0].id)).toBe(true);
    // Never a split on a moving day or a special date.
    if (s.split) expect(plan.kind === "base" && !plan.arrival && !plan.departs && !s.special).toBe(true);
    // At most one main meal in a slot (in family-friendly view too).
    expect(s.items.filter((it) => mealish(it.id)).length).toBeLessThanOrEqual(1);
    const acts = s.items.filter((it) => it.id !== STAY_ID).map((it) => ({ it, a: catalog.byId[it.id] }));
    // A transfer day's evening only draws from the base you've arrived at.
    if (plan.kind === "transfer" && s.slot === "night") for (const { a } of acts) expect(a.areas).toContain(plan.base.area);
    // Landing day stays close to the base or the airport.
    if (plan.arrival && !isRouteArea(e, s.area)) for (const { a } of acts) expect(near(homeRegion(e, s.area), a.region) || (!!landing && near(landing, a.region))).toBe(true);
    // Extras are close to the main item (or to the base, when the main item is close too) and never a big day trip.
    const main = s.items[0].id === STAY_ID ? null : catalog.byId[s.items[0].id];
    for (const { it, a } of acts) {
      if (it.role !== "extra") continue;
      expect(isBigTrip(a)).toBe(false);
      if (a.onlyWith || isRouteArea(e, s.area)) continue;
      const away = !!main && (isBigTrip(main) || !near(plan.base.region, main.region));
      expect((!!main && near(main.region, a.region)) || (!away && near(plan.base.region, a.region))).toBe(true);
    }
    // A slot that carries extras fits its time — the trip's own timeline agrees (road legs and hops included).
    if (s.items.some((it) => it.role === "extra" && !catalog.byId[it.id]?.onlyWith)) expect(timeline.days[s.day][s.slot].overpacked, `${s.key} ${s.items.map((x) => x.id).join("+")} ${timeline.days[s.day][s.slot].plannedHours}`).toBe(false);
    // Two of the same kind in one slot only when at least half of those there picked one of them.
    if (ballots) {
      const need = Math.ceil(0.5 * thereOn(s.date));
      acts.forEach(({ it, a }, k) => {
        for (const other of acts.slice(0, k)) if (other.a.categories[0] === a.categories[0]) expect(Math.max(it.present, other.it.present)).toBeGreaterThanOrEqual(need);
      });
    }
  }
  // Never a late night right before a very early day trip.
  data.days.forEach((d, i) => {
    const trip = d.day.map((x) => e.catalog.byId[x.id]).find((a) => a?.variants);
    const v = trip?.variants?.find((x) => x.id === d.day.find((y) => y.id === trip.id)?.variant);
    if (!v?.eveBefore || i === 0) return;
    const late = data.days[i - 1].night.map((x) => e.catalog.byId[x.id]).filter((a) => a && (a.vibe >= 2 || e.catalog.isNightlife(a)));
    expect(late).toEqual([]);
  });
  // The fly-home day has no slots; a same-day trip has no evening.
  plans.forEach((pl, i) => {
    if (!pl.hasSlots) expect(data.days[i].day.length + data.days[i].night.length).toBe(0);
    if (!pl.areas.night) expect(data.days[i].night).toEqual([]);
  });
}

describe("dates", () => {
  it("the window: who's free for all of it, then person-days; runners-up are real alternatives", () => {
    expect(medianLength([5, 6, 6, 7, 7, 8, 10, 11])).toBe(7);
    expect(medianLength([])).toBeNull();
    const people = [
      { id: "a", start: "2026-12-27", end: "2027-01-03" },
      { id: "b", start: "2026-12-26", end: "2027-01-01" },
      { id: "c", start: "2026-12-27", end: "2027-01-02" },
    ];
    const { best, runnersUp } = pickWindows(people, { start: "2026-12-01", end: "2027-01-31" }, 6);
    expect(best).toMatchObject({ start: "2026-12-27", end: "2027-01-01", full: 3 });
    expect(runnersUp.length).toBeGreaterThan(0);
    for (const w of runnersUp) expect(Math.abs(Date.parse(w.start) - Date.parse(best!.start))).toBeGreaterThanOrEqual(2 * 86_400_000);
    expect(runnersUp[0].missing.length).toBeGreaterThan(0);
  });

  // Five travellers: everyone can do 4 days, four can do 5, three 6, two 7.
  const crew = [
    { id: "a", start: "2026-12-26", end: "2027-01-03" },
    { id: "b", start: "2026-12-27", end: "2027-01-01" },
    { id: "c", start: "2026-12-27", end: "2026-12-31" },
    { id: "d", start: "2026-12-28", end: "2026-12-31" },
    { id: "e", start: "2026-12-27", end: "2027-01-02" },
  ];
  const bounds = { start: "2026-12-01", end: "2027-01-31" };

  it("each length's best window, and the length with the most people there for all of it × days", () => {
    const opts = lengthOptions(crew, bounds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(opts.find((o) => o.length === 4)).toMatchObject({ full: 5, start: "2026-12-28", end: "2026-12-31" });
    expect(opts.find((o) => o.length === 5)).toMatchObject({ full: 4, start: "2026-12-27" });
    expect(opts.find((o) => o.length === 6)).toMatchObject({ full: 3, start: "2026-12-27", end: "2027-01-01" });
    expect(opts.find((o) => o.length === 7)).toMatchObject({ full: 2 });
    // 4 × 5 = 20 = 5 × 4: the tie goes to more people there for all of it — even when the suggested range says 5–7.
    expect(recommendLength(opts)!.length).toBe(4);
    expect(recommendLength(opts, { min: 5, max: 7 })!.length).toBe(4);
    expect(recommendLength(opts.map((o) => ({ ...o, full: 0 })))).toBeNull();
  });

  it("ties: more people there for all of it, then the suggested range, then the longer trip", () => {
    const o = (length: number, full: number) => ({ length, full, start: "2026-12-27", end: "2026-12-27", personDays: full * length });
    // Georgia's case: 6 × 6 = 36 beats 8 × 4 = 32, whatever the suggested range (a hint, never a limit).
    expect(recommendLength([o(6, 6), o(7, 4), o(8, 4)], { min: 7, max: 10 })!.length).toBe(6);
    // Equal people × days: more people first.
    expect(recommendLength([o(4, 6), o(6, 4), o(8, 3)])!.length).toBe(4);
    // The range and then the longer trip only ever split options with the same people × days and the same people —
    // which, in a real table, is the same length; the order still holds for hand-made options.
    expect(recommendLength([o(4, 6), { ...o(4, 6), length: 7, start: "2026-12-28" }], { min: 7, max: 10 })!.length).toBe(7);
    expect(recommendLength([o(4, 6), { ...o(4, 6), length: 5 }])!.length).toBe(5);
  });

  it("the plan uses the recommended length, unless the organizers pick one or the length is fixed", () => {
    const e = sriLanka(); // suggested 5–7 days
    const ballots = crew.map((c) => ({ ...ballot(e, c.id, c.start, 1, {}), data: normalize(e, setStart(e, emptyItinerary(), c.start, Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86_400_000) + 1)) }));
    const p = generatePlan(e, ballots, { mode: "majority" });
    // 4 days (all 5 there) ties 5 days (4 there) on people × days; more people wins, below the suggested 5–7.
    expect(p.dates).toMatchObject({ length: 4, chosen: { start: "2026-12-28", full: 5 } });
    expect(p.dates.lengthReason).toBe("The best balance of days and full attendance");
    expect(p.dates.lengths.filter((o) => o.recommended).map((o) => o.length)).toEqual([4]);
    expect(p.dates.lengths.map((o) => o.length)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const chosen = generatePlan(e, ballots, { mode: "majority", length: 7 });
    expect(chosen.dates).toMatchObject({ length: 7, lengthReason: "Chosen by the organizers", chosen: { full: 2 } });
    const fixed = generatePlan(sriLanka({ fixedLength: true }), ballots, { mode: "majority" });
    expect(fixed.dates).toMatchObject({ length: tripDays(sriLanka({ fixedLength: true })), lengthReason: "The trip's fixed length", lengths: [] });
  });

  it("uses the fixed length when that rule is on, and a pinned window when given", () => {
    const e = sriLanka({ fixedLength: true });
    const p = generatePlan(e, randomBallots(e, 6, 3), { mode: "majority" });
    expect(p.dates.length).toBe(6);
    const pinned = generatePlan(sriLanka(), randomBallots(sriLanka(), 6, 3), { mode: "majority", start: "2026-12-20", length: 4 });
    expect(pinned.dates).toMatchObject({ pinned: true, length: 4, chosen: { start: "2026-12-20", end: "2026-12-23" } });
  });
});

describe("votes with equal voice", () => {
  it("each traveller's picks share one voice: one pick counts more than one of twenty", () => {
    const e = mini();
    const few = ballot(e, "few", "2026-12-01", 6, { 2: [["b-day-1"], []] });
    const many = ballot(e, "many", "2026-12-01", 6, {
      0: [["a-day-1"], ["a-night-1"]],
      1: [["road-1"], ["b-night-2"]],
      2: [["b-day-2"], ["b-night-1"]],
      3: [["c-day-1"], ["c-night-1"]],
      4: [["c-trip"], ["c-night-2"]],
    });
    const p = generatePlan(e, [few, many], { mode: "majority", start: "2026-12-01", length: 6 });
    const score = (id: string) => p.slots.flatMap((s) => s.items).find((i) => i.id === id)?.score ?? 0;
    // "few" has one pick, "many" ten: one voice each, so each of many's picks counts a tenth as much.
    expect(score("b-day-1")).toBeGreaterThan(0);
    expect(score("b-day-1")).toBeCloseTo(score("a-day-1") * 10, 5);
  });

  it("drafts count half by default, and not at all at weight 0", () => {
    const e = mini();
    const a = ballot(e, "a", "2026-12-01", 6, { 0: [["a-day-1"], []] }, "draft");
    const b = ballot(e, "b", "2026-12-01", 6, { 2: [["b-day-2"], []] });
    const half = generatePlan(e, [a, b], { mode: "majority", start: "2026-12-01", length: 6 });
    const item = (p: ConsensusPlan, id: string) => p.slots.flatMap((s) => s.items).find((i) => i.id === id);
    expect(item(half, "a-day-1")!.score * 2).toBeCloseTo(item(half, "b-day-2")!.score, 5);
    const none = generatePlan(e, [a, b], { mode: "majority", start: "2026-12-01", length: 6, draftWeight: 0 });
    expect(item(none, "a-day-1")).toBeUndefined();
  });

  it("stay-in picks become rest slots", () => {
    const e = mini();
    const rest = (id: string) => ballot(e, id, "2026-12-01", 6, { 1: [[], [STAY_ID]], 2: [[], [STAY_ID]], 4: [[], [STAY_ID]] });
    const p = generatePlan(e, [rest("a"), rest("b"), rest("c")], { mode: "majority" });
    expect(p.slots.filter((s) => s.slot === "night" && s.items[0].id === STAY_ID).length).toBeGreaterThanOrEqual(2);
  });
});

describe("hard rules — property-style", () => {
  it("never breaks a rule, across random groups and every length from 1 to 14", () => {
    const engines = [
      sriLanka(),
      georgia(),
      mini(),
      sriLanka({ fixedLength: true }),
      mini({ baseFiltering: false }),
      sriLanka({ hidden: ["galle-fort", "pub-golf-galle"] }),
      sriLanka({ baseFiltering: false }),
    ];
    let runs = 0;
    for (const [n, e] of engines.entries()) {
      for (let len = 1; len <= 14; len++) {
        const ballots = randomBallots(e, 4 + ((len * 7 + n) % 9), len * 31 + n);
        const modes = ["together", "majority", "custom"] as const;
        const mode = modes[(len + n) % 3];
        const p = generatePlan(e, ballots, { mode, fairness: (len % 5) / 4, variety: (len % 3) / 2, budgetFit: len % 2, length: len, draftWeight: (n % 3) / 2 });
        assertValid(e, p, ballots);
        // Fairness never leaves the lowest share below the most popular plan's.
        expect(p.fairness.min).toBeGreaterThanOrEqual(p.fairness.majority.min - 1e-9);
        if (mode === "majority") expect(p.fairness.min).toBeCloseTo(p.fairness.majority.min, 9);
        runs++;
      }
    }
    expect(runs).toBe(engines.length * 14);
  }, 120_000);

  it("is deterministic: the same inputs (in any order) give the same plan", () => {
    const e = sriLanka();
    const ballots = randomBallots(e, 12, 99);
    const a = generatePlan(e, ballots, { mode: "together" });
    const b = generatePlan(e, [...ballots].reverse(), { mode: "together" });
    expect(b).toEqual(a);
    expect(a.slots[0].items[0].key).toBe(itemKey(a.slots[0].date, a.slots[0].slot, a.slots[0].items[0].id));
  }, 30_000);

  it("a rebuilt trip plans the same: new participant ids don't change a thing", () => {
    const e = sriLanka();
    const ballots = demoBallots(e, demoById("sri-lanka")!);
    const rebuilt = ballots.map((b, i) => ({ ...b, id: `${(7919 * (i + 3)).toString(16)}-${b.id.length}` }));
    for (const mode of ["together", "majority"] as const) {
      const a = generatePlan(e, ballots, { mode });
      const b = generatePlan(e, rebuilt, { mode });
      expect(b.itinerary).toEqual(a.itinerary);
      expect(b.people.map((p) => [p.name, p.made])).toEqual(a.people.map((p) => [p.name, p.made]));
    }
  }, 30_000);
});

describe("fairness by share", () => {
  // Six friends who all want the same things, and one with niche taste.
  const e = mini();
  const crowd = (id: string) =>
    ballot(e, id, "2026-12-01", 6, {
      0: [["a-day-1"], ["a-night-1"]],
      1: [["road-1"], ["b-night-1"]],
      2: [["b-day-1"], ["b-night-2"]],
      3: [["c-day-1"], ["c-night-1"]],
      4: [["c-trip"], ["c-night-2"]],
    });
  // The niche picks are long: none can sit alongside the crowd's, so lifting them always replaces something.
  const niche = ballot(e, "niche", "2026-12-01", 6, { 0: [["a-day-long"], []], 2: [["b-day-long"], []] });
  const group = [crowd("c1"), crowd("c2"), crowd("c3"), crowd("c4"), crowd("c5"), crowd("c6"), niche];
  const at = { start: "2026-12-01", length: 6 };
  const nicheMade = (p: ConsensusPlan) => p.people.find((x) => x.id === "niche")!.made.length;

  it("each mode's strength, fairness pull and popularity it may give up", () => {
    expect(modeParams("majority", 1, 0.15)).toEqual({ strength: 0, lambda: 0, tolerance: 0 });
    expect(modeParams("together", 0, 0.15)).toEqual({ strength: 1, lambda: 0.5, tolerance: 0.15 });
    expect(modeParams("custom", 0.5, 0.2)).toEqual({ strength: 0.5, lambda: 0.25, tolerance: 0.1 });
    expect(modeParams("together", 0, 0.9).tolerance).toBe(0.5);
  });

  it("Majority rules can leave someone with nothing", () => {
    const p = generatePlan(e, group, { mode: "majority", ...at });
    expect(p.settings).toMatchObject({ strength: 0, lambda: 0, effectiveTolerance: 0 });
    expect(nicheMade(p)).toBe(0);
    expect(p.fairness).toMatchObject({ min: 0, lifted: 0, note: null, scoreKept: 1 });
  });

  it("Everyone gets a say lifts the lowest share first, within the popularity it may give up, and says so", () => {
    const p = generatePlan(e, group, { mode: "together", ...at });
    expect(p.settings.effectiveTolerance).toBe(0.15);
    expect(nicheMade(p)).toBeGreaterThan(0);
    expect(p.fairness.majority.min).toBe(0);
    expect(p.fairness.min).toBeGreaterThan(0);
    expect(p.fairness.scoreKept).toBeGreaterThanOrEqual(1 - 0.15 - 1e-9);
    const lifted = p.slots.flatMap((s) => s.items).find((i) => i.floorFor.includes("niche"));
    expect(lifted?.reasons.map((r) => r.text)).toContain("Added to lift someone who'd otherwise get little of what they picked");
    expect(p.people.find((x) => x.id === "niche")!).toMatchObject({ feasible: 2, floorAdded: nicheMade(p) });
  });

  it("gives up no more than the tolerance, and more tolerance lifts at least as far", () => {
    let last = -1;
    for (const tolerance of [0, 0.05, 0.15, 0.3, 0.5]) {
      const p = generatePlan(e, group, { mode: "together", ...at, tolerance });
      expect(p.fairness.scoreKept).toBeGreaterThanOrEqual(1 - tolerance - 1e-9);
      expect(p.fairness.min).toBeGreaterThanOrEqual(last - 1e-9);
      last = p.fairness.min;
    }
    expect(last).toBeGreaterThan(0);
  });

  it("when the lowest share can't be lifted, it says why in plain words", () => {
    const p = generatePlan(e, group, { mode: "together", ...at, tolerance: 0 });
    if (p.fairness.min <= p.fairness.majority.min) expect(p.fairness.note).toMatch(/popularity this mode may give up|push someone else even lower|no other picks that fit/);
    else expect(p.fairness.note).toBeNull();
    // Majority rules never explains itself: it doesn't try.
    expect(generatePlan(e, group, { mode: "majority", ...at }).fairness.note).toBeNull();
  });

  it("Custom at zero is Majority rules; at full fairness it's Everyone gets a say", () => {
    const zero = generatePlan(e, group, { mode: "custom", fairness: 0, ...at });
    const majority = generatePlan(e, group, { mode: "majority", ...at });
    expect(zero.itinerary).toEqual(majority.itinerary);
    const full = generatePlan(e, group, { mode: "custom", fairness: 1, ...at });
    const together = generatePlan(e, group, { mode: "together", ...at });
    expect(full.itinerary).toEqual(together.itinerary);
    expect(full.fairness.min).toBeGreaterThan(majority.fairness.min);
    expect(full.fairness.index).toBeGreaterThan(majority.fairness.index);
  });

  it("reports per-person satisfaction as a share of feasible picks, with count-based reasons", () => {
    const p = generatePlan(e, group, { mode: "majority", ...at });
    const n = p.people.find((x) => x.id === "niche")!;
    expect(n).toMatchObject({ picks: 2, feasible: 2, satisfaction: 0 });
    expect(n.missed.map((m) => m.reason)).toContain("Only you picked it");
    expect(JSON.stringify(n.missed)).not.toMatch(/c[1-6]\b/);
  });

  it("compare modes runs every mode on the same inputs", () => {
    const out = compareModes(e, group, { ...at, fairness: 1 });
    expect(out.map((m) => m.mode)).toEqual(["together", "majority", "custom"]);
    expect(out[1].leftOut).toBe(1);
    expect(out[0].leftOut).toBe(0);
    expect(out[1].differs).toBeGreaterThan(0);
  });

  it("on the demo crews: a real trade-off, never above the most popular plan, and Custom in between (or why not)", () => {
    for (const id of ["sri-lanka", "georgia"]) {
      const de = engineFor(readPreset(id));
      const [together, majority, custom] = compareModes(de, demoBallots(de, demoById(id)!), { fairness: 0.5 });
      expect(together.fairness.majority.min).toBeCloseTo(majority.fairness.min, 9);
      for (const m of [together, majority, custom]) expect(m.fairness.scoreKept).toBeLessThanOrEqual(1 + 1e-9);
      if (together.fairness.min > majority.fairness.min + 1e-9) {
        // Lifting costs something now: the most popular plan already has every extra that fits.
        expect(majority.differs).toBeGreaterThan(0);
        expect(together.fairness.scoreKept).toBeLessThan(1);
        expect(together.fairness.scoreKept).toBeGreaterThanOrEqual(1 - 0.15 - 1e-9);
      } else {
        // Nothing to lift: every mode makes the same plan, and says why.
        expect(majority.differs).toBe(0);
        expect(together.fairness.note).toBeTruthy();
      }
      if (custom.sameAs) expect(custom.sameWhy).toBeTruthy();
    }
    // Sri Lanka: Custom at halfway sits between the two.
    const de = sriLanka();
    const [together, majority, custom] = compareModes(de, demoBallots(de, demoById("sri-lanka")!), { fairness: 0.5 });
    expect(custom.sameAs ?? null).toBeNull();
    expect(custom.fairness.min).toBeGreaterThan(majority.fairness.min);
    expect(custom.fairness.min).toBeLessThan(together.fairness.min);
    expect(custom.fairness.scoreKept).toBeGreaterThan(together.fairness.scoreKept);
    expect(custom.fairness.scoreKept).toBeLessThan(1);
  }, 60_000);

  it("no plan exceeds the most popular one: random groups, every mode", () => {
    let above = 0;
    let runs = 0;
    for (const [n, e] of [sriLanka(), georgia()].entries()) {
      for (let seed = 1; seed <= 12; seed++) {
        const ballots = randomBallots(e, 8 + (seed % 7), seed * 13 + n);
        for (const mode of ["together", "custom"] as const) {
          const p = generatePlan(e, ballots, { mode });
          runs++;
          if (p.fairness.scoreKept > 1 + 1e-9) {
            above++;
            // When it happens, the plan says why.
            expect(p.fairness.aboveNote).toMatch(/opened up an arrangement/);
          } else expect(p.fairness.aboveNote ?? null).toBeNull();
        }
      }
    }
    // The popularity search explores from lifted plans, so this is rare.
    expect(above / runs).toBeLessThan(0.1);
  }, 120_000);

  it("Protect everyone else: on by default, nobody more than one pick down — and switching it off lets lifts go further", () => {
    const e = sriLanka();
    // A 9-person group (found by search) where the best lift costs someone two picks.
    const ballots = randomBallots(e, 9, 13);
    const on = generatePlan(e, ballots, { mode: "together" });
    const off = generatePlan(e, ballots, { mode: "together", protect: false });
    expect(on.fairness).toMatchObject({ protect: true });
    expect(Math.min(...on.people.map((p) => p.vsMajority ?? 0))).toBeGreaterThanOrEqual(-1);
    expect(on.fairness.maxLoss).toBeLessThanOrEqual(1);
    expect(off.fairness.protect).toBe(false);
    expect(off.fairness.maxLoss).toBeGreaterThanOrEqual(2);
    expect(off.fairness.min).toBeGreaterThan(on.fairness.min);
    // The compare view's "what it holds back": Everyone gets a say with the switch flipped.
    expect(protectEffect(e, ballots, { protect: true }).fairness.min).toBeCloseTo(off.fairness.min, 9);
    // Majority rules never needs it.
    expect(generatePlan(e, ballots, { mode: "majority" }).fairness).toMatchObject({ protect: false, maxLoss: 0 });
  }, 30_000);
});

describe("realism", () => {
  const evening = (e: Engine, length: number, kind: "transfer" | "base") => planDays(e, length).findIndex((d, i) => d.kind === kind && i > 0 && !!d.areas.night);

  it("at most one main meal per slot; a small food extra can still join one", () => {
    const e = georgia();
    // Everyone wants a food crawl and a khachapuri lunch on the same day — and a bazaar wander.
    const fan = (id: string) => ballot(e, id, "2026-12-27", 6, { 2: [["tbilisi-food-crawl", "khachapuri-lunch", "dezerter-bazaar"], []] });
    const p = generatePlan(e, ["a", "b", "c", "d", "e"].map(fan), { mode: "majority", start: "2026-12-27", length: 6 });
    const crawl = p.slots.find((s) => s.items.some((i) => i.id === "tbilisi-food-crawl"))!;
    expect(crawl.items.map((i) => i.id)).not.toContain("khachapuri-lunch");
    expect(crawl.items.filter((i) => isMeal(e.catalog.byId[i.id])).length).toBe(1);
    assertValid(e, p);
    // Sri Lanka: two dinners picked for the same evening never land together.
    const sl = sriLanka();
    const at = evening(sl, 6, "base");
    const diner = (id: string) => ballot(sl, id, "2026-12-27", 6, { [at]: [[], ["galle-fort-sunset-dinner", "mirissa-seafood-bbq"]] });
    const q = generatePlan(sl, ["a", "b", "c", "d"].map(diner), { mode: "majority", start: "2026-12-27", length: 6 });
    for (const s of q.slots) expect(s.items.filter((i) => isMeal(sl.catalog.byId[i.id] ?? { tags: [] })).length).toBeLessThanOrEqual(1);
  });

  it("a transfer day's evening only uses the arriving base's pool — across every preset, length and mode", () => {
    const engines = [sriLanka(), sriLanka({ baseFiltering: false }), georgia(), mini(), mini({ baseFiltering: false })];
    let transfers = 0;
    for (const [n, e] of engines.entries()) {
      for (let len = 2; len <= 14; len += 3) {
        const ballots = randomBallots(e, 9, 500 + len * 7 + n);
        for (const mode of ["together", "majority", "custom"] as const) {
          const p = generatePlan(e, ballots, { mode, length: len });
          const plans = planDays(e, len);
          for (const s of p.slots) {
            const plan = plans[s.day];
            if (plan.kind !== "transfer" || s.slot !== "night") continue;
            transfers++;
            for (const it of s.items) if (it.id !== STAY_ID) expect(e.catalog.byId[it.id].areas).toContain(plan.base.area);
          }
        }
      }
    }
    expect(transfers).toBeGreaterThan(0);
  }, 60_000);

  it("Sri Lanka's road-day pub golf is always the Galle one", () => {
    // Even when people put the Colombo pub golf on the road day (possible with base filtering off).
    const e = sriLanka({ baseFiltering: false });
    const day = evening(e, 6, "transfer");
    expect(planDays(e, 6)[day].base.area).toBe("galle");
    const golfer = (id: string, which: string) => ballot(e, id, "2026-12-27", 6, { [day]: [[], [which]] });
    const ballots = [golfer("a", "pub-golf-colombo"), golfer("b", "pub-golf-colombo"), golfer("c", "pub-golf-colombo"), golfer("d", "pub-golf-galle"), golfer("e", "pub-golf-galle")];
    for (const mode of ["together", "majority", "custom"] as const) {
      const p = generatePlan(e, ballots, { mode, start: "2026-12-27", length: 6 });
      const road = p.slots.find((s) => s.day === day && s.slot === "night")!;
      expect(road.items.map((i) => i.id)).not.toContain("pub-golf-colombo");
      expect(road.items.map((i) => i.id).filter((id) => id.startsWith("pub-golf"))).toEqual(road.items.some((i) => i.id === "pub-golf-galle") ? ["pub-golf-galle"] : []);
      expect(p.slots.flatMap((s) => s.items).some((i) => i.id === "pub-golf-galle")).toBe(true);
    }
    // The demo crew: any pub golf on its road day is the Galle one.
    const de = sriLanka();
    for (const mode of ["together", "majority", "custom"] as const) {
      const p = generatePlan(de, demoBallots(de, demoById("sri-lanka")!), { mode });
      const plans = planDays(de, p.dates.length);
      for (const s of p.slots) if (plans[s.day].kind === "transfer" && s.slot === "night") for (const it of s.items) expect(it.id).not.toBe("pub-golf-colombo");
    }
  }, 30_000);

  it("extras stay close: a half-day trip like Uplistsikhe is never an extra", () => {
    const e = georgia();
    const fan = (id: string) => ballot(e, id, "2026-12-27", 6, { 2: [["old-tbilisi-walk", "uplistsikhe"], []], 3: [["sulfur-baths", "uplistsikhe"], []] });
    for (const mode of ["together", "majority", "custom"] as const) {
      const p = generatePlan(e, ["a", "b", "c", "d"].map(fan), { mode, start: "2026-12-27", length: 6 });
      const items = p.slots.flatMap((s) => s.items);
      expect(items.find((i) => i.id === "uplistsikhe")?.role ?? "main").toBe("main");
      assertValid(e, p);
    }
  });

  it("the drive counts in the day: a road day keeps only the stops that fit with the coast road", () => {
    const e = sriLanka();
    const road = planDays(e, 6).findIndex((d) => d.kind === "transfer");
    const stops = ["bentota-water-sports", "madu-river-safari", "bentota-beach-lunch", "kosgoda-turtles"];
    // The traveller's own timeline: three long stops plus the ~3¾ hr coast road is a packed day.
    const mine = ballot(e, "me", "2026-12-27", 6, { [road]: [stops.slice(0, 3), []] });
    const day = buildTimeline(e, mine.data).days[road].day;
    expect(day.legHours).toBe(3.75);
    expect(day.plannedHours).toBeCloseTo(3.75 + 2.5 + 2 + 2.5, 5);
    expect(day.overpacked).toBe(true);
    // The group plan keeps only what fits the daytime with the drive, and says how long the day is.
    const fans = ["a", "b", "c", "d", "e", "f"].map((id) => ballot(e, id, "2026-12-27", 6, { [road]: [stops, []] }));
    for (const mode of ["together", "majority"] as const) {
      const p = generatePlan(e, fans, { mode, start: "2026-12-27", length: 6 });
      const slot = p.slots.find((s) => s.day === road && s.slot === "day")!;
      const hours = slot.items.reduce((h, it) => h + (e.catalog.byId[it.id]?.hours ?? 0), 0);
      expect(hours + 3.75).toBeLessThanOrEqual(10);
      expect(slot.items.length).toBeLessThan(stops.length);
      expect(slot.items[0].reasons.find((r) => r.kind === "time")?.text).toMatch(/^With the drive \(.+\), the stops make a .+ day$/);
      assertValid(e, p, fans);
    }
  });
});

describe("free time counts", () => {
  // Six friends who want every evening free, and one who wants two evenings out in Beta.
  const e = mini();
  const resting = (id: string) =>
    ballot(e, id, "2026-12-01", 6, {
      0: [["a-day-1"], [STAY_ID]],
      1: [["road-1"], [STAY_ID]],
      2: [["b-day-1"], [STAY_ID]],
      3: [["c-day-1"], [STAY_ID]],
      4: [["c-trip"], [STAY_ID]],
    });
  const outgoing = ballot(e, "out", "2026-12-01", 6, { 1: [[], ["b-night-1"]], 2: [[], ["b-night-2"]] });
  const group = [resting("r1"), resting("r2"), resting("r3"), resting("r4"), resting("r5"), resting("r6"), outgoing];
  const at = { start: "2026-12-01", length: 6 };

  it("free slots people asked for count as picks in their share, and the chips say why a slot is free", () => {
    const p = generatePlan(e, group, { mode: "majority", ...at });
    const r1 = p.people.find((x) => x.id === "r1")!;
    expect(r1.rest).toEqual({ feasible: 5, made: 5 });
    expect(r1.feasible).toBe(r1.rest!.feasible + (r1.picks - r1.missed.filter((m) => /doesn't|away/.test(m.reason)).length));
    expect(r1.satisfaction).toBeCloseTo((r1.made.length + 5) / r1.feasible, 9);
    const evening = p.slots.find((s) => s.slot === "night" && s.items[0].id === STAY_ID)!;
    expect(evening.items[0].reasons.map((r) => r.text)).toContain("Kept free: 6 want a slower evening");
    expect(p.people.find((x) => x.id === "out")!.made).toEqual([]);
  });

  it("a lift can't take rest for free: giving away a free evening lowers the share of everyone who asked for it", () => {
    const majority = generatePlan(e, group, { mode: "majority", ...at });
    const together = generatePlan(e, group, { mode: "together", ...at });
    const out = together.people.find((x) => x.id === "out")!;
    expect(out.made.length).toBeGreaterThan(0);
    for (const k of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
      const before = majority.people.find((x) => x.id === k)!;
      const after = together.people.find((x) => x.id === k)!;
      expect(after.rest!.made).toBe(before.rest!.made - out.made.length);
      expect(after.satisfaction!).toBeLessThan(before.satisfaction!);
      expect(after.vsMajority).toBe(-out.made.length);
    }
    // Protect everyone else keeps it to one evening each, so only one of the two goes.
    expect(out.made).toHaveLength(1);
    expect(together.fairness.scoreKept).toBeLessThan(1);
  });
});

describe("splits", () => {
  it("suggests one when a slot's top options have strong, separate camps — with headcounts", () => {
    const e = mini();
    const camp = (id: string, pick: string) => ballot(e, id, "2026-12-01", 6, { 2: [[pick], []] });
    const ballots = ["a", "b", "c", "d", "e"].map((x) => camp(x, "b-day-1")).concat(["f", "g", "h", "i"].map((x) => camp(x, "b-day-2")));
    const p = generatePlan(e, ballots, { mode: "majority", start: "2026-12-01", length: 6 });
    const s = p.slots.find((x) => x.split)!;
    expect(s.split).toMatchObject({ a: { id: "b-day-1", votes: 5 }, b: { id: "b-day-2", votes: 4 }, both: 0, status: "suggested" });
    expect(planDays(e, 6)[s.day]).toMatchObject({ kind: "base", arrival: false });
  });

  it("an accepted split keeps both options in that slot, and counts for both camps", () => {
    const e = mini();
    const camp = (id: string, pick: string) => ballot(e, id, "2026-12-01", 6, { 2: [[pick], []] });
    const ballots = ["a", "b", "c", "d", "e"].map((x) => camp(x, "b-day-1")).concat(["f", "g", "h", "i"].map((x) => camp(x, "b-day-2")));
    const first = generatePlan(e, ballots, { mode: "majority", start: "2026-12-01", length: 6 });
    const s = first.slots.find((x) => x.split)!;
    const p = generatePlan(e, ballots, { mode: "majority", start: "2026-12-01", length: 6, splits: { [s.key]: { status: "accepted", a: "b-day-1", b: "b-day-2" } } });
    const again = p.slots.find((x) => x.key === s.key)!;
    expect(again.split?.status).toBe("accepted");
    expect(p.people.find((x) => x.id === "f")!.made).toContain("b-day-2");
    assertValid(e, p);
  });

  it("both camps must be at least the organizers' share of those there (and 3) — a knob", () => {
    const e = mini();
    const camp = (id: string, pick: string) => ballot(e, id, "2026-12-01", 6, { 2: [[pick], []] });
    // 9 there: 5 want one thing, 4 another.
    const ballots = ["a", "b", "c", "d", "e"].map((x) => camp(x, "b-day-1")).concat(["f", "g", "h", "i"].map((x) => camp(x, "b-day-2")));
    const split = (splitShare: number) => generatePlan(e, ballots, { mode: "majority", start: "2026-12-01", length: 6, splitShare }).slots.find((x) => x.split)?.split ?? null;
    expect(split(0.4)).toMatchObject({ a: { votes: 5 }, b: { votes: 4 } }); // the default: needs 4 of 9
    expect(generatePlan(e, ballots, { mode: "majority", start: "2026-12-01", length: 6 }).slots.find((x) => x.split)?.split).toMatchObject({ b: { votes: 4 } });
    expect(split(0.5)).toBeNull(); // needs 5 of 9
    // Never fewer than 3, however low the knob.
    const small = ["a", "b", "c"].map((x) => camp(x, "b-day-1")).concat(["f", "g"].map((x) => camp(x, "b-day-2")));
    expect(generatePlan(e, small, { mode: "majority", start: "2026-12-01", length: 6, splitShare: 0.15 }).slots.some((x) => x.split)).toBe(false);
  });

  it("the Sri Lanka demo's Weligama 3 / Dalawella 3 split no longer fires", () => {
    const e = sriLanka();
    const ballots = demoBallots(e, demoById("sri-lanka")!);
    for (const mode of ["together", "majority", "custom"] as const) {
      const p = generatePlan(e, ballots, { mode });
      for (const s of p.slots) {
        if (!s.split) continue;
        const there = ballots.filter((b) => !b.data.startDate || (s.date >= b.data.startDate && s.date <= b.data.endDate!)).length;
        expect(Math.min(s.split.a.votes, s.split.b.votes)).toBeGreaterThanOrEqual(Math.max(3, Math.ceil(0.4 * there)));
        expect([s.split.a.id, s.split.b.id].sort()).not.toEqual(["dalawella-turtles", "weligama-surf-lesson"]);
      }
    }
  }, 30_000);

  it("never splits a moving day or New Year's Eve", () => {
    const e = sriLanka();
    const p = generatePlan(e, demoBallots(e, demoById("sri-lanka")!), { mode: "majority" });
    for (const s of p.slots) if (s.split) expect(planDays(e, p.dates.length)[s.day]).toMatchObject({ kind: "base", arrival: false, departs: false });
    expect(p.slots.find((s) => s.special)?.split).toBeNull();
  });
});

describe("special dates and weekdays", () => {
  it("New Year's Eve goes to the most-voted special option, pinned to 31 Dec", () => {
    const e = mini();
    // 29 Dec start: 31 Dec is day 3 (index 2), a Beta evening.
    const vote = (id: string, pick: string) => ballot(e, id, "2026-12-29", 6, { 2: [[], [pick]] });
    const p = generatePlan(e, [vote("a", "nye-b-2"), vote("b", "nye-b-2"), vote("c", "nye-b-1")], { mode: "majority", start: "2026-12-29", length: 6 });
    const nye = p.slots.find((s) => s.special === "nye")!;
    expect(nye.date).toBe("2026-12-31");
    expect(nye.items[0].id).toBe("nye-b-2");
    expect(nye.items[0].reasons.find((r) => r.kind === "special")?.text).toMatch(/2 votes vs 1/);
    const loser = p.people.find((x) => x.id === "c")!.missed.find((m) => m.id === "nye-b-1");
    expect(loser?.reason).toMatch(/NYE went to .*, 2 votes/);
  });

  it("day-of-week options only land on their days, and say so", () => {
    const e = sriLanka();
    // The Secret Jungle Party runs Fridays only. 1 Jan 2027 is a Friday.
    const fan = (id: string) => ballot(e, id, "2026-12-27", 7, { 3: [[], ["secret-jungle-party"]] });
    const p = generatePlan(e, ["a", "b", "c", "d"].map(fan), { mode: "majority", start: "2026-12-27", length: 7 });
    const slot = p.slots.find((s) => s.items.some((i) => i.id === "secret-jungle-party"))!;
    expect(parseISO(slot.date).getUTCDay()).toBe(5);
    expect(slot.items.find((i) => i.id === "secret-jungle-party")!.reasons.find((r) => r.kind === "weekday")?.text).toBe("Fridays only — fits Fri 1 Jan");
  });

  it("explains a weekday-only pick that can't fit", () => {
    const e = sriLanka();
    const fan = ballot(e, "fan", "2026-12-27", 5, { 3: [[], ["secret-jungle-party"]] });
    // 27–31 Dec has no Friday at all.
    const p = generatePlan(e, [fan], { mode: "majority", start: "2026-12-27", length: 5 });
    expect(p.people[0].missed[0].reason).toMatch(/^Fridays only, and the dates have no Friday evening in Galle/);
  });
});

describe("locks and regeneration", () => {
  it("locked items survive regenerating in any mode", () => {
    const e = sriLanka();
    const ballots = demoBallots(e, demoById("sri-lanka")!);
    const first = generatePlan(e, ballots, { mode: "majority" });
    const slot = first.slots.find((s) => s.slot === "day" && s.day >= 2)!;
    const alt = slot.alternatives.find((a) => a.id !== STAY_ID && !a.elsewhere)!;
    const locks = [{ date: slot.date, slot: slot.slot, id: alt.id, role: "main" as const }];
    for (const mode of ["together", "majority", "custom"] as const) {
      const p = generatePlan(e, ballots, { mode, locks, start: first.dates.chosen.start });
      const again = p.slots.find((s) => s.key === slot.key)!;
      expect(again.items[0]).toMatchObject({ id: alt.id, locked: true });
      expect(again.items[0].reasons[0].text).toBe("Locked by the organizers");
      assertValid(e, p);
    }
  });

  it("a lock outside new dates is dropped with a note", () => {
    const e = sriLanka();
    const ballots = demoBallots(e, demoById("sri-lanka")!);
    const p = generatePlan(e, ballots, { mode: "majority", start: "2026-12-10", locks: [{ date: "2026-12-30", slot: "day", id: "galle-fort", role: "main" }] });
    expect(p.notes[0]).toMatch(/outside these dates/);
  });
});

describe("short trips", () => {
  it("a 1-day trip plans a daytime only; a 3-day Sri Lanka trip stays in Colombo", () => {
    const e = sriLanka();
    const ballots = randomBallots(e, 8, 5);
    const one = generatePlan(e, ballots, { mode: "together", length: 1 });
    expect(one.slots.map((s) => s.slot)).toEqual(["day"]);
    assertValid(e, one);
    const three = generatePlan(e, ballots, { mode: "together", length: 3 });
    expect(new Set(three.slots.map((s) => s.area))).toEqual(new Set(["colombo"]));
    const galleFan = three.people.find((x) => x.missed.some((m) => /doesn't stay in Galle/.test(m.reason)));
    expect(galleFan).toBeDefined();
  });
});

describe("the demo crews", () => {
  it("plans each demo in every mode within the rules", () => {
    for (const id of ["sri-lanka", "georgia"]) {
      const e = engineFor(readPreset(id));
      const ballots = demoBallots(e, demoById(id)!);
      for (const mode of ["together", "majority", "custom"] as const) assertValid(e, generatePlan(e, ballots, { mode }), ballots);
    }
  }, 30_000);
});

describe("performance", () => {
  it("30 travellers × 14 days well under a second", () => {
    const e = sriLanka();
    const ballots: Ballot[] = randomBallots(e, 30, 2024).map((b) => {
      // Everyone on long trips, so the plan is the full 14 days.
      const d: ItineraryData = quickFill(e, setStart(e, emptyItinerary(), "2026-12-20", 14), { rng: seeded(b.id.length + Number(b.id.slice(1))) });
      return { ...b, data: normalize(e, d) };
    });
    const t = performance.now();
    const p = generatePlan(e, ballots, { mode: "custom", fairness: 1 });
    const ms = performance.now() - t;
    expect(p.dates.length).toBe(14);
    expect(ms).toBeLessThan(1000);
    console.log(`30 travellers × 14 days: ${ms.toFixed(0)} ms`);
  }, 30_000);
});
