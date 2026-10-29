import { describe, expect, it } from "vitest";
import {
  allowedLengths,
  daysNightsLabel,
  defaultLength,
  droppedBases,
  lengthBounds,
  nightsFor,
  nightsLine,
  planDays,
  previewDays,
  structureNote,
  tripDays,
} from "@/engine/structure";
import { buildTimeline } from "@/engine/timeline";
import { mini, placed, readPreset, engineFor, sriLanka } from "./helpers";

const shape = (plans: ReturnType<typeof planDays>) =>
  plans.map((p) => `${p.kind}${p.arrival ? "*" : ""}:${p.base.id}:${p.areas.day ?? "-"}/${p.areas.night ?? "-"}`);
const georgia = (rules = {}) => engineFor(readPreset("georgia"), rules);

describe("fixed trip length — Sri Lanka (Colombo 1 → Galle 4)", () => {
  const e = sriLanka({ fixedLength: true });

  it("is 6 days · 5 nights by default", () => {
    expect(tripDays(e)).toBe(6);
    expect(previewDays(e)).toBe(5);
    expect(nightsLine(e, 6)).toBe("Colombo · 1 night → Galle · 4 nights");
  });

  it("lands in Colombo, drives the coast, stays in Galle and flies home", () => {
    expect(shape(planDays(e, 6))).toEqual([
      "base*:colombo:colombo/colombo",
      "transfer:galle:enroute/galle",
      "base:galle:galle/galle",
      "base:galle:galle/galle",
      "base:galle:galle/galle",
      "departure:galle:-/-",
    ]);
    expect(planDays(e, 6).map((p) => p.name)).toEqual([
      "Land in Colombo",
      "Road trip to Galle",
      "Galle base",
      "Galle base",
      "Galle base",
      "Check out & fly home",
    ]);
  });

  it("only the ordinary Galle days can be reordered", () => {
    expect(planDays(e, 6).map((p) => p.reorderable)).toEqual([false, false, true, true, true, false]);
  });

  it("follows the rules' nights split", () => {
    const e2 = sriLanka({ fixedLength: true, nights: { colombo: 2, galle: 3 } });
    expect(tripDays(e2)).toBe(6);
    expect(shape(planDays(e2, 6)).map((s) => s.split(":")[0])).toEqual(["base*", "base", "transfer", "base", "base", "departure"]);
    expect(planDays(e2, 6)[1].name).toBe("Colombo day");
  });

  it("the preview drops a night at the last base", () => {
    expect(nightsFor(e, 5).map((s) => s.nights)).toEqual([1, 3]);
    expect(allowedLengths(e)).toEqual([6]);
    expect(allowedLengths(sriLanka({ fixedLength: true, requireFullTrip: false }))).toEqual([6, 5]);
    expect(lengthBounds(sriLanka({ fixedLength: true, requireFullTrip: false }))).toEqual({ min: 5, max: 6 });
  });
});

describe("fixed trip length — three bases", () => {
  const e = mini({ fixedLength: true });

  it("puts a transfer day at the start of every base after the first", () => {
    expect(shape(planDays(e, 6))).toEqual([
      "base*:alpha:a/a",
      "transfer:beta:road/b",
      "base:beta:b/b",
      "transfer:gamma:c/c",
      "base:gamma:c/c",
      "departure:gamma:-/-",
    ]);
  });

  it("uses the destination's pool when a transfer has no route", () => {
    expect(planDays(e, 6)[3].areas).toEqual({ day: "c", night: "c" });
    expect(planDays(e, 6)[3].transfer?.name).toBe("Over to Gamma");
  });

  it("names the nights per base", () => {
    expect(nightsLine(e, 6)).toBe("Alpha · 1 night → Beta · 2 nights → Gamma · 2 nights");
  });
});

