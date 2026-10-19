// Itinerary data model + pure, immutable editing helpers. Shared by the
// client (editor) and the server (validation/normalisation).
//
// The trip is fixed at 6 days · 5 nights (group vote):
//   Day 1 · Land in Colombo      — Colombo daytime + evening (only Colombo day)
//   Day 2 · Road trip to Galle   — en-route stops (daytime) + Galle evening
//   Days 3–5 · Galle base        — Galle daytime + evening
//   Day 6 · Check out & fly home — no slots
// A 5-day preview (Day 5 removed) exists only in the browser.
import {
  NYE_DATE,
  PREVIEW_DAYS,
  TRIP_DAYS,
  TRIP_WINDOW,
  activitiesById,
  allPairs,
  nyePairs,
  pairsById,
  stayIn,
  type Activity,
  type StayIn,
  type Where,
} from "@/content";
import { isCurrency, type CurrencyCode } from "./currency";
import { addDays, diffDays } from "./dates";

export const DATA_VERSION = 3;
export const MAX_ITEMS = 8;

export type Flexibility = "exact" | "few_days" | "very";
export type SlotKind = "day" | "night";

/** One activity in a slot: an option id, a Quick extra id, or "stay". */
export type SlotItem = { key: string; id: string; pairId?: string };

export type DayEntry = {
  id: string; // stable id for drag/reorder
  day: SlotItem[];
  night: SlotItem[];
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
  version: 1 | 2 | 3;
  startDate: string | null;
  endDate: string | null;
  flexibility: Flexibility | null;
  days: DayEntry[];
  preferences: Preferences;
  budget?: BudgetSettings;
};

export type ItineraryStatus = "draft" | "submitted";

export const STAY_ID = "stay";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export const emptyDay = (): DayEntry => ({ id: newId(), day: [], night: [] });

export function emptyItinerary(): ItineraryData {
  return { version: DATA_VERSION, startDate: null, endDate: null, flexibility: null, days: [], preferences: {} };
}

const clone = <T,>(x: T): T => structuredClone(x);

// ── Trip structure ─────────────────────────────────────────────────────

export type DayRole = "colombo" | "transfer" | "galle" | "departure";

export function dayRole(index: number, length: number): DayRole {
  if (index === 0) return "colombo";
  if (index === length - 1) return "departure";
  if (index === 1) return "transfer";
  return "galle";
}

export const roleAt = (data: Pick<ItineraryData, "days">, index: number) => dayRole(index, data.days.length);

export const DAY_NAMES: Record<DayRole, string> = {
  colombo: "Land in Colombo",
  transfer: "Road trip to Galle",
  galle: "Galle base",
  departure: "Check out & fly home",
};

/** Which pool a slot draws from, or null for Day 6 (no slots). */
export function slotWhere(role: DayRole, slot: SlotKind): Where | null {
  if (role === "departure") return null;
  if (role === "colombo") return "colombo";
  if (role === "transfer") return slot === "day" ? "enroute" : "galle";
  return "galle";
}

export const hasSlots = (role: DayRole) => role !== "departure";

/** Nights per place: Colombo 1, Galle the rest (4 — or 3 in the preview). */
export function nights(length: number): { colombo: number; galle: number; total: number } {
  if (length <= 1) return { colombo: 0, galle: 0, total: 0 };
  return { colombo: 1, galle: length - 2, total: length - 1 };
}

export const daysNightsLabel = (n: number) => `${n} ${n === 1 ? "day" : "days"} · ${n - 1} ${n - 1 === 1 ? "night" : "nights"}`;

export const isPreviewLength = (n: number) => n === PREVIEW_DAYS;

// ── Dates ──────────────────────────────────────────────────────────────

export function dateAt(data: ItineraryData, index: number): string | null {
  return data.startDate ? addDays(data.startDate, index) : null;
}

export function tripLength(data: Pick<ItineraryData, "startDate" | "endDate">): number {
  if (!data.startDate || !data.endDate) return 0;
  return diffDays(data.startDate, data.endDate) + 1;
}

/** Latest start date that keeps a window of `len` days inside the trip window. */
export const lastStart = (len: number) => addDays(TRIP_WINDOW.end, -(len - 1));

export function clampStart(start: string, len: number): string {
  if (start < TRIP_WINDOW.start) return TRIP_WINDOW.start;
  const last = lastStart(len);
  return start > last ? last : start;
}

export const canPlace = (start: string, len: number) => start >= TRIP_WINDOW.start && start <= lastStart(len);

