// Itinerary data model + pure, immutable editing helpers. Shared by the
// client (editor) and the server (validation/normalisation).
import {
  MAX_TRIP_DAYS,
  NYE_DATE,
  TRIP_WINDOW,
  nyePair,
  optionsById,
  pairsById,
  type Option,
} from "@/content";
import { addDays, dateRange, diffDays } from "./dates";

export type Flexibility = "exact" | "few_days" | "very";
export type SlotKind = "day" | "night";
export type DayPick = { pairId: string; optionId: string };
export type ChillPick = { type: "chill" };
export type NightPick = DayPick | ChillPick;

export type DayEntry = {
  id: string; // stable id for drag/reorder
  day: DayPick | null;
  night: NightPick | null;
  note?: string;
};

export type Preferences = {
  budget?: string;
  stay?: string;
  sharedRooms?: string;
  interests?: string[];
  earlyMornings?: string;
  transport?: string;
  dietary?: string[];
  dietaryOther?: string;
  flyingFrom?: string;
  mustDo?: string;
  hardNo?: string;
  suggestions?: string;
  notes?: string;
};

export type ItineraryData = {
  version: 1;
  startDate: string | null;
  endDate: string | null;
  flexibility: Flexibility | null;
  days: DayEntry[]; // dates derive from index + startDate
  preferences: Preferences;
};

export type ItineraryStatus = "draft" | "submitted";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function emptyDay(): DayEntry {
  return { id: newId(), day: null, night: null };
}

export function emptyItinerary(): ItineraryData {
  return {
    version: 1,
    startDate: null,
    endDate: null,
    flexibility: null,
    days: [],
    preferences: {},
  };
}

export const isChill = (n: NightPick | null | undefined): n is ChillPick =>
  !!n && "type" in n && n.type === "chill";

export const isPick = (p: DayPick | NightPick | null | undefined): p is DayPick =>
  !!p && "pairId" in p;

export function optionFor(p: DayPick | NightPick | null | undefined): Option | null {
  return isPick(p) ? (optionsById[p.optionId] ?? null) : null;
}

export function dateAt(data: ItineraryData, index: number): string | null {
  return data.startDate ? addDays(data.startDate, index) : null;
}

export function tripLength(data: Pick<ItineraryData, "startDate" | "endDate">): number {
  if (!data.startDate || !data.endDate) return 0;
  return diffDays(data.startDate, data.endDate) + 1;
}

/** Index of 31 Dec inside the trip, or -1. */
export function nyeIndex(data: ItineraryData): number {
  if (!data.startDate || !data.endDate) return -1;
  const i = diffDays(data.startDate, NYE_DATE);
  return i >= 0 && i < data.days.length ? i : -1;
}

export function hasContent(d: DayEntry): boolean {
  return !!(d.day || d.night || d.note?.trim());
}

export function countPicks(data: ItineraryData): number {
  return data.days.reduce((n, d) => n + (d.day ? 1 : 0) + (d.night ? 1 : 0), 0);
}

/** Where each pair is currently used: pairId -> { index, slot } */
export function pairUsage(data: ItineraryData): Map<string, { index: number; slot: SlotKind }> {
  const used = new Map<string, { index: number; slot: SlotKind }>();
  data.days.forEach((d, index) => {
    if (d.day) used.set(d.day.pairId, { index, slot: "day" });
    if (isPick(d.night)) used.set(d.night.pairId, { index, slot: "night" });
  });
  return used;
}

const clone = <T,>(x: T): T => structuredClone(x);

function validPick(p: DayPick, slot: SlotKind, isNye: boolean): boolean {
  const pair = pairsById[p.pairId];
  const opt = optionsById[p.optionId];
  if (!pair || !opt || (pair.a !== p.optionId && pair.b !== p.optionId)) return false;
  if (slot === "day") return pair.slot === "day";
  return isNye ? pair.id === nyePair.id : pair.slot === "night";
}

/**
 * Enforce every rule: valid references, pairs used once, NYE pair only on
 * 31 Dec (and only the NYE pair there), day count matching the dates.
 */
export function normalize(input: ItineraryData): ItineraryData {
  const data = clone(input);
  const len = tripLength(data);
  if (len > 0) {
    while (data.days.length < len) data.days.push(emptyDay());
    if (data.days.length > len) data.days = data.days.slice(0, len);
  } else {
    data.days = [];
  }
  const nye = nyeIndex(data);
  const displaced: DayPick[] = [];
  const seen = new Set<string>();

  data.days.forEach((d, i) => {
    if (d.day && (!validPick(d.day, "day", false) || seen.has(d.day.pairId))) d.day = null;
    if (d.day) seen.add(d.day.pairId);

    if (isPick(d.night)) {
      const ok = validPick(d.night, "night", i === nye);
      if (!ok && i === nye && validPick(d.night, "night", false)) {
        displaced.push(d.night); // a normal night landed on NYE — try to rehome it
        d.night = null;
      } else if (!ok || seen.has(d.night.pairId)) {
        d.night = null;
      }
    } else if (d.night && !isChill(d.night)) {
      d.night = null;
    }
    if (isPick(d.night)) seen.add(d.night.pairId);
    if (d.note !== undefined) {
      d.note = d.note.slice(0, 280);
      if (!d.note) delete d.note;
    }
  });

  for (const pick of displaced) {
    if (seen.has(pick.pairId)) continue;
    const slot = data.days.findIndex((d, i) => i !== nye && d.night === null);
    if (slot >= 0) {
      data.days[slot].night = pick;
      seen.add(pick.pairId);
    }
  }
  return data;
}

