import { describe, expect, it } from "vitest";
import { defaultRules, lockedNow, parseRules, rulesProblems } from "@/engine/rules";
import { assertSafeInfra, containsBlockedRef, hashRef, infraProblems } from "@/lib/infra-guard";
import { miniPreset } from "../fixtures/mini-preset";
import { presetSchema } from "@/engine/preset-schema";

const preset = presetSchema.parse(miniPreset);

describe("trip rules", () => {
  it("defaults come from the preset", () => {
    const r = defaultRules(preset);
    expect(r.nights).toEqual({ alpha: 1, beta: 2, gamma: 2 });
    expect(r.window).toEqual(preset.dates.window);
  });

  it("keeps good stored fields and drops bad ones", () => {
    const r = parseRules({ peek: false, nights: { alpha: 9, beta: 2, gamma: 2 }, browse: "sometimes" }, preset);
    expect(r.peek).toBe(false);
    expect(r.nights).toEqual({ alpha: 1, beta: 2, gamma: 2 }); // alpha max is 3
    expect(r.browse).toBe("after_submit");
  });

  it("checks the window fits the trip", () => {
    const r = { ...defaultRules(preset), window: { start: "2026-12-01", end: "2026-12-04" } };
    expect(rulesProblems(r, preset)).toContain("The date window must fit a 6-day trip.");
  });

  it("locks by hand or once the auto-lock time passes", () => {
    const r = { ...defaultRules(preset), autoLockAt: "2026-12-01T10:00:00Z" };
    expect(lockedNow(false, r, Date.parse("2026-12-01T09:59:00Z"))).toBe(false);
    expect(lockedNow(false, r, Date.parse("2026-12-01T10:00:00Z"))).toBe(true);
    expect(lockedNow(true, defaultRules(preset))).toBe(true);
  });
});

describe("infra guard", () => {
  const fake = "abcdefghijklmnopqrst";
  const blocked = new Set([hashRef(fake)]);

  it("finds a protected ref anywhere in a URL, in any case", () => {
    expect(containsBlockedRef(`https://${fake}.supabase.co`, blocked)).toBe(true);
    expect(containsBlockedRef(`https://${fake.toUpperCase()}.supabase.co/rest/v1`, blocked)).toBe(true);
    expect(containsBlockedRef("https://zyxwvutsrqponmlkjihg.supabase.co", blocked)).toBe(false);
    expect(containsBlockedRef(undefined, blocked)).toBe(false);
  });

  it("lets an unrelated project boot", () => {
    const env = { SUPABASE_URL: "https://zyxwvutsrqponmlkjihg.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x" };
    expect(infraProblems(env)).toEqual([]);
    expect(() => assertSafeInfra(env)).not.toThrow();
  });
});
