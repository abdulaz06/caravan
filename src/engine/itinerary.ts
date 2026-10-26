// The itinerary data model and pure, immutable editing helpers, shared by the
// browser (the editor) and the server (validation, normalising, migrations).
// Every function takes the trip's engine: the structure comes from the preset
// and the live rules, never from constants.
import { addDays, diffDays } from "@/lib/dates";
import { isCurrency, type CurrencyCode } from "@/lib/currency";
import { STAY_ID, type Activity, type Pair, type Slot, type SpecialDate, type StayIn } from "./catalog";
import { isHidden } from "./rules";
import {
  allowedLengths,
  createEngine,
  isRouteArea,
  planDays,
  previewDays,
  tripDays,
  type DayPlan,
  type Engine,
} from "./structure";

export { STAY_ID };
export const DATA_VERSION = 3;
export const MAX_ITEMS = 8;
export const MAX_ROOMMATES = 3;

export type SlotKind = Slot;
export type Flexibility = string;

/** One activity in a slot: an option id, a Quick extra id, or "stay"; `variant` for options that have them. */
export type SlotItem = { key: string; id: string; pairId?: string; variant?: string };

export type DayEntry = {
  /** Stable id for drag/reorder. */
  id: string;
  day: SlotItem[];
  night: SlotItem[];
  note?: string;
};

export type RoommatePick = { id?: string; name: string };

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
  /**
   * "Who would you share a room with?" — just for fun, up to 3 in order. A
   * participant (`id`, with their name at the time) or someone not on the list
   * yet (name only). Private: organizers only. An empty list means "cleared";
   * a missing key on save means "unchanged".
   */
  roommates?: RoommatePick[];
};

export type BudgetSettings = { excluded?: string[]; accommodation?: boolean };

export type ItineraryData = {
  version: 3;
  startDate: string | null;
  endDate: string | null;
  flexibility: Flexibility | null;
  days: DayEntry[];
  preferences: Preferences;
  budget?: BudgetSettings;
};

export type ItineraryStatus = "draft" | "submitted";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export const emptyDay = (): DayEntry => ({ id: newId(), day: [], night: [] });

export function emptyItinerary(): ItineraryData {
  return { version: DATA_VERSION, startDate: null, endDate: null, flexibility: null, days: [], preferences: {} };
}

const clone = <T,>(x: T): T => structuredClone(x);

// ── Structure of a saved plan ─────────────────────────────────────────

/** The day plans for this itinerary's length. */
export const plansOf = (e: Engine, data: Pick<ItineraryData, "days">): DayPlan[] => planDays(e, data.days.length);
export const planAt = (e: Engine, data: Pick<ItineraryData, "days">, index: number): DayPlan | undefined => plansOf(e, data)[index];
/** The pool a slot draws from, or null (the fly-home day has no slots). */
export const slotArea = (e: Engine, data: Pick<ItineraryData, "days">, index: number, slot: Slot): string | null =>
  planAt(e, data, index)?.areas[slot] ?? null;

// ── Dates ─────────────────────────────────────────────────────────────

export function dateAt(data: Pick<ItineraryData, "startDate">, index: number): string | null {
  return data.startDate ? addDays(data.startDate, index) : null;
}

export function tripLength(data: Pick<ItineraryData, "startDate" | "endDate">): number {
  if (!data.startDate || !data.endDate) return 0;
  return diffDays(data.startDate, data.endDate) + 1;
}

/** Latest start date that keeps a window of `len` days inside the trip window. */
export const lastStart = (e: Engine, len: number) => addDays(e.rules.window.end, -(len - 1));

export function clampStart(e: Engine, start: string, len: number): string {
  if (start < e.rules.window.start) return e.rules.window.start;
  const last = lastStart(e, len);
  return start > last ? last : start;
}

export const canPlace = (e: Engine, start: string, len: number) => start >= e.rules.window.start && start <= lastStart(e, len);

// ── Special dates (e.g. New Year's Eve) ───────────────────────────────

/** The special date falling on a day of the trip, if any. */
export function specialAt(e: Engine, data: Pick<ItineraryData, "startDate">, index: number): SpecialDate | null {
  const date = dateAt(data, index);
  if (!date) return null;
  const md = date.slice(5);
  return e.catalog.specialDates.find((s) => s.date === md) ?? null;
}

/** Every special date inside the trip, with its day. */
export function specialsIn(e: Engine, data: Pick<ItineraryData, "startDate" | "days">): { special: SpecialDate; index: number }[] {
  const out: { special: SpecialDate; index: number }[] = [];
  data.days.forEach((_, i) => {
    const s = specialAt(e, data, i);
    if (s) out.push({ special: s, index: i });
  });
  return out;
}

