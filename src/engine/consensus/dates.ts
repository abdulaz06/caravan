// Choosing the group's dates. Every traveller with dates is free on their own
// range; a candidate window of `length` days is scored, in order:
//   1. how many travellers are free for the whole window,
//   2. the person-days it covers (Σ days each traveller is there),
//   3. the fewest people missing more than one day,
//   4. the earliest start (a stable tie-break).
// Pure and deterministic; used by the generator and the group heatmap.
import { addDays, dateRange, diffDays } from "@/lib/dates";

/** A traveller's free dates (their plan's start and end, inclusive). */
export type Availability = { id: string; start: string; end: string };

export type WindowScore = {
  start: string;
  end: string;
  length: number;
  /** Travellers free for every day of it. */
  full: number;
  /** Σ over travellers of the days they're there. */
  personDays: number;
  /** Travellers missing more than one day. */
  missingMany: number;
  /** Who'd miss which days (organizer-only; travellers see counts). */
  missing: { id: string; days: string[] }[];
};

/** The lower median (so the length is always one somebody picked). Null for no lengths. */
export function medianLength(lengths: number[]): number | null {
  if (!lengths.length) return null;
  const sorted = [...lengths].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

const overlap = (a: Availability, start: string, end: string) => {
  const s = a.start > start ? a.start : start;
  const e = a.end < end ? a.end : end;
  return s > e ? 0 : diffDays(s, e) + 1;
};

/** Score one window. */
export function scoreWindow(people: Availability[], start: string, length: number): WindowScore {
  const end = addDays(start, length - 1);
  let full = 0;
  let personDays = 0;
  let missingMany = 0;
  const missing: WindowScore["missing"] = [];
  for (const p of people) {
    const there = overlap(p, start, end);
    personDays += there;
    if (there === length) full++;
    else {
      if (length - there > 1) missingMany++;
      missing.push({ id: p.id, days: dateRange(start, end).filter((d) => d < p.start || d > p.end) });
    }
  }
  return { start, end, length, full, personDays, missingMany, missing };
}

/** Best first: whole-window travellers, person-days, fewest missing more than a day, then the earliest. */
export function compareWindows(a: WindowScore, b: WindowScore): number {
  return b.full - a.full || b.personDays - a.personDays || a.missingMany - b.missingMany || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
}

/** Every window of `length` days inside the bounds, best first. */
export function scoreWindows(people: Availability[], bounds: { start: string; end: string }, length: number): WindowScore[] {
  const last = addDays(bounds.end, -(length - 1));
  const out: WindowScore[] = [];
  for (let s = bounds.start; s <= last; s = addDays(s, 1)) out.push(scoreWindow(people, s, length));
  return out.sort(compareWindows);
}

/**
 * The best window and up to `runners` runners-up, each starting at least
 * two days from the ones already chosen (so they're real alternatives,
 * not the same week nudged by a day).
 */
export function pickWindows(
  people: Availability[],
  bounds: { start: string; end: string },
  length: number,
  runners = 3,
): { best: WindowScore | null; runnersUp: WindowScore[] } {
  const ranked = scoreWindows(people, bounds, length);
  const chosen: WindowScore[] = [];
  for (const w of ranked) {
    if (chosen.length > runners) break;
    if (chosen.every((c) => Math.abs(diffDays(c.start, w.start)) >= 2)) chosen.push(w);
  }
  return { best: chosen[0] ?? null, runnersUp: chosen.slice(1) };
}

/** One trip length's best window: who's free for all of it, and the person-days it covers. */
export type LengthOption = { length: number; start: string; end: string; full: number; personDays: number };

/** The best window for each length (lengths that don't fit inside the bounds are left out). */
export function lengthOptions(people: Availability[], bounds: { start: string; end: string }, lengths: number[]): LengthOption[] {
  const span = diffDays(bounds.start, bounds.end) + 1;
  return lengths
    .filter((n) => n >= 1 && n <= span)
    .map((n) => {
      const w = scoreWindows(people, bounds, n)[0];
      return { length: n, start: w.start, end: w.end, full: w.full, personDays: w.personDays };
    });
}

/**
 * The length that best balances trip length against full attendance:
 * the most "people free for every day × days", among lengths of at least
 * `minLength` (the trip's suggested minimum). Ties: more people free for
 * all of it, then more person-days, then the shorter trip.
 */
export function recommendLength(options: LengthOption[], minLength: number): LengthOption | null {
  const eligible = options.filter((o) => o.length >= minLength && o.full > 0);
  if (!eligible.length) return null;
  return [...eligible].sort(
    (a, b) => b.full * b.length - a.full * a.length || b.full - a.full || b.personDays - a.personDays || a.length - b.length,
  )[0];
}
