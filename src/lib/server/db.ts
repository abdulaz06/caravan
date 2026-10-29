import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ConsensusPlan, PlanSettings } from "@/engine/consensus/types";
import type { ItineraryData, ItineraryStatus } from "@/engine/itinerary";
import { assertSafeInfra } from "@/lib/infra-guard";

// All database access lives here and only runs on the server, using the
// Supabase secret key (RLS is on with no public policies, so the anon key can
// read nothing). Everything belongs to a trip. In local development and tests
// a JSON file under .data/ stands in for the database.

export type Role = "owner" | "admin" | "member";
export type TripKind = "live" | "demo";

export type TripRow = {
  id: string;
  slug: string;
  name: string;
  preset_id: string;
  edits_locked: boolean;
  rules: unknown;
  kind: TripKind;
  creator_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type NewTrip = Pick<TripRow, "slug" | "name" | "preset_id"> & Partial<Pick<TripRow, "kind" | "creator_hash" | "rules">>;

export type ParticipantRow = {
  id: string;
  trip_id: string;
  display_name: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  role: Role;
  /** A demo guest ("Try it as a guest"), removed when the demo resets. */
  guest: boolean;
  created_at: string;
};

/** The last organizer edit or rules migration of someone's plan, shown to them once. */
export type Stamp = {
  kind: "edit" | "rules";
  by: string;
  byId?: string | null;
  at: string;
  seen?: boolean;
  /** Rules migrations: picks that needed clearing. */
  lost?: number;
  text?: string;
};

export type ItineraryRow = {
  participant_id: string;
  data: ItineraryData;
  status: ItineraryStatus;
  submitted_at: string | null;
  updated_at: string;
  stamp?: Stamp | null;
};

/** A save writes these fields only — never the organizer stamp, unless given. */
export type ItinerarySave = Omit<ItineraryRow, "stamp"> & { stamp?: Stamp | null };

export type LogEntry = {
  id: string;
  trip_id: string;
  at: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
};
export type NewLogEntry = Omit<LogEntry, "id" | "at">;

export type NewParticipant = { name: string; pinHash: string; role?: Role; guest?: boolean };

/** A saved version of the group plan (the generator's output and the knobs that made it). */
export type PlanVersionRow = {
  id: string;
  trip_id: string;
  version: number;
  data: ConsensusPlan;
  settings: PlanSettings;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  /** Set when it's the plan travellers see (the latest published version wins). */
  published_at: string | null;
};
export type NewPlanVersion = Pick<PlanVersionRow, "trip_id" | "data" | "settings" | "created_by" | "created_by_name"> & { published_at?: string | null };

/** "I'm in" / "I'll skip" on one item of the published plan (`choice`: which side of a split). */
export type RsvpStatus = "in" | "skip";
export type RsvpRow = { trip_id: string; item_key: string; participant_id: string; status: RsvpStatus; choice: string | null; updated_at: string };

export const roleOf = (p: Pick<ParticipantRow, "role"> | null | undefined): Role => p?.role ?? "member";
export const isOrganizerRole = (r: Role) => r === "owner" || r === "admin";

export interface Store {
  // Trips
  createTrip(trip: NewTrip): Promise<TripRow | null>;
  getTrip(id: string): Promise<TripRow | null>;
  getTripBySlug(slug: string): Promise<TripRow | null>;
  updateTrip(id: string, patch: Partial<Pick<TripRow, "name" | "edits_locked" | "rules">>): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  /** Moves a trip to a new slug; false when another trip already has it (the demo's swap-in). */
  renameTrip(id: string, slug: string): Promise<boolean>;
  /** Trips whose slug starts with a prefix (the demo's leftover builds). */
  listTripsBySlugPrefix(prefix: string): Promise<TripRow[]>;
  /** Trips created from a (hashed) address since a moment — for rate limiting. */
  countTripsCreated(creatorHash: string | null, since: string): Promise<number>;
  // People
  listParticipants(tripId: string): Promise<ParticipantRow[]>;
  getParticipant(id: string): Promise<ParticipantRow | null>;
  findParticipantByName(tripId: string, name: string): Promise<ParticipantRow | null>;
  /** Returns null when the (case-insensitive) name is already taken on this trip. */
  createParticipant(tripId: string, p: NewParticipant): Promise<ParticipantRow | null>;
  updateParticipant(id: string, patch: Partial<Pick<ParticipantRow, "pin_hash" | "failed_attempts" | "locked_until" | "role">>): Promise<void>;
  deleteParticipant(id: string): Promise<void>;
  // Itineraries
  getItinerary(participantId: string): Promise<ItineraryRow | null>;
  /** Upserts only the fields given (a person's own save never touches the organizer stamp). */
  saveItinerary(row: ItinerarySave): Promise<ItineraryRow>;
  setStamp(participantId: string, stamp: Stamp | null): Promise<void>;
  listItineraries(tripId: string): Promise<ItineraryRow[]>;
  // Organizer log & peeks
  addLog(entry: NewLogEntry): Promise<void>;
  listLog(tripId: string, limit: number): Promise<LogEntry[]>;
  /** Counts a peek; `first` = this person had never peeked at that plan before. */
  recordPeek(peekerId: string, targetId: string): Promise<{ first: boolean }>;
  countPeekers(targetId: string): Promise<number>;
  // The group plan
  /** Newest first. */
  listPlanVersions(tripId: string, limit: number): Promise<PlanVersionRow[]>;
  /** The plan travellers see: the latest published version. */
  getPublishedPlan(tripId: string): Promise<PlanVersionRow | null>;
  /** Saves the next version number for the trip. */
  savePlanVersion(row: NewPlanVersion): Promise<PlanVersionRow>;
  publishPlanVersion(tripId: string, id: string, at: string): Promise<PlanVersionRow | null>;
  listRsvps(tripId: string): Promise<RsvpRow[]>;
  /** Upserts one person's answer on one item (null status clears it). */
  setRsvp(row: Omit<RsvpRow, "updated_at" | "status"> & { status: RsvpStatus | null }): Promise<void>;
  /** Many answers at once (the demo seed). */
  addRsvps(rows: Omit<RsvpRow, "updated_at">[]): Promise<void>;
}

// ── Supabase ──────────────────────────────────────────────────────────

class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  private fail(error: { message: string } | null): void {
    if (error) throw new Error(`Database error: ${error.message}`);
  }

  async createTrip(trip: NewTrip) {
    const { data, error } = await this.sb.from("trips").insert(trip).select("*").single();
    if (error?.code === "23505") return null; // slug taken
    this.fail(error);
    return data as TripRow;
  }

  async getTrip(id: string) {
    const { data, error } = await this.sb.from("trips").select("*").eq("id", id).maybeSingle();
    this.fail(error);
    return (data as TripRow) ?? null;
  }

  async getTripBySlug(slug: string) {
    const { data, error } = await this.sb.from("trips").select("*").eq("slug", slug).maybeSingle();
    this.fail(error);
    return (data as TripRow) ?? null;
  }

  async updateTrip(id: string, patch: Partial<Pick<TripRow, "name" | "edits_locked" | "rules">>) {
    const { error } = await this.sb
      .from("trips")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    this.fail(error);
  }

  async deleteTrip(id: string) {
    const { error } = await this.sb.from("trips").delete().eq("id", id);
    this.fail(error);
  }

  async renameTrip(id: string, slug: string) {
    const { error } = await this.sb.from("trips").update({ slug, updated_at: new Date().toISOString() }).eq("id", id);
    if (error?.code === "23505") return false; // slug taken
    this.fail(error);
    return true;
  }

  async listTripsBySlugPrefix(prefix: string) {
    const { data, error } = await this.sb.from("trips").select("*").like("slug", `${prefix.replace(/[%_\\]/g, "\\$&")}%`);
    this.fail(error);
    return (data as TripRow[]) ?? [];
  }

  async countTripsCreated(creatorHash: string | null, since: string) {
    let q = this.sb.from("trips").select("*", { count: "exact", head: true }).gte("created_at", since);
    if (creatorHash) q = q.eq("creator_hash", creatorHash);
    const { count, error } = await q;
    this.fail(error);
    return count ?? 0;
  }

  async listParticipants(tripId: string) {
    const { data, error } = await this.sb
      .from("participants")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    this.fail(error);
    return (data ?? []) as ParticipantRow[];
  }

  async getParticipant(id: string) {
    const { data, error } = await this.sb.from("participants").select("*").eq("id", id).maybeSingle();
    this.fail(error);
    return (data as ParticipantRow) ?? null;
  }

  async findParticipantByName(tripId: string, name: string) {
    const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await this.sb
      .from("participants")
      .select("*")
      .eq("trip_id", tripId)
      .ilike("display_name", escaped)
      .limit(1);
    this.fail(error);
    return ((data ?? [])[0] as ParticipantRow) ?? null;
  }

  async createParticipant(tripId: string, p: NewParticipant) {
    const { data, error } = await this.sb
      .from("participants")
      .insert({ trip_id: tripId, display_name: p.name, pin_hash: p.pinHash, role: p.role ?? "member", guest: !!p.guest })
      .select("*")
      .single();
    if (error?.code === "23505") return null; // unique violation on (trip_id, lower(display_name))
    this.fail(error);
    return data as ParticipantRow;
  }

  async updateParticipant(id: string, patch: Partial<ParticipantRow>) {
    const { error } = await this.sb.from("participants").update(patch).eq("id", id);
    this.fail(error);
  }

  async deleteParticipant(id: string) {
    const { error } = await this.sb.from("participants").delete().eq("id", id);
    this.fail(error);
  }

  async getItinerary(participantId: string) {
    const { data, error } = await this.sb.from("itineraries").select("*").eq("participant_id", participantId).maybeSingle();
    this.fail(error);
    return (data as ItineraryRow) ?? null;
  }

  async saveItinerary(row: ItinerarySave) {
    const { data, error } = await this.sb.from("itineraries").upsert(row, { onConflict: "participant_id" }).select("*").single();
    this.fail(error);
    return data as ItineraryRow;
  }

  async setStamp(participantId: string, stamp: Stamp | null) {
    const { error } = await this.sb.from("itineraries").update({ stamp }).eq("participant_id", participantId);
    this.fail(error);
  }

  async listItineraries(tripId: string) {
    // Itineraries belong to a trip through their participant.
    const { data, error } = await this.sb.from("itineraries").select("*, participants!inner(trip_id)").eq("participants.trip_id", tripId);
    this.fail(error);
    return ((data ?? []) as (ItineraryRow & { participants?: unknown })[]).map((row) => {
      const { participants, ...rest } = row;
      void participants;
      return rest as ItineraryRow;
    });
  }

  async addLog(entry: NewLogEntry) {
    const { error } = await this.sb.from("activity_log").insert(entry);
    this.fail(error);
  }

  async listLog(tripId: string, limit: number) {
    const { data, error } = await this.sb.from("activity_log").select("*").eq("trip_id", tripId).order("at", { ascending: false }).limit(limit);
    this.fail(error);
    return (data ?? []) as LogEntry[];
  }

  async recordPeek(peekerId: string, targetId: string) {
    const now = new Date().toISOString();
    const { data: existing, error } = await this.sb.from("peeks").select("count").eq("peeker_id", peekerId).eq("target_id", targetId).maybeSingle();
    this.fail(error);
    if (existing) {
      const res = await this.sb
        .from("peeks")
        .update({ count: (existing as { count: number }).count + 1, last_at: now })
        .eq("peeker_id", peekerId)
        .eq("target_id", targetId);
      this.fail(res.error);
      return { first: false };
    }
    const res = await this.sb.from("peeks").insert({ peeker_id: peekerId, target_id: targetId, first_at: now, last_at: now, count: 1 });
    if (res.error?.code === "23505") return { first: false }; // a parallel first peek got there first
    this.fail(res.error);
    return { first: true };
  }

  async countPeekers(targetId: string) {
    const { count, error } = await this.sb.from("peeks").select("*", { count: "exact", head: true }).eq("target_id", targetId);
    this.fail(error);
    return count ?? 0;
  }

  async listPlanVersions(tripId: string, limit: number) {
    const { data, error } = await this.sb.from("plan_versions").select("*").eq("trip_id", tripId).order("version", { ascending: false }).limit(limit);
    this.fail(error);
    return (data ?? []) as PlanVersionRow[];
  }

  async getPublishedPlan(tripId: string) {
    const { data, error } = await this.sb
      .from("plan_versions")
      .select("*")
      .eq("trip_id", tripId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1);
    this.fail(error);
    return ((data ?? [])[0] as PlanVersionRow) ?? null;
  }

  async savePlanVersion(row: NewPlanVersion) {
    // Two organizers saving at once: the unique (trip_id, version) makes one retry with the next number.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: last, error } = await this.sb.from("plan_versions").select("version").eq("trip_id", row.trip_id).order("version", { ascending: false }).limit(1);
      this.fail(error);
      const version = (((last ?? [])[0] as { version: number } | undefined)?.version ?? 0) + 1;
      const res = await this.sb.from("plan_versions").insert({ ...row, version }).select("*").single();
      if (res.error?.code === "23505") continue;
      this.fail(res.error);
      return res.data as PlanVersionRow;
    }
    throw new Error("Database error: couldn't number the plan version");
  }

  async publishPlanVersion(tripId: string, id: string, at: string) {
    const { data, error } = await this.sb.from("plan_versions").update({ published_at: at }).eq("trip_id", tripId).eq("id", id).select("*").maybeSingle();
    this.fail(error);
    return (data as PlanVersionRow) ?? null;
  }

  async listRsvps(tripId: string) {
    const { data, error } = await this.sb.from("plan_rsvps").select("*").eq("trip_id", tripId);
    this.fail(error);
    return (data ?? []) as RsvpRow[];
  }

  async setRsvp(row: Omit<RsvpRow, "updated_at" | "status"> & { status: RsvpStatus | null }) {
    if (!row.status) {
      const { error } = await this.sb.from("plan_rsvps").delete().eq("participant_id", row.participant_id).eq("item_key", row.item_key);
      this.fail(error);
      return;
    }
    const { error } = await this.sb.from("plan_rsvps").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "participant_id,item_key" });
    this.fail(error);
  }

  async addRsvps(rows: Omit<RsvpRow, "updated_at">[]) {
    if (!rows.length) return;
    const at = new Date().toISOString();
    const { error } = await this.sb.from("plan_rsvps").upsert(rows.map((r) => ({ ...r, updated_at: at })), { onConflict: "participant_id,item_key" });
    this.fail(error);
  }
}