/** Is this the slot a special date takes over (e.g. 31 Dec's evening)? */
export function isSpecialSlot(e: Engine, data: Pick<ItineraryData, "startDate">, index: number, slot: Slot): SpecialDate | null {
  const s = specialAt(e, data, index);
  return s && s.slot === slot ? s : null;
}

/** The special matchup for a day (null if it's the fly-home day or not special). */
export function specialPairAt(e: Engine, data: Pick<ItineraryData, "startDate" | "days">, index: number): Pair | null {
  const s = specialAt(e, data, index);
  if (!s) return null;
  const area = slotArea(e, data, index, s.slot);
  const pairId = area ? s.pairs[area] : undefined;
  return pairId ? (e.catalog.pairsById[pairId] ?? null) : null;
}

export const isSpecialOption = (e: Engine, id: string) => e.catalog.specialOptionIds.has(id);

// ── Items ─────────────────────────────────────────────────────────────

export type Resolved = { kind: "stay"; stay: StayIn } | { kind: "activity"; activity: Activity };

/** Look up a pick. "Stay in" on a transfer day's route pool is the "straight there" variant. */
export function resolve(e: Engine, item: Pick<SlotItem, "id">, slot: Slot, area?: string | null): Resolved | null {
  if (item.id === STAY_ID) {
    const s = e.catalog.stayIn;
    return { kind: "stay", stay: slot === "day" && isRouteArea(e, area ?? null) && s.transfer ? s.transfer : s[slot] };
  }
  const a = e.catalog.byId[item.id];
  return a ? { kind: "activity", activity: a } : null;
}

export const activityOf = (e: Engine, item: Pick<SlotItem, "id">): Activity | null => e.catalog.byId[item.id] ?? null;

/**
 * Can this id sit in this slot of this day? Special options only on their
 * date's slot; with base-area filtering off (a Trip rule) any pool's option
 * fits; big day trips (`onlyBaseDays`) only on a base's ordinary days, in
 * their own pool. Extras tied to another pick are checked in cleanList.
 */
export function itemAllowed(e: Engine, id: string, slot: Slot, plan: DayPlan | undefined, special: boolean): boolean {
  const area = plan?.areas[slot];
  if (!plan || !area) return false;
  if (id === STAY_ID) return true;
  const a = e.catalog.byId[id];
  // Family stand-ins and family copies are view-only — never saved.
  if (!a || a.kind === "family" || a.familyOf || !a.slots.includes(slot)) return false;
  if (a.onlyBaseDays) return plan.kind === "base" && !plan.arrival && a.areas.includes(area);
  if (e.rules.baseFiltering && !a.areas.includes(area)) return false;
  if (isSpecialOption(e, id)) return special;
  return true;
}

/** A pick with a variant keeps it only if the option defines it (otherwise its first). */
function cleanVariant(e: Engine, id: string, variant: unknown): string | undefined {
  const vs = e.catalog.byId[id]?.variants;
  if (!vs?.length) return undefined;
  return typeof variant === "string" && vs.some((v) => v.id === variant) ? variant : vs[0].id;
}

export function makeItem(e: Engine, id: string, pairId?: string, variant?: string): SlotItem {
  const it: SlotItem = { key: newId(), id };
  if (pairId) it.pairId = pairId;
  const v = cleanVariant(e, id, variant);
  if (v) it.variant = v;
  return it;
}

export function countItems(data: Pick<ItineraryData, "days">): number {
  return data.days.reduce((n, d) => n + d.day.length + d.night.length, 0);
}

/** Slots with at least one item (for "8/10 slots planned"). */
export function filledSlots(e: Engine, data: Pick<ItineraryData, "days">): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  plansOf(e, data).forEach((p, i) => {
    if (!p.hasSlots) return;
    total += 2;
    filled += (data.days[i].day.length ? 1 : 0) + (data.days[i].night.length ? 1 : 0);
  });
  return { filled, total };
}

/** Other days with the same activity in the same slot — the soft "Also on Day 3" hint. */
export function alsoOn(data: Pick<ItineraryData, "days">, slot: Slot, index: number, id: string): number[] {
  const out: number[] = [];
  data.days.forEach((d, i) => {
    if (i !== index && d[slot].some((x) => x.id === id)) out.push(i);
  });
  return out;
}

