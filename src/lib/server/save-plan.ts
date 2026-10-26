import "server-only";
import { parseItinerary } from "@/engine/input";
import { MAX_ROOMMATES, isSubmittable, normalize, type ItineraryData, type RoommatePick } from "@/engine/itinerary";
import { isHidden } from "@/engine/rules";
import { daysNightsLabel, tripDays, type Engine } from "@/engine/structure";
import { db, type ParticipantRow } from "./db";
import { error, json } from "./http";
import { logAction } from "./organizer";
import type { Actor } from "./session";
import type { TripContext } from "./trip";

/** Hidden options someone already had stay ("No longer available"); new picks of them are refused. */
function dropNewlyHidden(e: Engine, data: ItineraryData, before: ItineraryData | null): ItineraryData {
  if (!e.rules.hidden.length) return data;
  const had = new Set(before ? normalize(e, before).days.flatMap((d) => [...d.day, ...d.night].map((x) => x.id)) : []);
  const keep = (id: string) => !isHidden(e.rules, id) || had.has(id);
  return { ...data, days: data.days.map((d) => ({ ...d, day: d.day.filter((x) => keep(x.id)), night: d.night.filter((x) => keep(x.id)) })) };
}

/**
 * Roommate picks, made safe: a client that doesn't send them keeps what's
 * saved. Participant picks must be real people other than yourself (their
 * current name is stored); a pick of someone who's gone is kept as a typed
 * name. No duplicates, at most three.
 */
async function cleanRoommates(p: ParticipantRow, data: ItineraryData, before: ItineraryData | null): Promise<ItineraryData> {
  const sent = data.preferences.roommates;
  if (sent === undefined) {
    const kept = before?.preferences?.roommates;
    return kept ? { ...data, preferences: { ...data.preferences, roommates: kept } } : data;
  }
  const people = sent.some((r) => r.id) ? await db().listParticipants(p.trip_id) : [];
  const out: RoommatePick[] = [];
  const seen = new Set<string>();
  for (const r of sent) {
    const person = r.id ? people.find((x) => x.id === r.id) : undefined;
    if (person?.id === p.id || (!person && r.name.trim().toLowerCase() === p.display_name.toLowerCase())) continue;
    const pick: RoommatePick = person ? { id: person.id, name: person.display_name } : { name: r.name.trim() };
    const key = pick.id ?? `name:${pick.name.toLowerCase()}`;
    if (!pick.name || seen.has(key)) continue;
    seen.add(key);
    out.push(pick);
    if (out.length === MAX_ROOMMATES) break;
  }
  return { ...data, preferences: { ...data.preferences, roommates: out } };
}

/**
 * Save a plan — the person's own autosave/submit, or an organizer editing it
 * on their behalf (`actor`: works while edits are locked, never submits,
 * stamps "Edited by <organizer>").
 */
export async function savePlan(trip: TripContext, p: ParticipantRow, body: Record<string, unknown> | null, actor?: Actor): Promise<Response> {
  const e = trip.engine;
  if (p.trip_id !== trip.trip.id) return error("Not found", 404);
  if (!actor && trip.locked) return error("locked", 423);
  const existing = await db().getItinerary(p.id);

  const parsed = parseItinerary(e, body?.data);
  if (!parsed) return error("That itinerary didn't look right — try refreshing.", 400);
  const data = await cleanRoommates(p, dropNewlyHidden(e, parsed, existing?.data ?? null), existing?.data ?? null);

  const submit = !actor && body?.submit === true;
  if (submit && !data.startDate) return error("Pick your dates before submitting.", 400);
  if (submit && !isSubmittable(e, data)) return error(`This trip is ${daysNightsLabel(tripDays(e))}. Switch back to submit.`, 400);

  const now = new Date().toISOString();
  const status = submit || existing?.status === "submitted" ? "submitted" : "draft";
  const saved = await db().saveItinerary({
    participant_id: p.id,
    data,
    status,
    submitted_at: existing?.submitted_at ?? (submit ? now : null),
    updated_at: now,
    ...(actor ? { stamp: { kind: "edit" as const, by: actor.name, byId: actor.id, at: now, seen: false } } : {}),
  });
  if (actor) await logAction(trip.trip.id, actor, "edit_plan", { id: p.id, name: p.display_name });
  return json({ status: saved.status, updatedAt: saved.updated_at, submittedAt: saved.submitted_at });
}