// ── Local JSON file (development and tests) ───────────────────────────

type PeekRow = { peeker_id: string; target_id: string; first_at: string; last_at: string; count: number };

type FileDb = {
  trips: TripRow[];
  participants: ParticipantRow[];
  itineraries: ItineraryRow[];
  log: LogEntry[];
  peeks: PeekRow[];
  planVersions: PlanVersionRow[];
  rsvps: RsvpRow[];
};

class FileStore implements Store {
  // CARAVAN_LOCAL_STORE_FILE: another file (unit tests use a temp one).
  private file = process.env.CARAVAN_LOCAL_STORE_FILE || path.join(process.cwd(), ".data", "dev-db.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<FileDb> {
    try {
      const db = JSON.parse(await fs.readFile(this.file, "utf8")) as Partial<FileDb>;
      // A file from before trips existed is ignored rather than mixed in.
      if (!Array.isArray(db.trips)) throw new Error("old local db");
      return {
        trips: db.trips,
        participants: db.participants ?? [],
        itineraries: db.itineraries ?? [],
        log: db.log ?? [],
        peeks: db.peeks ?? [],
        planVersions: db.planVersions ?? [],
        rsvps: db.rsvps ?? [],
      };
    } catch {
      return { trips: [], participants: [], itineraries: [], log: [], peeks: [], planVersions: [], rsvps: [] };
    }
  }

