import { describe, expect, it } from "vitest";
import { allowedLengths, nightsFor, nightsLine, planDays, previewDays, tripDays } from "@/engine/structure";
import { mini, sriLanka } from "./helpers";

const shape = (plans: ReturnType<typeof planDays>) =>
  plans.map((p) => `${p.kind}${p.arrival ? "*" : ""}:${p.base.id}:${p.areas.day ?? "-"}/${p.areas.night ?? "-"}`);

describe("day structure — Sri Lanka (Colombo 1 → Galle 4)", () => {
  const e = sriLanka();

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
    const e2 = sriLanka({ nights: { colombo: 2, galle: 3 } });
    expect(tripDays(e2)).toBe(6);
    expect(shape(planDays(e2, 6)).map((s) => s.split(":")[0])).toEqual(["base*", "base", "transfer", "base", "base", "departure"]);
    expect(planDays(e2, 6)[1].name).toBe("Colombo day");
  });

  it("the preview drops a night at the last base", () => {
    expect(nightsFor(e, 5).map((s) => s.nights)).toEqual([1, 3]);
    expect(allowedLengths(e)).toEqual([6]);
    expect(allowedLengths(sriLanka({ requireFullTrip: false }))).toEqual([6, 5]);
  });
});

describe("day structure — three bases", () => {
  const e = mini();

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
