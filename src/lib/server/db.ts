import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ItineraryData, ItineraryStatus } from "@/lib/itinerary";

// All database access lives here and only runs on the server, using the
// Supabase service-role key (RLS is on with no public policies, so the anon
// key can read nothing). In local development without Supabase credentials a
// JSON file under .data/ stands in for the database.

export type ParticipantRow = {
  id: string;
  display_name: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};

export type ItineraryRow = {
  participant_id: string;
  data: ItineraryData;
  status: ItineraryStatus;
  submitted_at: string | null;
  updated_at: string;
};

export type SettingsRow = { edits_locked: boolean; updated_at: string };

export interface Store {
  listParticipants(): Promise<ParticipantRow[]>;
  getParticipant(id: string): Promise<ParticipantRow | null>;
  findParticipantByName(name: string): Promise<ParticipantRow | null>;
  /** Returns null when the (case-insensitive) name is already taken. */
  createParticipant(name: string, pinHash: string): Promise<ParticipantRow | null>;
  updateParticipant(
    id: string,
    patch: Partial<Pick<ParticipantRow, "pin_hash" | "failed_attempts" | "locked_until">>,
  ): Promise<void>;
  deleteParticipant(id: string): Promise<void>;
  getItinerary(participantId: string): Promise<ItineraryRow | null>;
  saveItinerary(row: ItineraryRow): Promise<ItineraryRow>;
  listItineraries(): Promise<ItineraryRow[]>;
  getSettings(): Promise<SettingsRow>;
  setEditsLocked(locked: boolean): Promise<void>;
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

  async saveItinerary(row: ItineraryRow) {
    const { data, error } = await this.sb
      .from("itineraries")
      .upsert(row, { onConflict: "participant_id" })
      .select("*")
      .single();
    this.fail(error);
    return data as ItineraryRow;
  }

  async listItineraries() {
    const { data, error } = await this.sb.from("itineraries").select("*");
    this.fail(error);
    return (data ?? []) as ItineraryRow[];
  }

  async getSettings() {
    const { data, error } = await this.sb
      .from("settings")
      .select("edits_locked, updated_at")
      .eq("id", 1)
      .maybeSingle();
    this.fail(error);
    return (data as SettingsRow) ?? { edits_locked: false, updated_at: new Date(0).toISOString() };
  }

  async setEditsLocked(locked: boolean) {
    const { error } = await this.sb
      .from("settings")
      .upsert({ id: 1, edits_locked: locked, updated_at: new Date().toISOString() });
    this.fail(error);
  }
}

// ── Local JSON file (development only) ────────────────────────────────

type FileDb = {
  participants: ParticipantRow[];
  itineraries: ItineraryRow[];
  settings: SettingsRow;
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
    });
  }
  async getItinerary(participantId: string) {
    return (await this.read()).itineraries.find((i) => i.participant_id === participantId) ?? null;
  }
  saveItinerary(row: ItineraryRow) {
    return this.mutate((db) => {
      db.itineraries = db.itineraries.filter((i) => i.participant_id !== row.participant_id);
      db.itineraries.push(row);
      return row;
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
      db.settings = { edits_locked: locked, updated_at: new Date().toISOString() };
    });
  }
}

// ── Picking a store ───────────────────────────────────────────────────

let store: Store | null = null;

export function isUsingLocalStore(): boolean {
  return !process.env.SUPABASE_URL;
}

export function db(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    store = new SupabaseStore(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  } else if (process.env.NODE_ENV !== "production" || process.env.LANKS_LOCAL_STORE === "1") {
    store = new FileStore();
  } else {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see SETUP.md).",
    );
  }
  return store;
}
