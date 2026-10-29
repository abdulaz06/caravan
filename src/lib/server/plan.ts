import "server-only";
import { MODE_COPY, generatePlan, type Ballot, type ConsensusPlan, type PersonResult, type PlanSettings, type PlanSlot } from "@/engine/consensus";
import { isTestName } from "@/lib/test-users";
import { db, isOrganizerRole, type ParticipantRow, type PlanVersionRow, type RsvpRow } from "./db";
import { loadPeople, realPeople, type Person } from "./group";
import type { TripContext } from "./trip";

// The adapter between the consensus engine (pure) and the trip: who votes,
// what each person may see, and RSVPs on the published plan.

/** Everyone with a plan (drafts and submitted) — never test users or demo guests. */
export function ballotsFrom(people: Person[]): Ballot[] {
  return realPeople(people).flatMap((p) => (p.data && p.status !== "new" ? [{ id: p.id, name: p.name, status: p.status, data: p.data }] : []));
}

export async function ballotsOf(trip: TripContext): Promise<Ballot[]> {
  return ballotsFrom(await loadPeople(trip));
}

export function generateFor(trip: TripContext, ballots: Ballot[], settings: Partial<PlanSettings>): ConsensusPlan {
  return generatePlan(trip.engine, ballots, settings);
}

/** "Planned with: Everyone gets a say. Each person was guaranteed some of their picks before the rest went to the most popular." */
export const decidedLine = (plan: ConsensusPlan) => `Planned with: ${MODE_COPY[plan.settings.mode].label}. ${MODE_COPY[plan.settings.mode].line}`;

export type RsvpSummary = {
  in: number;
  skip: number;
  /** Split slots: how many are down for each side. */
  choices: Record<string, number>;
  mine: { status: "in" | "skip"; choice: string | null } | null;
  /** Organizers only. */
  names?: { in: string[]; skip: string[]; choices: Record<string, string[]> };
};

/** The published plan as a traveller sees it: counts only, never who picked what. */
export type PublicPlan = {
  id: string;
  version: number;
  publishedAt: string;
  decided: string;
  mode: ConsensusPlan["settings"]["mode"];
  dates: { start: string; end: string; length: number; lengthReason: string; full: number; withDates: number };
  itinerary: ConsensusPlan["itinerary"];
  slots: (Omit<PlanSlot, "alternatives" | "items" | "split"> & {
    items: Omit<PlanSlot["items"][number], "pickedBy" | "floorFor" | "score">[];
    split: { a: { id: string; votes: number }; b: { id: string; votes: number }; both: number; status: "accepted" } | null;
  })[];
  budget: ConsensusPlan["budget"];
  fairness: { floor: number; floorMet: number; floorOf: number };
  /** This traveller's own result ("Your picks made it"); null for someone without a plan. */
  you: PersonResult | null;
  rsvps: Record<string, RsvpSummary>;
  /** Since the version before: how many items are new or moved. */
  changes: { from: number; changed: number } | null;
};

const strip = (p: PersonResult): PersonResult => ({ ...p, name: "" });

/** Who counts in headcounts: real travellers, plus the viewer themselves (a demo guest or test user sees their own answers). */
const counted = (people: Pick<ParticipantRow, "id" | "display_name" | "guest">[], meId: string | null) =>
  new Map(people.filter((p) => p.id === meId || (!isTestName(p.display_name) && !p.guest)).map((p) => [p.id, p.display_name]));

export function rsvpSummaries(
  plan: ConsensusPlan,
  rows: RsvpRow[],
  people: Pick<ParticipantRow, "id" | "display_name" | "guest">[],
  meId: string | null,
  withNames: boolean,
): Record<string, RsvpSummary> {
  const who = counted(people, meId);
  const out: Record<string, RsvpSummary> = {};
  for (const s of plan.slots) {
    for (const it of s.items) {
      if (it.id === "stay") continue;
      out[it.key] = { in: 0, skip: 0, choices: {}, mine: null, ...(withNames ? { names: { in: [], skip: [], choices: {} } } : {}) };
    }
  }
  for (const r of rows) {
    const sum = out[r.item_key];
    const name = who.get(r.participant_id);
    if (!sum || name === undefined) continue;
    sum[r.status]++;
    if (r.status === "in" && r.choice) sum.choices[r.choice] = (sum.choices[r.choice] ?? 0) + 1;
    if (r.participant_id === meId) sum.mine = { status: r.status, choice: r.choice };
    if (sum.names) {
      sum.names[r.status].push(name);
      if (r.status === "in" && r.choice) (sum.names.choices[r.choice] ??= []).push(name);
    }
  }
  return out;
}