/** How many times each activity id is used across the trip (for quick-fill variety). */
export function itemCounts(data: Pick<ItineraryData, "days">): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of data.days) for (const x of [...d.day, ...d.night]) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
  return counts;
}

// ── Normalising ───────────────────────────────────────────────────────

/** Any saved slot value → a clean list of items (bounded strings, a key each). */
function toItems(raw: unknown): SlotItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string")
    .map((x) => {
      const it: SlotItem = { key: typeof x.key === "string" && x.key ? x.key.slice(0, 16) : newId(), id: String(x.id).slice(0, 64) };
      if (typeof x.pairId === "string") it.pairId = x.pairId.slice(0, 64);
      if (typeof x.variant === "string") it.variant = x.variant.slice(0, 32);
      return it;
    });
}

function cleanList(e: Engine, items: SlotItem[], slot: Slot, plan: DayPlan, special: boolean): SlotItem[] {
  const keys = new Set<string>();
  const out: SlotItem[] = [];
  for (const it of items) {
    if (!itemAllowed(e, it.id, slot, plan, special)) continue;
    // Extras tied to a pick (e.g. a day trip's extras) need it in the same slot.
    const withId = e.catalog.byId[it.id]?.onlyWith;
    if (withId && !items.some((x) => x.id === withId)) continue;
    const key = keys.has(it.key) ? newId() : it.key;
    keys.add(key);
    const next: SlotItem = { key, id: it.id };
    const variant = cleanVariant(e, it.id, it.variant);
    if (variant) next.variant = variant;
    const pair = it.pairId ? e.catalog.pairsById[it.pairId] : undefined;
    if (pair && (pair.a === it.id || pair.b === it.id)) next.pairId = pair.id;
    out.push(next);
  }
  // Special picks lead their date's slot.
  if (special) out.sort((a, b) => Number(isSpecialOption(e, b.id)) - Number(isSpecialOption(e, a.id)));
  return out.slice(0, MAX_ITEMS);
}

/**
 * Enforce the rules: a fixed length (the full trip, or the preview if
 * allowed), every item valid for its day's slot, special options only on
 * their date, nothing on the fly-home day.
 */
