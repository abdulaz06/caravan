// The live Trip rules: organizers change them in the console and they apply
// without a redeploy. The preset sets the defaults (date window, trip lengths,
// nights per base); the stored rules override them per trip. Pure — the
// server parses them per request and the browser gets them from page props.
//
// Dates are free by default: everyone picks their own start and end inside
// the window, any length from `length.min` to `length.max`. "Fixed trip
// length" (off by default) makes the trip one length — the nights per base —
// with an optional shorter preview.
import { z } from "zod";
import { CURRENCY_CODES, isCurrency, type CurrencyCode } from "@/lib/currency";
import { isValidISO } from "@/lib/dates";
import type { TripPreset } from "./preset-schema";

export type BrowseMode = "after_submit" | "always" | "off";

export type LengthRange = { min: number; max: number };

/** The longest trip anyone can pick, whatever the preset or rules say. */
export const MAX_TRIP_DAYS = 30;

export type TripRules = {
  /** Edits lock by themselves at this moment (ISO), shown as a countdown. */
  autoLockAt: string | null;
  /** Off (the default): free dates, any length in `length`. On: one length, set by the nights per base. */
  fixedLength: boolean;
  /** Free dates: the shortest and longest trip, in days. */
  length: LengthRange;
  /** Free dates: "Most groups do 5–7 days" (days), or none. */
  recommended: LengthRange | null;
  /** Fixed length — on: only full-length plans can be submitted. Off: the preview length can be submitted too. */
  requireFullTrip: boolean;
  /** Fixed length: the shorter "try it" length on the dates step. */
  previewEnabled: boolean;
  window: { start: string; end: string };
  /** Fixed length: nights at each base (preset base id → nights). */
  nights: Record<string, number>;
  /** On: each slot only offers its own pool's options. */
  baseFiltering: boolean;
  browse: BrowseMode;
  peek: boolean;
  spectrum: boolean;
  /** The family-friendly switch on the review page. */
  familyButton: boolean;
  /** 🔥 "Popular · 7 picked" badges on the most-picked options. */
  popularBadges: boolean;
  defaultCurrency: CurrencyCode;
  announcement: { on: boolean; text: string };
  /** Content controls (activity ids). */
  hidden: string[];
  recheck: string[];
  featured: string[];
};

export function defaultRules(preset: TripPreset): TripRules {
  return {
    autoLockAt: null,
    fixedLength: false,
    length: { ...preset.dates.length },
    recommended: preset.dates.recommended ? { ...preset.dates.recommended } : null,
    requireFullTrip: true,
    previewEnabled: preset.structure.preview,
    window: { ...preset.dates.window },
    nights: Object.fromEntries(preset.structure.bases.map((b) => [b.id, b.nights.default])),
    baseFiltering: true,
    browse: "after_submit",
    peek: true,
    spectrum: true,
    familyButton: true,
    popularBadges: true,
    defaultCurrency: isCurrency(preset.currency.default) ? preset.currency.default : "USD",
    announcement: { on: false, text: "" },
    hidden: [],
    recheck: [],
    featured: [],
  };
}

const isoDate = z.string().refine(isValidISO, "Invalid date");
const ids = z.array(z.string().min(1).max(64)).max(300);
const days = z.number().int().min(1).max(MAX_TRIP_DAYS);
const lengthRange = z.object({ min: days, max: days }).refine((r) => r.min <= r.max, "The shortest trip must be no longer than the longest");

/** Every field optional — a patch from the console, or a stored blob that may be partial. */
export function rulesPatchSchema(preset: TripPreset) {
  const nights = z.strictObject(
    Object.fromEntries(preset.structure.bases.map((b) => [b.id, z.number().int().min(b.nights.min).max(b.nights.max)])),
  );
  return z
    .object({
      autoLockAt: z.string().datetime({ offset: true }).nullable(),
      fixedLength: z.boolean(),
      length: lengthRange,
      recommended: lengthRange.nullable(),
      requireFullTrip: z.boolean(),
      previewEnabled: z.boolean(),
      window: z.object({ start: isoDate, end: isoDate }),
      nights,
      baseFiltering: z.boolean(),
      browse: z.enum(["after_submit", "always", "off"]),
      peek: z.boolean(),
      spectrum: z.boolean(),
      familyButton: z.boolean(),
      popularBadges: z.boolean(),
      defaultCurrency: z.enum(CURRENCY_CODES),
      announcement: z.object({ on: z.boolean(), text: z.string().trim().max(280) }),
      hidden: ids,
      recheck: ids,
      featured: ids,
    })
    .partial()
    .strip();
}

export type RulesPatch = Partial<TripRules>;

/** The fixed trip length: every base's nights + 1. */
export const fixedLengthOf = (r: Pick<TripRules, "nights">) => Object.values(r.nights).reduce((a, b) => a + b, 0) + 1;

/** Problems with a full rule set (empty = fine). */
export function rulesProblems(r: TripRules, preset: TripPreset): string[] {
  const out: string[] = [];
  const outer = preset.dates.outer;
  if (r.window.start > r.window.end) out.push("The date window ends before it starts.");
  if (r.window.start < outer.start || r.window.end > outer.end) out.push(`The date window must sit between ${outer.start} and ${outer.end}.`);
  const span = Math.round((Date.parse(r.window.end) - Date.parse(r.window.start)) / 86_400_000) + 1;
  if (r.fixedLength) {
    if (span < fixedLengthOf(r)) out.push(`The date window must fit a ${fixedLengthOf(r)}-day trip.`);
  } else {
    if (r.length.min > r.length.max) out.push("The shortest trip must be no longer than the longest.");
    if (span < r.length.min) out.push(`The date window must fit a ${r.length.min}-day trip.`);
    if (r.recommended && (r.recommended.min < r.length.min || r.recommended.max > r.length.max)) {
      out.push(`The suggested length must sit between ${r.length.min} and ${r.length.max} days.`);
    }
  }
  return out;
}

/** Stored (possibly partial or stale) rules → a complete, valid set. Bad fields fall back to the preset's defaults. */
export function parseRules(raw: unknown, preset: TripPreset): TripRules {
  const defaults = defaultRules(preset);
  const out: TripRules = structuredClone(defaults);
  if (!raw || typeof raw !== "object") return out;
  const shape = rulesPatchSchema(preset).shape;
  for (const k of Object.keys(shape) as (keyof typeof shape)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const ok = shape[k].safeParse(v);
    if (ok.success && ok.data !== undefined) (out as Record<string, unknown>)[k] = ok.data;
  }
  if (!rulesProblems(out, preset).length) return out;
  // Something structural doesn't hold together: fall back to the preset's dates and lengths.
  return { ...out, window: defaults.window, nights: defaults.nights, length: defaults.length, recommended: defaults.recommended };
}

export function mergeRules(base: TripRules, patch: RulesPatch): TripRules {
  return { ...base, ...patch } as TripRules;
}

/** Locked by hand, or the scheduled auto-lock has passed. */
export function lockedNow(editsLocked: boolean, r: TripRules, now = Date.now()): boolean {
  return editsLocked || (!!r.autoLockAt && Date.parse(r.autoLockAt) <= now);
}

export const isHidden = (r: TripRules, id: string) => r.hidden.includes(id);
export const isFeatured = (r: TripRules, id: string) => r.featured.includes(id);