/** Index of 31 Dec inside the trip, or -1. */
export function nyeIndex(data: Pick<ItineraryData, "startDate" | "days">): number {
  if (!data.startDate) return -1;
  const i = diffDays(data.startDate, NYE_DATE);
  return i >= 0 && i < data.days.length ? i : -1;
}

/** The NYE pair for whichever day 31 Dec lands on (null if it's the fly-home day or outside the trip). */
export function nyePairAt(data: ItineraryData): typeof nyePairs.colombo | null {
  const i = nyeIndex(data);
  if (i < 0) return null;
  const where = slotWhere(roleAt(data, i), "night");
  return where === "colombo" ? nyePairs.colombo : where === "galle" ? nyePairs.galle : null;
}

const NYE_IDS = new Set([nyePairs.colombo.a, nyePairs.colombo.b, nyePairs.galle.a, nyePairs.galle.b]);
export const isNyeOption = (id: string) => NYE_IDS.has(id);

// ── Items ──────────────────────────────────────────────────────────────

export type Resolved = { kind: "stay"; stay: StayIn } | { kind: "activity"; activity: Activity };

export function resolve(item: Pick<SlotItem, "id">, slot: SlotKind, where?: Where | null): Resolved | null {
  if (item.id === STAY_ID) return { kind: "stay", stay: where === "enroute" ? stayIn.enroute : stayIn[slot] };
  const a = activitiesById[item.id];
  return a ? { kind: "activity", activity: a } : null;
}

export const activityOf = (item: Pick<SlotItem, "id">): Activity | null => activitiesById[item.id] ?? null;

/** Can this id sit in this slot? NYE options only on 31 Dec's evening. */
export function itemAllowed(id: string, slot: SlotKind, where: Where | null, isNyeNight: boolean): boolean {
  if (!where) return false;
  if (id === STAY_ID) return true;
  const a = activitiesById[id];
  if (!a || !a.slots.includes(slot) || !a.where.includes(where)) return false;
  if (isNyeOption(id)) return slot === "night" && isNyeNight;
  return true;
}

export const makeItem = (id: string, pairId?: string): SlotItem => (pairId ? { key: newId(), id, pairId } : { key: newId(), id });

export function countItems(data: Pick<ItineraryData, "days">): number {
  return data.days.reduce((n, d) => n + d.day.length + d.night.length, 0);
}

/** Slots with at least one item (for "8/10 slots planned"). */
export function filledSlots(data: Pick<ItineraryData, "days">): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  data.days.forEach((d, i) => {
    if (!hasSlots(dayRole(i, data.days.length))) return;
    total += 2;
    filled += (d.day.length ? 1 : 0) + (d.night.length ? 1 : 0);
  });
  return { filled, total };
}

/** Other days with the same activity in the same slot — the soft "Also on Day 3" hint. */
export function alsoOn(data: ItineraryData, slot: SlotKind, index: number, id: string): number[] {
  const out: number[] = [];
  data.days.forEach((d, i) => {
    if (i !== index && d[slot].some((x) => x.id === id)) out.push(i);
  });
  return out;
}

/** How many times each activity id is used across the trip (for quick-fill variety). */
export function itemCounts(data: ItineraryData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of data.days) for (const x of [...d.day, ...d.night]) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
  return counts;
}

// ── Normalising & migration ────────────────────────────────────────────

/** Turn any saved slot shape (v3 list, or v1/v2 single pick + add-ons) into a list. */
function toItems(raw: unknown): SlotItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((x) => typeof x.id === "string")
      .map((x) => {
        const it: SlotItem = { key: typeof x.key === "string" && x.key ? x.key.slice(0, 16) : newId(), id: String(x.id).slice(0, 64) };
        if (typeof x.pairId === "string") it.pairId = x.pairId.slice(0, 64);
        return it;
      });
  }
  if (typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const addOns = Array.isArray(o.addOns) ? o.addOns.filter((x): x is string => typeof x === "string") : [];
  const head: SlotItem[] = [];
  if (o.type === "stay" || o.type === "chill") head.push(makeItem(STAY_ID));
  else if (typeof o.optionId === "string") head.push(makeItem(o.optionId, typeof o.pairId === "string" ? o.pairId : undefined));
  return [...head, ...addOns.map((id) => makeItem(id))];
}

const legacyCount = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return Array.isArray(raw) ? raw.length : 0;
  const o = raw as Record<string, unknown>;
  return (o.type || o.optionId ? 1 : 0) + (Array.isArray(o.addOns) ? o.addOns.length : 0);
};

