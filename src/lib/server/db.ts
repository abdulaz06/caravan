import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafeInfra } from "@/lib/infra-guard";
import type { ItineraryData, ItineraryStatus } from "@/engine/itinerary";

// All database access lives here and only runs on the server, using the
// Supabase service-role key (RLS is on with no public policies, so the anon
// key can read nothing). In local development without Supabase credentials a
// JSON file under .data/ stands in for the database.

export type Role = "owner" | "admin" | "member";

export type ParticipantRow = {
  id: string;
  display_name: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  /** Missing on rows read before the roles migration ran → member. */
  role?: Role;
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

export type SettingsRow = { edits_locked: boolean; rules?: unknown; updated_at: string };

export type LogEntry = {
  id: string;
  at: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
};
export type NewLogEntry = Omit<LogEntry, "id" | "at">;

export const roleOf = (p: Pick<ParticipantRow, "role"> | null | undefined): Role => p?.role ?? "member";
export const isOrganizerRole = (r: Role) => r === "owner" || r === "admin";

export interface Store {
  listParticipants(): Promise<ParticipantRow[]>;
  getParticipant(id: string): Promise<ParticipantRow | null>;
  findParticipantByName(name: string): Promise<ParticipantRow | null>;
  /** Returns null when the (case-insensitive) name is already taken. */
  createParticipant(name: string, pinHash: string): Promise<ParticipantRow | null>;
  updateParticipant(
    id: string,
    patch: Partial<Pick<ParticipantRow, "pin_hash" | "failed_attempts" | "locked_until" | "role">>,
  ): Promise<void>;
  deleteParticipant(id: string): Promise<void>;
  getItinerary(participantId: string): Promise<ItineraryRow | null>;
  /** Upserts only the fields given (a person's own save never touches the organizer stamp). */
  saveItinerary(row: ItinerarySave): Promise<ItineraryRow>;
  setStamp(participantId: string, stamp: Stamp | null): Promise<void>;
  listItineraries(): Promise<ItineraryRow[]>;
  getSettings(): Promise<SettingsRow>;
  setEditsLocked(locked: boolean): Promise<void>;
  setRules(rules: unknown): Promise<void>;
  addLog(entry: NewLogEntry): Promise<void>;
  listLog(limit: number): Promise<LogEntry[]>;
  /** Counts a peek; `first` = this person had never peeked at that plan before. */
  recordPeek(peekerId: string, targetId: string): Promise<{ first: boolean }>;
  countPeekers(targetId: string): Promise<number>;
}

// ── Supabase ──────────────────────────────────────────────────────────

class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  private fail(error: { message: string } | null): void {
    if (error) throw new Error(`Database error: ${error.message}`);
  }

  async listParticipants() {
    const { data, error } = await this.sb
      .from("participants")
      .select("*")
      .order("created_at", { ascending: true });
    this.fail(error);
    return (data ?? []) as ParticipantRow[];
  }

  async getParticipant(id: string) {
    const { data, error } = await this.sb.from("participants").select("*").eq("id", id).maybeSingle();
    this.fail(error);
    return (data as ParticipantRow) ?? null;
  }

  async findParticipantByName(name: string) {
    const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await this.sb
      .from("participants")
      .select("*")
      .ilike("display_name", escaped)
      .limit(1);
    this.fail(error);
    return ((data ?? [])[0] as ParticipantRow) ?? null;
  }

  async createParticipant(name: string, pinHash: string) {
    const { data, error } = await this.sb
      .from("participants")
      .insert({ display_name: name, pin_hash: pinHash })
      .select("*")
      .single();
    if (error?.code === "23505") return null; // unique violation on lower(display_name)
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
    const { data, error } = await this.sb
      .from("itineraries")
      .select("*")
      .eq("participant_id", participantId)
      .maybeSingle();
    this.fail(error);
    return (data as ItineraryRow) ?? null;
  }

  async saveItinerary(row: ItinerarySave) {
    const { data, error } = await this.sb
      .from("itineraries")
      .upsert(row, { onConflict: "participant_id" })
      .select("*")
      .single();
    this.fail(error);
    return data as ItineraryRow;
  }

  async setStamp(participantId: string, stamp: Stamp | null) {
    const { error } = await this.sb.from("itineraries").update({ stamp }).eq("participant_id", participantId);
    this.fail(error);
  }

  async listItineraries() {
    const { data, error } = await this.sb.from("itineraries").select("*");
    this.fail(error);
    return (data ?? []) as ItineraryRow[];
  }

  async getSettings() {
    // "*" so this keeps working whichever optional columns exist.
    const { data, error } = await this.sb.from("settings").select("*").eq("id", 1).maybeSingle();
    this.fail(error);
    return (data as SettingsRow) ?? { edits_locked: false, updated_at: new Date(0).toISOString() };
  }

  async setEditsLocked(locked: boolean) {
    const { error } = await this.sb
      .from("settings")
      .upsert({ id: 1, edits_locked: locked, updated_at: new Date().toISOString() });
    this.fail(error);
  }

  async setRules(rules: unknown) {
    const { error } = await this.sb
      .from("settings")
      .upsert({ id: 1, rules, updated_at: new Date().toISOString() });
    this.fail(error);
  }

  async addLog(entry: NewLogEntry) {
    const { error } = await this.sb.from("activity_log").insert(entry);
    this.fail(error);
  }

  async listLog(limit: number) {
    const { data, error } = await this.sb.from("activity_log").select("*").order("at", { ascending: false }).limit(limit);
    this.fail(error);
    return (data ?? []) as LogEntry[];
  }

  async recordPeek(peekerId: string, targetId: string) {
    const now = new Date().toISOString();
    const { data: existing, error } = await this.sb
      .from("peeks")
      .select("count")
      .eq("peeker_id", peekerId)
      .eq("target_id", targetId)
      .maybeSingle();
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
}

// ── Local JSON file (development only) ────────────────────────────────

type PeekRow = { peeker_id: string; target_id: string; first_at: string; last_at: string; count: number };

type FileDb = {
  participants: ParticipantRow[];
  itineraries: ItineraryRow[];
  settings: SettingsRow;
  log?: LogEntry[];
  peeks?: PeekRow[];
};

class FileStore implements Store {
  private file = path.join(process.cwd(), ".data", "dev-db.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<FileDb> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as FileDb;
    } catch {
      return {
        participants: [],
        itineraries: [],
        settings: { edits_locked: false, updated_at: new Date().toISOString() },
      };
    }
  }

  private mutate<T>(fn: (db: FileDb) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = fn(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(db, null, 2));
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listParticipants() {
    return (await this.read()).participants;
  }
  async getParticipant(id: string) {
    return (await this.read()).participants.find((p) => p.id === id) ?? null;
  }
  async findParticipantByName(name: string) {
    const n = name.toLowerCase();
    return (await this.read()).participants.find((p) => p.display_name.toLowerCase() === n) ?? null;
  }
  createParticipant(name: string, pinHash: string) {
    return this.mutate((db) => {
      if (db.participants.some((p) => p.display_name.toLowerCase() === name.toLowerCase())) return null;
      const row: ParticipantRow = {
        id: randomUUID(),
        display_name: name,
        pin_hash: pinHash,
        failed_attempts: 0,
        locked_until: null,
        role: "member",
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
      db.peeks = (db.peeks ?? []).filter((p) => p.peeker_id !== id && p.target_id !== id);
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
  async listItineraries() {
    return (await this.read()).itineraries;
  }
  async getSettings() {
    return (await this.read()).settings;
  }
  setEditsLocked(locked: boolean) {
    return this.mutate((db) => {
      db.settings = { ...db.settings, edits_locked: locked, updated_at: new Date().toISOString() };
    });
  }
  setRules(rules: unknown) {
    return this.mutate((db) => {
      db.settings = { ...db.settings, rules, updated_at: new Date().toISOString() };
    });
  }
  addLog(entry: NewLogEntry) {
    return this.mutate((db) => {
      db.log = [{ ...entry, id: randomUUID(), at: new Date().toISOString() }, ...(db.log ?? [])].slice(0, 2000);
    });
  }
  async listLog(limit: number) {
    return ((await this.read()).log ?? []).slice(0, limit);
  }
  recordPeek(peekerId: string, targetId: string) {
    return this.mutate((db) => {
      db.peeks ??= [];
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
    return ((await this.read()).peeks ?? []).filter((p) => p.target_id === targetId).length;
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
    store = new SupabaseStore(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  } else if (process.env.NODE_ENV !== "production") {
    store = new FileStore();
  } else {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see SETUP.md).",
    );
  }
  return store;
}
