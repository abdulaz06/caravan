// Adam's Peak (Sri Pada): the one big day trip that reaches beyond ~2.5 hrs.
// Two variants — "sunrise" (overnight drive the evening before) and
// "morning" (4am start, back late). The previous evening's overnight drive is
// derived from the plan, never stored, so it can't go stale when days move.
import { ADAMS_PEAK_SEASON_START, POYA_DAYS, activitiesById, poyaOn, type ActivityVariant } from "@/content";
import { dayLabel, parseISO } from "./dates";
import {
  canMoveItem,
  dateAt,
  removeItem,
  roleAt,
  moveItem,
  type ItineraryData,
  type SlotItem,
} from "./itinerary";

export const PEAK_ID = "adams-peak";

export const peakVariants = (): ActivityVariant[] => activitiesById[PEAK_ID]?.variants ?? [];
export const peakVariant = (id: string | undefined): ActivityVariant | undefined =>
  peakVariants().find((v) => v.id === id) ?? peakVariants()[0];

/** The Adam's Peak pick on a day, if any. */
export function peakOn(data: Pick<ItineraryData, "days">, index: number): { item: SlotItem; variant: ActivityVariant } | null {
  const item = data.days[index]?.day.find((x) => x.id === PEAK_ID);
  const variant = item ? peakVariant(item.variant) : undefined;
  return item && variant ? { item, variant } : null;
}

/** The overnight drive that leaves this evening (the next day is a sunrise climb), if any. */
export function overnightFrom(data: Pick<ItineraryData, "days">, index: number): ActivityVariant | null {
  const next = peakOn(data, index + 1);
  return next?.variant.overnight ? next.variant : null;
}

/** Can Adam's Peak go on this day? Galle days only; the sunrise version also needs a Galle evening before it. */
export function peakPlaceable(data: ItineraryData, index: number, variant?: string): { ok: true } | { ok: false; reason: string } {
  if (roleAt(data, index) !== "galle") return { ok: false, reason: "Adam's Peak fits on the Galle days only" };
  const v = peakVariant(variant);
  if (v?.overnight) {
    const prev = roleAt(data, index - 1);
    if (prev !== "galle" && prev !== "transfer") return { ok: false, reason: "The sunrise climb needs a Galle evening before it" };
  }
  return { ok: true };
}

/** Evening plans that clash with tonight's overnight drive (anything already in that evening). */
export const eveningClash = (data: ItineraryData, index: number): SlotItem[] => (index > 0 ? data.days[index - 1].night : []);

/** Other evenings the clashing picks could move to (Galle evenings that aren't the eve or the climb day). */
export function clashTargets(data: ItineraryData, climbIndex: number, item: SlotItem): number[] {
  const from = climbIndex - 1;
  return data.days
    .map((_, i) => i)
    .filter((i) => i !== from && i !== climbIndex && !overnightFrom(data, i) && canMoveItem(data, "night", from, i, item.id))
    .sort((a, b) => data.days[a].night.length - data.days[b].night.length);
}

export type ClashChoice = "keep" | "move" | "clear";

/** Resolve the clash: keep the early ones, move them to other evenings, or clear them. */
export function resolveClash(data: ItineraryData, climbIndex: number, choice: ClashChoice): ItineraryData {
  const from = climbIndex - 1;
  if (choice === "keep" || from < 0) return data;
  let next = data;
  for (const it of [...data.days[from].night]) {
    if (choice === "clear") {
      next = removeItem(next, from, "night", it.key);
      continue;
    }
    const target = clashTargets(next, climbIndex, it)[0];
    if (target !== undefined) next = moveItem(next, "night", from, it.key, target);
  }
  return next;
}

/** Poya days inside the trip window. */
export function poyaDaysIn(data: Pick<ItineraryData, "startDate" | "endDate">) {
  if (!data.startDate || !data.endDate) return [];
  return POYA_DAYS.filter((p) => p.date >= data.startDate! && p.date <= data.endDate!);
}

const WEEKEND = new Set([0, 6]);

/**
 * Season and crowd warnings for a climb on `index`. The sunrise climb is the
 * night before the date (crowds follow the night), the morning climb that day.
 */
export function peakWarnings(data: ItineraryData, index: number): string[] {
  const peak = peakOn(data, index);
  const date = dateAt(data, index);
  if (!peak || !date) return [];
  const out: string[] = [];
  if (date < ADAMS_PEAK_SEASON_START) {
    out.push(
      `Before pilgrim season — it opens on Unduvap Poya (${dayLabel(ADAMS_PEAK_SEASON_START)}). Until then the path lights are off, the tea stalls are shut and rain is more likely.`,
    );
  }
  const night = peak.variant.overnight ? dateAt(data, index - 1) : null;
  const poya = poyaOn(date) ?? poyaOn(night);
  const weekend = WEEKEND.has(parseISO(date).getUTCDay());
  if (poya) out.push(`${poya.name} — one of the busiest climbs of the year. Expect 5+ hours up and queues near the top.`);
  else if (weekend) out.push("Weekend climb — the steps get extremely crowded (5+ hours up). A weekday is far calmer.");
  return out;
}