/** Items new or moved since another version (by stable key). */
export function changedSince(plan: ConsensusPlan, before: ConsensusPlan): number {
  const old = new Set(before.slots.flatMap((s) => s.items.map((i) => i.key)));
  return plan.slots.flatMap((s) => s.items).filter((i) => !old.has(i.key)).length;
}

export function publicPlan(row: PlanVersionRow, previous: PlanVersionRow | null, meId: string | null, rsvps: Record<string, RsvpSummary>): PublicPlan {
  const plan = row.data;
  const me = meId ? plan.people.find((p) => p.id === meId) : undefined;
  return {
    id: row.id,
    version: row.version,
    publishedAt: row.published_at!,
    decided: decidedLine(plan),
    mode: plan.settings.mode,
    dates: {
      start: plan.dates.chosen.start,
      end: plan.dates.chosen.end,
      length: plan.dates.length,
      lengthReason: plan.dates.lengthReason,
      full: plan.dates.chosen.full,
      withDates: plan.dates.withDates,
    },
    itinerary: plan.itinerary,
    slots: plan.slots.map(({ alternatives, items, split, ...s }) => {
      void alternatives;
      return {
        ...s,
        items: items.map(({ pickedBy, floorFor, score, ...it }) => {
          void pickedBy;
          void floorFor;
          void score;
          return it;
        }),
        split: split?.status === "accepted" ? { a: split.a, b: split.b, both: split.both, status: "accepted" as const } : null,
      };
    }),
    budget: plan.budget,
    fairness: { floor: plan.fairness.floor, floorMet: plan.fairness.floorMet, floorOf: plan.fairness.floorOf },
    you: me ? strip(me) : null,
    rsvps,
    changes: previous ? { from: previous.version, changed: changedSince(plan, previous.data) } : null,
  };
}

/** The published plan for this viewer (null if nothing's published). Never breaks a page if the tables aren't there yet. */
export async function loadPublicPlan(trip: TripContext, me: ParticipantRow | null): Promise<PublicPlan | null> {
  try {
    const row = await db().getPublishedPlan(trip.trip.id);
    if (!row) return null;
    const [people, rows, versions] = await Promise.all([db().listParticipants(trip.trip.id), db().listRsvps(trip.trip.id), db().listPlanVersions(trip.trip.id, 30)]);
    const previous = versions.filter((v) => v.published_at && v.id !== row.id && v.version < row.version)[0] ?? null;
    const organizer = !!me && isOrganizerRole(me.role ?? "member");
    return publicPlan(row, previous, me?.id ?? null, rsvpSummaries(row.data, rows, people, me?.id ?? null, organizer));
  } catch (e) {
    console.error("couldn't load the group plan", e);
    return null;
  }
}

/** Is there a published plan? (cheap check for banners; false on any error) */
export async function hasPublishedPlan(trip: TripContext): Promise<boolean> {
  try {
    return !!(await db().getPublishedPlan(trip.trip.id));
  } catch {
    return false;
  }
}

// ── The organizers' view ─────────────────────────────────────────────

/** A version without its (large) plan: for the versions list. */
function meta(v: PlanVersionRow) {
  const p = v.data;
  return {
    id: v.id,
    version: v.version,
    createdBy: v.created_by_name,
    createdAt: v.created_at,
    publishedAt: v.published_at,
    mode: p.settings.mode,
    start: p.dates.chosen.start,
    end: p.dates.chosen.end,
    fairness: { min: p.fairness.min, median: p.fairness.median, index: p.fairness.index },
    picksMade: p.people.reduce((n, x) => n + x.made.length, 0),
  };
}
export type VersionMeta = ReturnType<typeof meta>;

/** The organizers' plan state: versions (the latest two in full, to compare), and RSVPs with names. */
export async function organizerPlanState(trip: TripContext) {
  const [versions, rows, people] = await Promise.all([db().listPlanVersions(trip.trip.id, 20), db().listRsvps(trip.trip.id), db().listParticipants(trip.trip.id)]);
  const published = versions.filter((v) => v.published_at).sort((a, b) => b.published_at!.localeCompare(a.published_at!))[0] ?? null;
  return {
    versions: versions.map(meta),
    latest: versions.slice(0, 2).map((v) => ({ id: v.id, version: v.version, plan: v.data })),
    publishedId: published?.id ?? null,
    rsvps: published ? rsvpSummaries(published.data, rows, people, null, true) : {},
  };
}
export type PlanState = Awaited<ReturnType<typeof organizerPlanState>>;