function cleanList(items: SlotItem[], slot: SlotKind, where: Where | null, isNyeNight: boolean): SlotItem[] {
  const keys = new Set<string>();
  const out: SlotItem[] = [];
  for (const it of items) {
    if (!itemAllowed(it.id, slot, where, isNyeNight)) continue;
    const key = keys.has(it.key) ? newId() : it.key;
    keys.add(key);
    const next: SlotItem = { key, id: it.id };
    const pair = it.pairId ? pairsById[it.pairId] : undefined;
    if (pair && (pair.a === it.id || pair.b === it.id)) next.pairId = pair.id;
    else if (it.pairId) {
      // An older pair id (e.g. the single "nye" pair) — re-point at whichever pair holds the option now.
      const home = allPairs.find((p) => (p.a === it.id || p.b === it.id) && p.where === where);
      if (home) next.pairId = home.id;
    }
    out.push(next);
  }
  // NYE options lead the 31 Dec evening.
  if (isNyeNight) out.sort((a, b) => Number(isNyeOption(b.id)) - Number(isNyeOption(a.id)));
  return out.slice(0, MAX_ITEMS);
}

/**
 * Enforce the rules: a fixed length (6 days, or 5 for the preview), every
 * item valid for its day's slot, NYE options only on 31 Dec's evening, nothing
 * on the fly-home day. Older (v1/v2) shapes are upgraded on the way through.
 */
export function normalize(input: ItineraryData, length: number = TRIP_DAYS): ItineraryData {
  const data = clone(input) as ItineraryData;
  data.version = DATA_VERSION;
  data.preferences = data.preferences ?? {};
  if (!data.startDate) {
    data.startDate = null;
    data.endDate = null;
    data.days = [];
  } else {
    data.startDate = clampStart(data.startDate, length);
    data.endDate = addDays(data.startDate, length - 1);
    const days = (data.days ?? []).slice(0, length);
    while (days.length < length) days.push(emptyDay());
    data.days = days;
  }
  const n = data.days.length;
  const nye = nyeIndex(data);
  data.days = data.days.map((d, i) => {
    const role = dayRole(i, n);
    const entry: DayEntry = {
      id: typeof d?.id === "string" && d.id ? d.id.slice(0, 40) : newId(),
      day: cleanList(toItems(d?.day), "day", slotWhere(role, "day"), false),
      night: cleanList(toItems(d?.night), "night", slotWhere(role, "night"), i === nye),
    };
    const note = typeof d?.note === "string" ? d.note.slice(0, 280) : "";
    if (note.trim()) entry.note = note;
    return entry;
  });

  if (data.preferences.currency !== undefined && !isCurrency(data.preferences.currency)) delete data.preferences.currency;
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
 * How many picks an older itinerary (v1/v2) loses when it's moved onto the
 * fixed 6-day structure — drives the one-time "the group voted" note.
 * Returns -1 when the data is already current (no note).
 */
export function migrationLoss(raw: ItineraryData): number {
  if (raw.version === DATA_VERSION) return -1;
  const before = (raw.days ?? []).reduce((n, d) => n + legacyCount(d?.day) + legacyCount(d?.night), 0);
  return Math.max(0, before - countItems(normalize(raw)));
}

// ── Editing ────────────────────────────────────────────────────────────

/**
 * Place the window. Picks stay on the same trip day (Day 1…6); the 31 Dec
 * evening's NYE pick follows 31 Dec if it's still inside the window.
 */
export function setStart(input: ItineraryData, start: string, length: number = TRIP_DAYS): ItineraryData {
  const data = clone(input);
  const oldNye = nyeIndex(data);
  const carried = oldNye >= 0 ? data.days[oldNye].night.filter((x) => isNyeOption(x.id)) : [];
  if (oldNye >= 0) data.days[oldNye].night = data.days[oldNye].night.filter((x) => !isNyeOption(x.id));
  data.startDate = clampStart(start, length);
  data.endDate = addDays(data.startDate, length - 1);
  if (!data.days.length) data.days = Array.from({ length }, emptyDay);
  const newNye = nyeIndex(data);
  if (newNye >= 0 && carried.length) data.days[newNye].night = [...carried, ...data.days[newNye].night];
  return normalize(data, length);
}

function edit(input: ItineraryData, fn: (d: ItineraryData) => void, length = input.days.length || TRIP_DAYS): ItineraryData {
  const data = clone(input);
  fn(data);
  return normalize(data, length);
}

/** Matchup pick: replaces the slot's first item (or starts the list). */
export function pickFirst(input: ItineraryData, index: number, slot: SlotKind, id: string, pairId?: string): ItineraryData {
  return edit(input, (d) => {
    const list = d.days[index][slot];
    const item = makeItem(id, pairId);
    if (list.length) list[0] = { ...item, key: list[0].key };
    else list.push(item);
  });
}

/** "+ Add another": appends to the slot. */
export function addItem(input: ItineraryData, index: number, slot: SlotKind, id: string, pairId?: string): ItineraryData {
  return edit(input, (d) => {
    d.days[index][slot].push(makeItem(id, pairId));
  });
}

/** Swap one item for another in place (keeps its position). */
export function replaceItem(input: ItineraryData, index: number, slot: SlotKind, key: string, id: string, pairId?: string): ItineraryData {
  return edit(input, (d) => {
    const list = d.days[index][slot];
    const at = list.findIndex((x) => x.key === key);
    if (at >= 0) list[at] = { ...makeItem(id, pairId), key };
  });
}

export function removeItem(input: ItineraryData, index: number, slot: SlotKind, key: string): ItineraryData {
  return edit(input, (d) => {
    d.days[index][slot] = d.days[index][slot].filter((x) => x.key !== key);
  });
}

/** Reorder within a slot. */
export function moveItemWithin(input: ItineraryData, index: number, slot: SlotKind, key: string, to: number): ItineraryData {
  return edit(input, (d) => {
    const list = d.days[index][slot];
    const from = list.findIndex((x) => x.key === key);
    if (from < 0) return;
    const [it] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(list.length, to)), 0, it);
  });
}

