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
/** A curated option, picked from one of the A-vs-B pairs. */
export type OptionPick = { pairId: string; optionId: string };
/** "Stay in" — available on every Daytime and Evening slot, any number of times. */
export type StayPick = { type: "stay" };
export type SlotPick = OptionPick | StayPick;

export type DayEntry = {
  id: string; // stable id for drag/reorder
  day: SlotPick | null;
  night: SlotPick | null;
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

export const STAY: StayPick = { type: "stay" };

export const isStay = (p: SlotPick | null | undefined): p is StayPick =>
  !!p && "type" in p && p.type === "stay";

export const isPick = (p: SlotPick | null | undefined): p is OptionPick => !!p && "pairId" in p;

export function optionFor(p: SlotPick | null | undefined): Option | null {
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

/**
 * Other days where the same option (or Stay in) is picked in the same slot —
 * powers the soft "Also on Day 3" hint. Repeats are allowed; this is info only.
 */
export function alsoOn(data: ItineraryData, slot: SlotKind, index: number, pick: SlotPick): number[] {
  const out: number[] = [];
  data.days.forEach((d, i) => {
    if (i === index) return;
    const other = d[slot];
    if (isStay(pick) ? isStay(other) : isPick(other) && other.optionId === (pick as OptionPick).optionId) {
      out.push(i);
    }
  });
  return out;
}

/** How many times each option id is used across the trip (for quick-fill variety). */
export function optionCounts(data: ItineraryData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of data.days) {
    for (const p of [d.day, d.night]) {
      if (isPick(p)) counts.set(p.optionId, (counts.get(p.optionId) ?? 0) + 1);
    }
  }
  return counts;
}

const clone = <T,>(x: T): T => structuredClone(x);

function validPick(p: OptionPick, slot: SlotKind, isNye: boolean): boolean {
  const pair = pairsById[p.pairId];
  const opt = optionsById[p.optionId];
  if (!pair || !opt || (pair.a !== p.optionId && pair.b !== p.optionId)) return false;
  if (slot === "day") return pair.slot === "day";
  return isNye ? pair.id === nyePair.id : pair.slot === "night";
}

/** Upgrade older saved shapes (e.g. `{ type: "chill" }` → Stay in) and drop junk. */
function migratePick(p: unknown): SlotPick | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (o.type === "stay" || o.type === "chill") return { type: "stay" };
  if (typeof o.pairId === "string" && typeof o.optionId === "string") {
    return { pairId: o.pairId, optionId: o.optionId };
  }
  return null;
}

/**
 * Enforce the rules: valid references, the NYE pair only on 31 Dec's evening
 * (and nothing else there except Stay in), day count matching the dates.
 * Options can repeat freely.
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
  const displaced: OptionPick[] = [];

  data.days.forEach((d, i) => {
    d.day = migratePick(d.day);
    d.night = migratePick(d.night);
    if (isPick(d.day) && !validPick(d.day, "day", false)) d.day = null;
    if (isPick(d.night) && !validPick(d.night, "night", i === nye)) {
      // A normal evening that landed on NYE gets re-homed below; anything else is invalid.
      if (i === nye && validPick(d.night, "night", false)) displaced.push(d.night);
      d.night = null;
    }
    if (d.note !== undefined) {
      d.note = String(d.note).slice(0, 280);
      if (!d.note) delete d.note;
    }
  });

  for (const pick of displaced) {
    const slot = data.days.findIndex((d, i) => i !== nye && d.night === null);
    if (slot >= 0) data.days[slot].night = pick;
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

/** Put an option in a slot. Any option can be picked on as many days as you like. */
export function pickOption(input: ItineraryData, index: number, slot: SlotKind, pick: OptionPick): ItineraryData {
  const data = clone(input);
  data.days[index][slot] = { pairId: pick.pairId, optionId: pick.optionId };
  return normalize(data);
}

export function pickStay(input: ItineraryData, index: number, slot: SlotKind): ItineraryData {
  const data = clone(input);
  data.days[index][slot] = { ...STAY };
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
  data.days[a][slot] = data.days[b][slot];
  data.days[b][slot] = tmp;
  return normalize(data);
}

export function clearAllPicks(input: ItineraryData): ItineraryData {
  const data = clone(input);
  data.days = data.days.map((d) => ({ id: d.id, day: null, night: null, ...(d.note ? { note: d.note } : {}) }));
  return data;
}