export function normalize(e: Engine, input: ItineraryData, length?: number): ItineraryData {
  const data = clone(input) as ItineraryData;
  if (length === undefined) {
    const saved = input.startDate && input.endDate ? diffDays(input.startDate, input.endDate) + 1 : (input.days?.length ?? 0);
    length = allowedLengths(e).includes(saved) ? saved : tripDays(e);
  }
  data.version = DATA_VERSION;
  data.preferences = data.preferences && typeof data.preferences === "object" ? data.preferences : {};
  if (!data.startDate) {
    data.startDate = null;
    data.endDate = null;
    data.days = [];
  } else {
    data.startDate = clampStart(e, data.startDate, length);
    data.endDate = addDays(data.startDate, length - 1);
    const days = (Array.isArray(data.days) ? data.days : []).slice(0, length);
    while (days.length < length) days.push(emptyDay());
    data.days = days;
  }
  const plans = planDays(e, data.days.length);
  data.days = data.days.map((d, i) => {
    const plan = plans[i];
    const entry: DayEntry = {
      id: typeof d?.id === "string" && d.id ? d.id.slice(0, 40) : newId(),
      day: cleanList(e, toItems(d?.day), "day", plan, !!isSpecialSlot(e, data, i, "day")),
      night: cleanList(e, toItems(d?.night), "night", plan, !!isSpecialSlot(e, data, i, "night")),
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

// ── Editing ───────────────────────────────────────────────────────────

/** The special-slot picks of each special date in the trip, lifted out (they follow their date). */
function liftSpecials(e: Engine, data: ItineraryData): Map<string, SlotItem[]> {
  const carried = new Map<string, SlotItem[]>();
  for (const { special, index } of specialsIn(e, data)) {
    const list = data.days[index][special.slot];
    carried.set(special.id, list.filter((x) => isSpecialOption(e, x.id)));
    data.days[index][special.slot] = list.filter((x) => !isSpecialOption(e, x.id));
  }
  return carried;
}

/**
 * Place the window. Picks stay on the same trip day (Day 1…n); a special
 * date's picks follow the date if it's still inside the window.
 */
export function setStart(e: Engine, input: ItineraryData, start: string, length: number = input.days.length || tripDays(e)): ItineraryData {
  const data = clone(input);
  const carried = data.days.length ? liftSpecials(e, data) : new Map<string, SlotItem[]>();
  data.startDate = clampStart(e, start, length);
  data.endDate = addDays(data.startDate, length - 1);
  if (!data.days.length) data.days = Array.from({ length }, emptyDay);
  for (const { special, index } of specialsIn(e, data)) {
    const back = carried.get(special.id);
    if (back?.length) data.days[index][special.slot] = [...back, ...data.days[index][special.slot]];
  }
  return normalize(e, data, length);
}

function edit(e: Engine, input: ItineraryData, fn: (d: ItineraryData) => void, length = input.days.length || tripDays(e)): ItineraryData {
  const data = clone(input);
  fn(data);
  return normalize(e, data, length);
}

/** Matchup pick: replaces the slot's first item (or starts the list). */
export function pickFirst(e: Engine, input: ItineraryData, index: number, slot: Slot, id: string, pairId?: string, variant?: string): ItineraryData {
  return edit(e, input, (d) => {
    const list = d.days[index][slot];
    const item = makeItem(e, id, pairId, variant);
    if (list.length) list[0] = { ...item, key: list[0].key };
    else list.push(item);
  });
}

/** "+ Add another": appends to the slot. */
export function addItem(e: Engine, input: ItineraryData, index: number, slot: Slot, id: string, pairId?: string, variant?: string): ItineraryData {
  return edit(e, input, (d) => {
    d.days[index][slot].push(makeItem(e, id, pairId, variant));
  });
}

/** Swap one item for another in place (keeps its position). */
export function replaceItem(e: Engine, input: ItineraryData, index: number, slot: Slot, key: string, id: string, pairId?: string, variant?: string): ItineraryData {
  return edit(e, input, (d) => {
    const list = d.days[index][slot];
    const at = list.findIndex((x) => x.key === key);
    if (at >= 0) list[at] = { ...makeItem(e, id, pairId, variant), key };
  });
}

/** Change the variant of a pick in place (e.g. a day trip: sunrise ↔ easy morning). */
export function setVariant(e: Engine, input: ItineraryData, index: number, slot: Slot, key: string, variant: string): ItineraryData {
  return edit(e, input, (d) => {
    const it = d.days[index][slot].find((x) => x.key === key);
    if (it) it.variant = variant;
  });
}

export function removeItem(e: Engine, input: ItineraryData, index: number, slot: Slot, key: string): ItineraryData {
  return edit(e, input, (d) => {
    d.days[index][slot] = d.days[index][slot].filter((x) => x.key !== key);
  });
}

/** Reorder within a slot. */
export function moveItemWithin(e: Engine, input: ItineraryData, index: number, slot: Slot, key: string, to: number): ItineraryData {
  return edit(e, input, (d) => {
    const list = d.days[index][slot];
    const from = list.findIndex((x) => x.key === key);
    if (from < 0) return;
    const [it] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(list.length, to)), 0, it);
  });
}

export function setNote(input: ItineraryData, index: number, note: string): ItineraryData {
  const data = clone(input);
  const trimmed = note.slice(0, 280);
  if (trimmed.trim()) data.days[index].note = trimmed;
  else delete data.days[index].note;
  return data;
}

export function clearAllPicks(input: ItineraryData): ItineraryData {
  const data = clone(input);
  data.days = data.days.map((d) => ({ id: d.id, day: [], night: [], ...(d.note ? { note: d.note } : {}) }));
  return data;
}

/** Whole days can be dragged among the reorderable days of the same base. */
export function canReorder(e: Engine, data: ItineraryData, from: number, to: number): boolean {
  const a = planAt(e, data, from);
  const b = planAt(e, data, to);
  return from !== to && !!a?.reorderable && !!b?.reorderable && a.base.id === b.base.id;
}

/**
 * Drag a whole day to a new position. Contents move, dates stay with
 * positions — except a special date's slot (e.g. 31 Dec's evening), which
 * stays pinned to its date.
 */
export function reorderDays(e: Engine, input: ItineraryData, from: number, to: number): ItineraryData {
  if (!canReorder(e, input, from, to)) return input;
  const data = clone(input);
  const pinned = specialsIn(e, data).map(({ special, index }) => ({ slot: special.slot, index, owner: data.days[index].id }));
  const [moved] = data.days.splice(from, 1);
  data.days.splice(to, 0, moved);
  for (const p of pinned) {
    const now = data.days.findIndex((d) => d.id === p.owner);
    if (now !== p.index) {
      const list = data.days[now][p.slot];
      data.days[now][p.slot] = data.days[p.index][p.slot];
      data.days[p.index][p.slot] = list;
    }
  }
  return normalize(e, data, data.days.length);
}

/**
 * Can a single item move to another day's same slot? Only between slots that
 * draw from the same movable pool; special picks stay on their date.
 */
export function canMoveItem(e: Engine, data: ItineraryData, slot: Slot, from: number, to: number, id: string): boolean {
  if (from === to || to < 0 || to >= data.days.length) return false;
  const a = slotArea(e, data, from, slot);
  const b = slotArea(e, data, to, slot);
  if (!a || a !== b || !e.catalog.areas[a]?.movable) return false;
  if (isSpecialOption(e, id)) return false;
  // An extra tied to a pick can only join a slot that has that pick.
  const withId = e.catalog.byId[id]?.onlyWith;
  if (withId && !data.days[to][slot].some((x) => x.id === withId)) return false;
  return itemAllowed(e, id, slot, planAt(e, data, to), !!isSpecialSlot(e, data, to, slot));
}

/** Move one item to the end of another day's same slot (extras tied to it travel along). */
export function moveItem(e: Engine, input: ItineraryData, slot: Slot, from: number, key: string, to: number): ItineraryData {
  const it = input.days[from]?.[slot].find((x) => x.key === key);
  if (!it || !canMoveItem(e, input, slot, from, to, it.id)) return input;
  return edit(e, input, (d) => {
    const going = d.days[from][slot].filter((x) => x.key === key || e.catalog.byId[x.id]?.onlyWith === it.id);
    d.days[from][slot] = d.days[from][slot].filter((x) => !going.includes(x));
    d.days[to][slot].push(...going);
  });
}

/** Picks the organizers have since hidden ("No longer available"). */
export const isGone = (e: Engine, id: string) => isHidden(e.rules, id);

// ── The shorter preview (a browser-only sandbox unless the rules allow it) ──

/** Copy of the full plan with the last full day at the last base removed. */
export function makePreview(e: Engine, full: ItineraryData): ItineraryData {
  const data = clone(full);
  const len = data.days.length;
  if (len >= 3) data.days = [...data.days.slice(0, len - 2), data.days[len - 1]];
  if (data.startDate) data.endDate = addDays(data.startDate, previewDays(e) - 1);
  return normalize(e, data, previewDays(e));
}

/** A saved short plan back to full length: an empty day goes back in before the fly-home day. */
export function expandToFull(e: Engine, data: ItineraryData): ItineraryData {
  const next = clone(data);
  const len = tripDays(e);
  while (next.days.length < len) next.days.splice(next.days.length - 1, 0, emptyDay());
  if (next.startDate) next.endDate = addDays(next.startDate, len - 1);
  return normalize(e, next, len);
}

/** Full-length plans can be submitted — and the shorter one if the rules allow it (the server checks too). */
export const isSubmittable = (e: Engine, data: ItineraryData) =>
  !!data.startDate && allowedLengths(e).includes(tripLength(data)) && data.days.length === tripLength(data);

// ── Rules changes (console) ───────────────────────────────────────────

export type Restructured = { data: ItineraryData; lost: number; changed: boolean };

const bucketOf = (p: DayPlan) => (p.kind === "departure" ? "departure" : `${p.kind}:${p.base.id}`);

/**
 * Move a plan from one set of Trip rules to another (nights per base, date
 * window, allowed lengths): each base's days map to that base's days, transfer
 * days to transfer days, in order; picks with no home (and special picks that
 * no longer land on their date) are cleared and counted.
 */
export function restructure(input: ItineraryData, from: Engine, to: Engine): Restructured {
  const before = normalize(from, input);
  const oldLen = before.days.length;
  if (!before.startDate) return { data: normalize(to, before), lost: 0, changed: false };
  const buckets = new Map<string, DayEntry[]>();
  planDays(from, oldLen).forEach((p, i) => {
    const k = bucketOf(p);
    buckets.set(k, [...(buckets.get(k) ?? []), before.days[i]]);
  });
  const wasShort = oldLen === previewDays(from) && previewDays(from) !== tripDays(from);
  const len = wasShort && allowedLengths(to).includes(previewDays(to)) ? previewDays(to) : tripDays(to);
  const days = planDays(to, len).map((p) => buckets.get(bucketOf(p))?.shift() ?? emptyDay());
  const next: ItineraryData = { ...clone(before), days };
  next.startDate = clampStart(to, before.startDate, len);
  next.endDate = addDays(next.startDate, len - 1);
  const data = normalize(to, next, len);
  const lost = Math.max(0, countItems(before) - countItems(data));
  const changed = lost > 0 || data.startDate !== before.startDate || data.days.length !== oldLen;
  return { data, lost, changed };
}

export { createEngine };