export function clearSlot(input: ItineraryData, index: number, slot: SlotKind): ItineraryData {
  const data = clone(input);
  data.days[index][slot] = [];
  return data;
}

export function setNote(input: ItineraryData, index: number, note: string): ItineraryData {
  const data = clone(input);
  const trimmed = note.slice(0, 280);
  if (trimmed.trim()) data.days[index].note = trimmed;
  else delete data.days[index].note;
  return data;
}

/** Whole days can be dragged among the Galle days (3–5) only. */
export function canReorder(data: ItineraryData, from: number, to: number): boolean {
  return from !== to && roleAt(data, from) === "galle" && roleAt(data, to) === "galle";
}

/**
 * Drag a whole Galle day to a new position. Contents move, dates stay with
 * positions — except 31 Dec's evening, which stays pinned to 31 Dec.
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
  return normalize(data, data.days.length);
}

/**
 * Can a single item move from one day's slot to another day's same slot?
 * Only between slots drawing from the same pool: Galle days ↔ Galle days,
 * and Day 2's evening ↔ Galle evenings. NYE picks stay on 31 Dec.
 */
export function canMoveItem(data: ItineraryData, slot: SlotKind, from: number, to: number, id: string): boolean {
  if (from === to || to < 0 || to >= data.days.length) return false;
  const a = slotWhere(roleAt(data, from), slot);
  const b = slotWhere(roleAt(data, to), slot);
  if (!a || a !== b || a !== "galle") return false;
  if (isNyeOption(id)) return false;
  return itemAllowed(id, slot, b, slot === "night" && to === nyeIndex(data));
}

/** Move one item to the end of another day's same slot. */
export function moveItem(input: ItineraryData, slot: SlotKind, from: number, key: string, to: number): ItineraryData {
  const it = input.days[from]?.[slot].find((x) => x.key === key);
  if (!it || !canMoveItem(input, slot, from, to, it.id)) return input;
  return edit(input, (d) => {
    d.days[from][slot] = d.days[from][slot].filter((x) => x.key !== key);
    d.days[to][slot].push(it);
  });
}

export function clearAllPicks(input: ItineraryData): ItineraryData {
  const data = clone(input);
  data.days = data.days.map((d) => ({ id: d.id, day: [], night: [], ...(d.note ? { note: d.note } : {}) }));
  return data;
}

// ── 5-day preview (browser-only sandbox) ───────────────────────────────

/** Copy of the 6-day plan with Day 5 (the last full Galle day) removed. */
export function makePreview(full: ItineraryData): ItineraryData {
  const data = clone(full);
  if (data.days.length === TRIP_DAYS) data.days = [...data.days.slice(0, 4), data.days[5]];
  if (data.startDate) data.endDate = addDays(data.startDate, PREVIEW_DAYS - 1);
  return normalize(data, PREVIEW_DAYS);
}

/** Only 6-day plans can be submitted (the server checks too). */
export const isSubmittable = (data: ItineraryData) =>
  !!data.startDate && tripLength(data) === TRIP_DAYS && data.days.length === TRIP_DAYS;