  /** Whole-file and atomic (a temp file, then a rename), so a read never sees half a write. */
  private async write(db: FileDb) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    // Windows refuses to replace a file another reader has open for a moment: try again shortly.
    for (let i = 0; ; i++) {
      try {
        await fs.rename(tmp, this.file);
        return;
      } catch (err) {
        if (i >= 40 || !["EPERM", "EBUSY", "EACCES"].includes((err as NodeJS.ErrnoException).code ?? "")) throw err;
        await new Promise((r) => setTimeout(r, 15));
      }
    }
  }

  private mutate<T>(fn: (db: FileDb) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = fn(db);
      await this.write(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  createTrip(trip: NewTrip) {
    return this.mutate((db) => {
      if (db.trips.some((t) => t.slug === trip.slug)) return null;
      const now = new Date().toISOString();
      const row: TripRow = {
        id: randomUUID(),
        slug: trip.slug,
        name: trip.name,
        preset_id: trip.preset_id,
        edits_locked: false,
        rules: trip.rules ?? {},
        kind: trip.kind ?? "live",
        creator_hash: trip.creator_hash ?? null,
        created_at: now,
        updated_at: now,
      };
      db.trips.push(row);
      return row;
    });
  }
  async getTrip(id: string) {
    return (await this.read()).trips.find((t) => t.id === id) ?? null;
  }
  async getTripBySlug(slug: string) {
    return (await this.read()).trips.find((t) => t.slug === slug) ?? null;
  }
  updateTrip(id: string, patch: Partial<Pick<TripRow, "name" | "edits_locked" | "rules">>) {
    return this.mutate((db) => {
      const t = db.trips.find((x) => x.id === id);
      if (t) Object.assign(t, patch, { updated_at: new Date().toISOString() });
    });
  }
  renameTrip(id: string, slug: string) {
    return this.mutate((db) => {
      if (db.trips.some((t) => t.slug === slug && t.id !== id)) return false;
      const t = db.trips.find((x) => x.id === id);
      if (t) Object.assign(t, { slug, updated_at: new Date().toISOString() });
      return true;
    });
  }
  async listTripsBySlugPrefix(prefix: string) {
    return (await this.read()).trips.filter((t) => t.slug.startsWith(prefix));
  }
  deleteTrip(id: string) {
    return this.mutate((db) => {
      const people = new Set(db.participants.filter((p) => p.trip_id === id).map((p) => p.id));
      db.trips = db.trips.filter((t) => t.id !== id);
      db.participants = db.participants.filter((p) => p.trip_id !== id);
      db.itineraries = db.itineraries.filter((i) => !people.has(i.participant_id));
      db.log = db.log.filter((l) => l.trip_id !== id);
      db.peeks = db.peeks.filter((p) => !people.has(p.peeker_id) && !people.has(p.target_id));
      db.planVersions = db.planVersions.filter((v) => v.trip_id !== id);
      db.rsvps = db.rsvps.filter((r) => r.trip_id !== id);
    });
  }
  async countTripsCreated(creatorHash: string | null, since: string) {
    return (await this.read()).trips.filter((t) => t.created_at >= since && (!creatorHash || t.creator_hash === creatorHash)).length;
  }

  async listParticipants(tripId: string) {
    return (await this.read()).participants.filter((p) => p.trip_id === tripId);
  }
  async getParticipant(id: string) {
    return (await this.read()).participants.find((p) => p.id === id) ?? null;
  }
  async findParticipantByName(tripId: string, name: string) {
    const n = name.toLowerCase();
    return (await this.read()).participants.find((p) => p.trip_id === tripId && p.display_name.toLowerCase() === n) ?? null;
  }
  createParticipant(tripId: string, p: NewParticipant) {
    return this.mutate((db) => {
      const mine = db.participants.filter((x) => x.trip_id === tripId);
      if (mine.some((x) => x.display_name.toLowerCase() === p.name.toLowerCase())) return null;
      if (p.role === "owner" && mine.some((x) => x.role === "owner")) return null;
      const row: ParticipantRow = {
        id: randomUUID(),
        trip_id: tripId,
        display_name: p.name,
        pin_hash: p.pinHash,
        failed_attempts: 0,
        locked_until: null,
        role: p.role ?? "member",
        guest: !!p.guest,
        created_at: new Date().toISOString(),
      };
      db.participants.push(row);
      return row;
    });
  }
  updateParticipant(id: string, patch: Partial<ParticipantRow>) {
    return this.mutate((db) => {
      const p = db.participants.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
  }
  deleteParticipant(id: string) {
    return this.mutate((db) => {
      db.participants = db.participants.filter((p) => p.id !== id);
      db.itineraries = db.itineraries.filter((i) => i.participant_id !== id);
      db.peeks = db.peeks.filter((p) => p.peeker_id !== id && p.target_id !== id);
      db.rsvps = db.rsvps.filter((r) => r.participant_id !== id);
      for (const v of db.planVersions) if (v.created_by === id) v.created_by = null;
    });
  }

  async getItinerary(participantId: string) {
    return (await this.read()).itineraries.find((i) => i.participant_id === participantId) ?? null;
  }
  saveItinerary(row: ItinerarySave) {
    return this.mutate((db) => {
      const prev = db.itineraries.find((i) => i.participant_id === row.participant_id);
      const next = { ...prev, ...row } as ItineraryRow;
      db.itineraries = db.itineraries.filter((i) => i.participant_id !== row.participant_id);
      db.itineraries.push(next);
      return next;
    });
  }
  setStamp(participantId: string, stamp: Stamp | null) {
    return this.mutate((db) => {
      const it = db.itineraries.find((i) => i.participant_id === participantId);
      if (it) it.stamp = stamp;
    });
  }
  async listItineraries(tripId: string) {
    const db = await this.read();
    const people = new Set(db.participants.filter((p) => p.trip_id === tripId).map((p) => p.id));
    return db.itineraries.filter((i) => people.has(i.participant_id));
  }

  addLog(entry: NewLogEntry) {
    return this.mutate((db) => {
      db.log = [{ ...entry, id: randomUUID(), at: new Date().toISOString() }, ...db.log].slice(0, 5000);
    });
  }
  async listLog(tripId: string, limit: number) {
    return (await this.read()).log.filter((l) => l.trip_id === tripId).slice(0, limit);
  }
  recordPeek(peekerId: string, targetId: string) {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const row = db.peeks.find((p) => p.peeker_id === peekerId && p.target_id === targetId);
      if (row) {
        row.count++;
        row.last_at = now;
        return { first: false };
      }
      db.peeks.push({ peeker_id: peekerId, target_id: targetId, first_at: now, last_at: now, count: 1 });
      return { first: true };
    });
  }
  async countPeekers(targetId: string) {
    return (await this.read()).peeks.filter((p) => p.target_id === targetId).length;
  }

  async listPlanVersions(tripId: string, limit: number) {
    return (await this.read()).planVersions
      .filter((v) => v.trip_id === tripId)
      .sort((a, b) => b.version - a.version)
      .slice(0, limit);
  }
  async getPublishedPlan(tripId: string) {
    const published = (await this.read()).planVersions.filter((v) => v.trip_id === tripId && v.published_at);
    return published.sort((a, b) => b.published_at!.localeCompare(a.published_at!) || b.version - a.version)[0] ?? null;
  }
  savePlanVersion(row: NewPlanVersion) {
    return this.mutate((db) => {
      const version = Math.max(0, ...db.planVersions.filter((v) => v.trip_id === row.trip_id).map((v) => v.version)) + 1;
      const saved: PlanVersionRow = { ...row, id: randomUUID(), version, created_at: new Date().toISOString(), published_at: row.published_at ?? null };
      db.planVersions.push(saved);
      return saved;
    });
  }
  publishPlanVersion(tripId: string, id: string, at: string) {
    return this.mutate((db) => {
      const v = db.planVersions.find((x) => x.id === id && x.trip_id === tripId);
      if (v) v.published_at = at;
      return v ?? null;
    });
  }
  async listRsvps(tripId: string) {
    return (await this.read()).rsvps.filter((r) => r.trip_id === tripId);
  }
  setRsvp(row: Omit<RsvpRow, "updated_at" | "status"> & { status: RsvpStatus | null }) {
    return this.mutate((db) => {
      db.rsvps = db.rsvps.filter((r) => !(r.participant_id === row.participant_id && r.item_key === row.item_key));
      if (row.status) db.rsvps.push({ ...row, status: row.status, updated_at: new Date().toISOString() });
    });
  }
  addRsvps(rows: Omit<RsvpRow, "updated_at">[]) {
    return this.mutate((db) => {
      const at = new Date().toISOString();
      const keys = new Set(rows.map((r) => `${r.participant_id}|${r.item_key}`));
      db.rsvps = [...db.rsvps.filter((r) => !keys.has(`${r.participant_id}|${r.item_key}`)), ...rows.map((r) => ({ ...r, updated_at: at }))];
    });
  }
}

// ── Picking a store ───────────────────────────────────────────────────

let store: Store | null = null;

/** CARAVAN_LOCAL_STORE=1 forces the local JSON store even when Supabase is configured (tests, demos). */
const forceLocal = () => process.env.CARAVAN_LOCAL_STORE === "1";

export function isUsingLocalStore(): boolean {
  return forceLocal() || !process.env.SUPABASE_URL;
}

export function db(): Store {
  if (store) return store;
  // Never open a connection to a protected project, whatever the build did.
  assertSafeInfra();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (forceLocal()) {
    store = new FileStore();
  } else if (url && key) {
    store = new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else if (process.env.NODE_ENV !== "production") {
    store = new FileStore();
  } else {
    throw new Error("Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see SETUP.md).");
  }
  return store;
}
