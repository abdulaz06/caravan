// The live Trip rules: organizers change them in the console (stored in
// settings.rules) and they apply without a redeploy. The trip structure
// (Colombo / Galle nights, allowed lengths, date window) is read from here —
// never from constants. The server applies the stored rules at the start of
// each request (lib/server/rules.ts); the client applies the ones its page was
// rendered with (useApplyRules). Shared, pure, no server imports.
import { z } from "zod";
import { CURRENCY_CODES, DEFAULT_CURRENCY, type CurrencyCode } from "./currency";
import { isValidISO } from "./dates";

export type BrowseMode = "after_submit" | "always" | "off";

export type TripRules = {
  /** Edits lock by themselves at this moment (ISO), shown as a countdown. */
  autoLockAt: string | null;
  /** On: only full-length plans can be submitted. Off: the preview length can be submitted too. */
  requireFullTrip: boolean;
  previewEnabled: boolean;
  window: { start: string; end: string };
  colomboNights: number;
  galleNights: number;
  /** On: each slot only offers its area's options (Colombo / on the way / Galle). */
  baseFiltering: boolean;
  browse: BrowseMode;
  peek: boolean;
  spectrum: boolean;
  halalButton: boolean;
  defaultCurrency: CurrencyCode;
  announcement: { on: boolean; text: string };
  /** Content controls (activity ids). */
  hidden: string[];
  recheck: string[];
  featured: string[];
};

export const DEFAULT_RULES: TripRules = {
  autoLockAt: null,
  requireFullTrip: true,
  previewEnabled: true,
  window: { start: "2026-12-01", end: "2027-01-31" },
  colomboNights: 1,
  galleNights: 4,
  baseFiltering: true,
  browse: "after_submit",
  peek: true,
  spectrum: true,
  halalButton: true,
  defaultCurrency: DEFAULT_CURRENCY,
  announcement: { on: false, text: "" },
  hidden: [],
  recheck: [],
  featured: [],
};

export const NIGHTS_LIMITS = { colombo: [1, 3], galle: [2, 6] } as const;
/** Nobody can place a trip outside this, whatever the rules say. */
export const OUTER_WINDOW = { start: "2026-11-01", end: "2027-02-28" } as const;

const isoDate = z.string().refine(isValidISO, "Invalid date");
const ids = z.array(z.string().min(1).max(64)).max(200);

/** Every field optional — a patch from the console, or a stored blob that may be partial. */
export const rulesPatchSchema = z
  .object({
    autoLockAt: z.string().datetime({ offset: true }).nullable(),
    requireFullTrip: z.boolean(),
    previewEnabled: z.boolean(),
    window: z.object({ start: isoDate, end: isoDate }),
    colomboNights: z.number().int().min(NIGHTS_LIMITS.colombo[0]).max(NIGHTS_LIMITS.colombo[1]),
    galleNights: z.number().int().min(NIGHTS_LIMITS.galle[0]).max(NIGHTS_LIMITS.galle[1]),
    baseFiltering: z.boolean(),
    browse: z.enum(["after_submit", "always", "off"]),
    peek: z.boolean(),
    spectrum: z.boolean(),
    halalButton: z.boolean(),
    defaultCurrency: z.enum(CURRENCY_CODES),
    announcement: z.object({ on: z.boolean(), text: z.string().trim().max(280) }),
    hidden: ids,
    recheck: ids,
    featured: ids,
  })
  .partial()
  .strip();

export type RulesPatch = z.infer<typeof rulesPatchSchema>;

/** Problems with a full rule set (empty = fine). */
export function rulesProblems(r: TripRules): string[] {
  const out: string[] = [];
  const len = r.colomboNights + r.galleNights + 1;
  if (r.window.start < OUTER_WINDOW.start || r.window.end > OUTER_WINDOW.end) out.push("The date window must sit between 1 Nov 2026 and 28 Feb 2027.");
  const span = Math.round((Date.parse(r.window.end) - Date.parse(r.window.start)) / 86_400_000) + 1;
  if (span < len) out.push(`The date window must fit a ${len}-day trip.`);
  return out;
}

/** Stored (possibly partial or stale) rules → a complete, valid set. Bad fields fall back to defaults. */
export function parseRules(raw: unknown): TripRules {
  const out: TripRules = structuredClone(DEFAULT_RULES);
  if (!raw || typeof raw !== "object") return out;
  const shape = rulesPatchSchema.shape;
  for (const k of Object.keys(shape) as (keyof typeof shape)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const ok = shape[k].safeParse(v);
    if (ok.success && ok.data !== undefined) (out as Record<string, unknown>)[k] = ok.data;
  }
  return rulesProblems(out).length ? { ...out, window: DEFAULT_RULES.window, colomboNights: 1, galleNights: 4 } : out;
}

export function mergeRules(base: TripRules, patch: RulesPatch): TripRules {
  return { ...base, ...patch } as TripRules;
}

// ── The rules in force ────────────────────────────────────────────────

let active: TripRules = DEFAULT_RULES;

/** Make these the rules in force (server: per request; client: from page props). */
export function applyRules(r: TripRules) {
  active = r;
}

export const currentRules = () => active;

/** Full trip length in days (nights + 1): 6 by default. */
export const tripDays = (r: TripRules = active) => r.colomboNights + r.galleNights + 1;
/** The shorter "preview" length: the last full Galle day removed. */
export const previewDays = (r: TripRules = active) => tripDays(r) - 1;
export const tripWindow = (r: TripRules = active) => r.window;
export const previewAvailable = (r: TripRules = active) => r.previewEnabled && r.galleNights >= 2;
/** Lengths a plan may be saved/submitted at. */
export const allowedLengths = (r: TripRules = active) => (r.requireFullTrip ? [tripDays(r)] : [tripDays(r), previewDays(r)]);
export const isHidden = (id: string, r: TripRules = active) => r.hidden.includes(id);
export const isFeatured = (id: string, r: TripRules = active) => r.featured.includes(id);

/** Locked by hand, or the scheduled auto-lock has passed. */
export function lockedNow(editsLocked: boolean, r: TripRules = active, now = Date.now()): boolean {
  return editsLocked || (!!r.autoLockAt && Date.parse(r.autoLockAt) <= now);
}
