// Itinerary data model + pure, immutable editing helpers. Shared by the
// client (editor) and the server (validation/normalisation).
import {
  MAX_TRIP_DAYS,
  NYE_DATE,
  TRIP_WINDOW,
  addOnsById,
  allPairs,
  nyePairs,
  optionsById,
  pairsById,
  type BaseId,
  type Option,
} from "@/content";
import { isCurrency, type CurrencyCode } from "./currency";
import { addDays, dateRange, diffDays } from "./dates";

export const DATA_VERSION = 2;
export const MAX_ADDONS = 6;

export type Flexibility = "exact" | "few_days" | "very";
export type SlotKind = "day" | "night";
export type TransportMode = "train" | "road";
/** A curated option, picked from one of the A-vs-B pairs. */
export type OptionPick = { pairId: string; optionId: string; addOns?: string[]; transport?: TransportMode };
/** "Stay in" — available on every Daytime and Evening slot, any number of times. */
export type StayPick = { type: "stay"; addOns?: string[] };
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
  currency?: CurrencyCode;
};

export type BudgetSettings = { excluded?: string[]; accommodation?: boolean };

export type ItineraryData = {
  version: 1 | 2;
  startDate: string | null;
  endDate: string | null;
  flexibility: Flexibility | null;
  days: DayEntry[]; // dates and base derive from index + startDate + length
  preferences: Preferences;
  budget?: BudgetSettings;
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
    version: DATA_VERSION,
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

// ── Bases ─────────────────────────────────────────────────────────────

/** Colombo days = max(1, round(0.3 × n)) (round half up); the rest are Galle days. */
export function colomboDayCount(n: number): number {
  if (n <= 0) return 0;
  return Math.max(1, Math.floor((3 * n + 5) / 10));
}

export function baseSplit(n: number): { colombo: number; galle: number } {
  const colombo = colomboDayCount(n);
  return { colombo, galle: Math.max(0, n - colombo) };
}

export function baseOfIndex(n: number, index: number): BaseId {
  return index < colomboDayCount(n) ? "colombo" : "galle";
}

export function baseAt(data: ItineraryData, index: number): BaseId {
  return baseOfIndex(data.days.length || tripLength(data), index);
}

/** Index of the first Galle day (the transfer day), or -1 if the trip never reaches Galle. */
export function transferIndex(data: ItineraryData): number {
  const n = data.days.length;
  const c = colomboDayCount(n);
  return c < n ? c : -1;
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

/** Add-ons that can attach to a slot on a given base. */
export function addOnAllowed(id: string, base: BaseId, slot: SlotKind): boolean {
  const a = addOnsById[id];
  return !!a && a.base === base && a.slots.includes(slot);
}

const clone = <T,>(x: T): T => structuredClone(x);

function validPick(p: OptionPick, slot: SlotKind, base: BaseId, isNye: boolean): boolean {
  const pair = pairsById[p.pairId];
  const opt = optionsById[p.optionId];
  if (!pair || !opt || (pair.a !== p.optionId && pair.b !== p.optionId)) return false;
  if (pair.base !== base || opt.base !== base) return false;
  if (slot === "day") return pair.slot === "day";
  return isNye ? pair.id === nyePairs[base].id : pair.slot === "night";
}

/**
 * Upgrade older saved shapes and drop junk:
 * `{ type: "chill" }` → Stay in; a pick whose pair was renamed (e.g. the old
 * single "nye" pair) is re-pointed at whichever pair now contains the option.
 */
function migratePick(p: unknown): SlotPick | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const addOns = Array.isArray(o.addOns) ? o.addOns.filter((x): x is string => typeof x === "string") : undefined;
  if (o.type === "stay" || o.type === "chill") return addOns?.length ? { type: "stay", addOns } : { type: "stay" };
  if (typeof o.pairId === "string" && typeof o.optionId === "string") {
    let pairId = o.pairId;
    const pair = pairsById[pairId];
    if (!pair || (pair.a !== o.optionId && pair.b !== o.optionId)) {
      const home = allPairs.find((x) => x.a === o.optionId || x.b === o.optionId);
      if (home) pairId = home.id;
    }
    const out: OptionPick = { pairId, optionId: o.optionId };
    if (addOns?.length) out.addOns = addOns;
    if (o.transport === "train" || o.transport === "road") out.transport = o.transport;
    return out;
  }
  return null;
}

function cleanPick(p: SlotPick, slot: SlotKind, base: BaseId): SlotPick {
  const addOns = [...new Set(p.addOns ?? [])].filter((id) => addOnAllowed(id, base, slot)).slice(0, MAX_ADDONS);
  if (isStay(p)) return addOns.length ? { type: "stay", addOns } : { type: "stay" };
  const out: OptionPick = { pairId: p.pairId, optionId: p.optionId };
  if (addOns.length) out.addOns = addOns;
  const opt = optionsById[p.optionId];
  if (opt?.transport) out.transport = p.transport === "road" ? "road" : "train";
  return out;
}

/**
 * Enforce the rules: valid references, every pick in its day's base, the NYE
 * pair only on 31 Dec's evening (and nothing else there except Stay in), add-ons
 * that match the base and time of day, and a day count matching the dates.
 * Options can repeat freely.
 */
export function normalize(input: ItineraryData): ItineraryData {
  const data = clone(input);
  data.version = DATA_VERSION;
  data.preferences = data.preferences ?? {};
  const len = tripLength(data);
  if (len > 0) {
    while (data.days.length < len) data.days.push(emptyDay());
    if (data.days.length > len) data.days = data.days.slice(0, len);
  } else {
    data.days = [];
  }
  const n = data.days.length;
  const nye = nyeIndex(data);
  const displaced: { pick: OptionPick; base: BaseId }[] = [];

  data.days.forEach((d, i) => {
    const base = baseOfIndex(n, i);
    d.day = migratePick(d.day);
    d.night = migratePick(d.night);
    if (isPick(d.day) && !validPick(d.day, "day", base, false)) d.day = null;
    if (isPick(d.night) && !validPick(d.night, "night", base, i === nye)) {
      // A normal evening that landed on NYE gets re-homed below; anything else is invalid.
      if (i === nye && validPick(d.night, "night", base, false)) displaced.push({ pick: d.night, base });
      d.night = null;
    }
    if (d.day) d.day = cleanPick(d.day, "day", base);
    if (d.night) d.night = cleanPick(d.night, "night", base);
    if (d.note !== undefined) {
      d.note = String(d.note).slice(0, 280);
      if (!d.note) delete d.note;
    }
  });

  for (const { pick, base } of displaced) {
    const slot = data.days.findIndex((d, i) => i !== nye && d.night === null && baseOfIndex(n, i) === base);
    if (slot >= 0) data.days[slot].night = pick;
  }

  if (data.preferences.currency !== undefined && !isCurrency(data.preferences.currency)) {
    delete data.preferences.currency;
  }
  if (data.budget) {
    const excluded = [...new Set((data.budget.excluded ?? []).filter((x) => typeof x === "string"))].slice(0, 300);
    const next: BudgetSettings = {};
    if (excluded.length) next.excluded = excluded;
    if (data.budget.accommodation === false) next.accommodation = false;
    if (Object.keys(next).length) data.budget = next;
    else delete data.budget;
  }
  return data;
}

/**
 * How many picks a v1 (pre-bases) itinerary loses when normalised — used to
 * show the one-time "we've locked in Colombo + Galle" note.
 */
export function migrationLoss(raw: ItineraryData): number {
  if (raw.version === DATA_VERSION) return 0;
  const before = raw.days.reduce((n, d) => n + (d?.day ? 1 : 0) + (d?.night ? 1 : 0), 0);
  return Math.max(0, before - countPicks(normalize(raw)));
}

/**
 * Change the trip dates. The base split is recomputed and days keep their
 * place within their base: Colombo days stay Colombo days (in order), same for
 * Galle; extra days are added empty, surplus days drop off the end of a base.
 */
export function setDates(input: ItineraryData, start: string, end: string): ItineraryData {
  const data = clone(input);
  const oldC = colomboDayCount(data.days.length);
  const oldColombo = data.days.slice(0, oldC);
  const oldGalle = data.days.slice(oldC);
  const { colombo, galle } = baseSplit(dateRange(start, end).length);
  const pad = (list: DayEntry[], k: number) => {
    const out = list.slice(0, k);
    while (out.length < k) out.push(emptyDay());
    return out;
  };
  const days = [...pad(oldColombo, colombo), ...pad(oldGalle, galle)];
  return normalize({ ...data, startDate: start, endDate: end, days });
}

export function canSetRange(start: string, end: string): boolean {
  const len = diffDays(start, end) + 1;
  return start >= TRIP_WINDOW.start && end <= TRIP_WINDOW.end && len >= 1 && len <= MAX_TRIP_DAYS;
}

/** Put an option in a slot. Any option can be picked on as many days as you like. */
export function pickOption(input: ItineraryData, index: number, slot: SlotKind, pick: OptionPick): ItineraryData {
  const data = clone(input);
  const prev = data.days[index][slot];
  const next: OptionPick = { pairId: pick.pairId, optionId: pick.optionId };
  if (prev?.addOns?.length) next.addOns = prev.addOns;
  if (pick.transport) next.transport = pick.transport;
  data.days[index][slot] = next;
  return normalize(data);
}

export function pickStay(input: ItineraryData, index: number, slot: SlotKind): ItineraryData {
  const data = clone(input);
  const prev = data.days[index][slot];
  data.days[index][slot] = prev?.addOns?.length ? { type: "stay", addOns: prev.addOns } : { ...STAY };
  return normalize(data);
}

export function setAddOns(input: ItineraryData, index: number, slot: SlotKind, addOns: string[]): ItineraryData {
  const data = clone(input);
  const p = data.days[index][slot];
  if (!p) return input;
  if (addOns.length) p.addOns = addOns;
  else delete p.addOns;
  return normalize(data);
}

export function setTransport(input: ItineraryData, index: number, slot: SlotKind, mode: TransportMode): ItineraryData {
  const data = clone(input);
  const p = data.days[index][slot];
  if (!isPick(p)) return input;
  p.transport = mode;
  return normalize(data);
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

/** Can a day be dragged from one position to another? Only within the same base. */
export function canReorder(data: ItineraryData, from: number, to: number): boolean {
  return from !== to && baseAt(data, from) === baseAt(data, to);
}

/**
 * Drag a whole day to a new position within its base. Contents move, dates
 * stay attached to positions — except the 31 Dec evening, which stays pinned.
 */
export function reorderDays(input: ItineraryData, from: number, to: number): ItineraryData {
  if (!canReorder(input, from, to)) return input;
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

/** Can a single slot be moved/swapped between these two days? Same base, NYE evening pinned. */
export function canSwapSlot(data: ItineraryData, slot: SlotKind, a: number, b: number): boolean {
  if (a === b || baseAt(data, a) !== baseAt(data, b)) return false;
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