describe("free dates — the default", () => {
  const e = sriLanka();

  it("allows any length the rules give, starting at the suggested length", () => {
    expect(lengthBounds(e)).toEqual({ min: 1, max: 14 });
    expect(allowedLengths(e)).toHaveLength(14);
    expect(defaultLength(e)).toBe(6); // "Most groups do 5–7 days"
    expect(lengthBounds(sriLanka({ length: { min: 3, max: 9 } }))).toEqual({ min: 3, max: 9 });
  });

  it("shares the nights out by weight: Colombo short, Galle longer", () => {
    const split = (n: number) => nightsFor(e, n).map((s) => s.nights);
    expect(split(6)).toEqual([1, 4]);
    expect(split(4)).toEqual([1, 2]);
    expect(split(8)).toEqual([1, 6]);
    expect(split(10)).toEqual([2, 7]);
    expect(split(14)).toEqual([3, 10]);
  });

  it("drops Galle when the trip is too short for it, with a gentle note", () => {
    expect(nightsFor(e, 3).map((s) => s.nights)).toEqual([2, 0]);
    expect(droppedBases(e, 3).map((b) => b.id)).toEqual(["galle"]);
    expect(structureNote(e, 3)).toBe("Too short for Galle; this trip stays in Colombo");
    expect(shape(planDays(e, 3))).toEqual(["base*:colombo:colombo/colombo", "base:colombo:colombo/colombo", "departure:colombo:-/-"]);
    expect(structureNote(e, 4)).toBeNull();
  });

  it("flies home from wherever the trip ends", () => {
    const short = buildTimeline(e, placed(e, "2026-12-10", 3));
    expect(short.days[2].legsBefore[0].from).toBe("colombo");
    const long = buildTimeline(e, placed(e, "2026-12-10", 6));
    expect(long.days[5].legsBefore[0].from).toBe("galle");
  });

  it("a 1-day trip lands and flies home the same day: a daytime, no evening", () => {
    const [day] = planDays(e, 1);
    expect(planDays(e, 1)).toHaveLength(1);
    expect(day).toMatchObject({ arrival: true, departs: true, hasSlots: true, areas: { day: "colombo", night: null } });
    expect(daysNightsLabel(1)).toBe("1 day · no nights");
    const t = buildTimeline(e, placed(e, "2026-12-10", 1));
    expect(t.days[0].legsBefore[0].flight).toBe(true);
    expect(t.days[0].legsAfter[0].to).toBe("airport");
  });

  it("builds a sensible shape for every length from 1 to 14 days", () => {
    for (const engine of [e, mini(), georgia()]) {
      for (let n = 1; n <= 14; n++) {
        const plans = planDays(engine, n);
        expect(plans).toHaveLength(n);
        expect(plans[0].arrival).toBe(true);
        expect(plans.at(-1)!.departs).toBe(true);
        const nights = nightsFor(engine, n).reduce((s, x) => s + x.nights, 0);
        expect(nights).toBe(n - 1);
        // Bases keep their order and transfers sit on the first day at each later base.
        const seen = plans.filter((p) => p.kind !== "departure").map((p) => p.base.id);
        expect([...new Set(seen)]).toEqual(engine.catalog.bases.map((b) => b.id).filter((id) => seen.includes(id)));
        plans.forEach((p, i) => {
          if (p.kind === "transfer") expect(plans[i - 1].base.id).not.toBe(p.base.id);
          if (i > 0 && p.kind === "base") expect(plans[i - 1].base.id).toBe(p.base.id);
        });
      }
    }
  });

  it("drops later bases first, keeping every base's minimum nights", () => {
    const e3 = mini();
    expect(nightsFor(e3, 2).map((s) => s.nights)).toEqual([1, 0, 0]);
    expect(nightsFor(e3, 4).map((s) => s.nights)).toEqual([1, 2, 0]); // gamma needs 2 nights
    expect(structureNote(e3, 4)).toBe("Too short for Gamma; this trip stays in Alpha and Beta");
    expect(nightsFor(e3, 5).map((s) => s.nights)).toEqual([1, 1, 2]);
    expect(nightsFor(e3, 6).map((s) => s.nights)).toEqual([1, 2, 2]);
  });

  it("Georgia stays in Tbilisi whatever the length", () => {
    const g = georgia();
    expect(defaultLength(g)).toBe(8);
    expect(nightsLine(g, 3)).toBe("Tbilisi · 2 nights");
    expect(structureNote(g, 2)).toBeNull();
    expect(nightsLine(g, 1)).toBe("Tbilisi · day trip");
  });
});