/** Change the trip dates, keeping picks on overlapping dates and re-homing the rest. */
export function setDates(input: ItineraryData, start: string, end: string): ItineraryData {
  const data = clone(input);
  const oldDates = data.startDate && data.endDate ? dateRange(data.startDate, data.endDate) : [];
  const byDate = new Map(oldDates.map((d, i) => [d, data.days[i]]));
  const newDates = dateRange(start, end);
  const kept = new Set<DayEntry>();
  const days = newDates.map((d) => {
    const existing = byDate.get(d);
    if (existing) kept.add(existing);
    return existing ?? emptyDay();
  });
  const leftovers = data.days.filter((d) => d && !kept.has(d) && hasContent(d));
  for (let i = 0; i < days.length && leftovers.length; i++) {
    if (!hasContent(days[i])) days[i] = leftovers.shift()!;
  }
  return normalize({ ...data, startDate: start, endDate: end, days });
}

export function canSetRange(start: string, end: string): boolean {
  const len = diffDays(start, end) + 1;
  return (
    start >= TRIP_WINDOW.start &&
    end <= TRIP_WINDOW.end &&
    len >= 1 &&
    len <= MAX_TRIP_DAYS
  );
}

/**
 * Pick an option for a slot. If its pair is already used on another day, the
 * pair moves here and that day gets whatever was here before (a swap).
 */
export function pickOption(
  input: ItineraryData,
  index: number,
  slot: SlotKind,
  pick: DayPick,
): ItineraryData {
  const data = clone(input);
  const usage = pairUsage(data).get(pick.pairId);
  const current = data.days[index][slot];
  if (usage && !(usage.index === index && usage.slot === slot)) {
    const other = data.days[usage.index];
    if (usage.slot === "day") other.day = slot === "day" ? (current as DayPick | null) : null;
    else other.night = slot === "night" ? current : null;
  }
  if (slot === "day") data.days[index].day = pick;
  else data.days[index].night = pick;
  return normalize(data);
}

export function pickChill(input: ItineraryData, index: number): ItineraryData {
  const data = clone(input);
  data.days[index].night = { type: "chill" };
  return data;
}

export function clearSlot(input: ItineraryData, index: number, slot: SlotKind): ItineraryData {
  const data = clone(input);
  data.days[index][slot] = null;
  return data;
}

export function setNote(input: ItineraryData, index: number, note: string): ItineraryData {
  const data = clone(input);
  const trimmed = note.slice(0, 280);
  if (trimmed.trim()) data.days[index].note = trimmed;
  else delete data.days[index].note;
  return data;
}

/**
 * Drag a whole day to a new position. Contents move, dates stay attached to
 * positions — except the 31 Dec evening, which stays pinned to New Year's Eve.
 */
export function reorderDays(input: ItineraryData, from: number, to: number): ItineraryData {
  if (from === to) return input;
  const data = clone(input);
  const nye = nyeIndex(data);
  const pinnedOwner = nye >= 0 ? data.days[nye].id : null;
  const [moved] = data.days.splice(from, 1);
  data.days.splice(to, 0, moved);
  if (pinnedOwner && nye >= 0) {
    const m = data.days.findIndex((d) => d.id === pinnedOwner);
    if (m !== nye) {
      const pinned = data.days[m].night;
      data.days[m].night = data.days[nye].night;
      data.days[nye].night = pinned;
    }
  }
  return normalize(data);
}

/** Can a single slot be moved/swapped between these two days? */
export function canSwapSlot(data: ItineraryData, slot: SlotKind, a: number, b: number): boolean {
  if (a === b) return false;
  if (slot === "day") return true;
  const nye = nyeIndex(data);
  return a !== nye && b !== nye;
}

/** Move one Daytime/Evening pick to another day's same slot (swapping contents). */
export function swapSlot(input: ItineraryData, slot: SlotKind, a: number, b: number): ItineraryData {
  if (!canSwapSlot(input, slot, a, b)) return input;
  const data = clone(input);
  const tmp = data.days[a][slot];
  (data.days[a] as Record<SlotKind, unknown>)[slot] = data.days[b][slot];
  (data.days[b] as Record<SlotKind, unknown>)[slot] = tmp;
  return normalize(data);
}

export function clearAllPicks(input: ItineraryData): ItineraryData {
  const data = clone(input);
  data.days = data.days.map((d) => ({ id: d.id, day: null, night: null, ...(d.note ? { note: d.note } : {}) }));
  return data;
}
