import { describe, expect, it } from "vitest";
import { validatePreset } from "@/engine/validate";
import { freshMini, miniPhotos } from "../fixtures/mini-preset";
import { readPreset } from "./helpers";

const problemsOf = (mutate: (p: ReturnType<typeof freshMini>) => void, photos: Record<string, unknown> = miniPhotos) => {
  const p = freshMini();
  mutate(p);
  return validatePreset(p, photos).problems;
};

describe("validatePreset", () => {
  it("accepts every shipped preset", () => {
    for (const id of ["sri-lanka"]) {
      const { preset, photos } = readPreset(id);
      const v = validatePreset(preset, photos);
      expect(v.problems).toEqual([]);
      expect(v.ok).toBe(true);
    }
  });

  it("accepts the three-base test preset", () => {
    expect(validatePreset(freshMini(), miniPhotos).problems).toEqual([]);
  });

  it("reports schema errors with their path", () => {
    const problems = problemsOf((p) => {
      (p.activities[0] as Record<string, unknown>).vibe = 5;
      (p as Record<string, unknown>).surprise = true;
    });
    expect(problems.some((m) => m.includes("activities.0.vibe"))).toBe(true);
    expect(problems.some((m) => m.includes("surprise"))).toBe(true);
  });

  it("catches references to things that don't exist", () => {
    const problems = problemsOf((p) => {
      p.activities[0].areas = ["nowhere"];
      p.pairs[0].b = "missing-option";
      p.structure.bases[1].region = "atlantis";
    });
    expect(problems).toContain('a-day-1: unknown area "nowhere"');
    expect(problems).toContain('Pair "p-a-day" references unknown option "missing-option"');
    expect(problems).toContain('Base "beta" is in unknown region "atlantis"');
  });

  it("checks matchups pair options of the right slot and pool", () => {
    const problems = problemsOf((p) => {
      p.pairs[0].b = "a-night-1";
      p.pairs[3].a = "c-day-1";
    });
    expect(problems).toContain(`Option "a-night-1" isn't a day option but pair "p-a-day" is`);
    expect(problems).toContain(`Option "c-day-1" isn't valid in "b" (pair "p-b-day")`);
  });

  it("requires bases to chain up with transfers", () => {
    const problems = problemsOf((p) => {
      p.structure.transfers[1].from = "alpha";
    });
    expect(problems).toContain('Transfer 2 should go from "beta" to "gamma"');
  });

  it("requires a family-friendly stand-in for every nightlife item", () => {
    const problems = problemsOf((p) => {
      delete (p.activities[3] as Record<string, unknown>).familySwap;
    });
    expect(problems).toContain("Nightlife item a-night-2 needs a familySwap");
  });

  it("refuses copy that family mode would show with drinks or nightlife in it", () => {
    const problems = problemsOf((p) => {
      p.activities[0].description = "Ends at a cocktail bar.";
    });
    expect(problems.some((m) => m.startsWith('Family mode would show "cocktail, bar" for a-day-1'))).toBe(true);
  });

  it("checks the date window fits the default trip", () => {
    const problems = problemsOf((p) => {
      p.dates.window = { start: "2026-12-01", end: "2026-12-03" };
    });
    expect(problems).toContain("dates.window must fit the 6-day default trip");
  });

  it("treats a missing activity photo as a warning, a missing base photo as a problem", () => {
    const photos = { ...miniPhotos };
    delete photos["a-day-1"];
    delete photos["base-beta"];
    const v = validatePreset(freshMini(), photos);
    expect(v.warnings.some((w) => w.startsWith("a-day-1: no photo"))).toBe(true);
    expect(v.problems).toContain('Base "beta" has no photo "base-beta"');
  });
});
