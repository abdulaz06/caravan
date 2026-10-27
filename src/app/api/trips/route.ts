import bcrypt from "bcryptjs";
import { db, isUsingLocalStore } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { clientIp, creationBlocked, creatorHash, makeSlug } from "@/lib/server/new-trip";
import { logAction } from "@/lib/server/organizer";
import { startSession } from "@/lib/server/session";
import { tripPath } from "@/lib/server/trip";
import { nameSchema, pinSchema, tripNameSchema } from "@/lib/validation";
import { isPresetId } from "@/presets/registry";

/** Start a trip: the person creating it becomes its owner and is signed in. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return error("Bad request", 400);
  // A field people never see: bots fill it in.
  if (typeof body.website === "string" && body.website.trim()) return error("Bad request", 400);

  if (!isPresetId(body.presetId)) return error("Pick a destination", 400, { field: "preset" });
  const tripName = tripNameSchema.safeParse(body.tripName);
  if (!tripName.success) return error(tripName.error.issues[0].message, 400, { field: "tripName" });
  const name = nameSchema.safeParse(body.name);
  if (!name.success) return error(name.error.issues[0].message, 400, { field: "name" });
  const pin = pinSchema.safeParse(body.pin);
  if (!pin.success) return error(pin.error.issues[0].message, 400, { field: "pin" });

  const hash = creatorHash(clientIp(req));
  // The local JSON store is for development and tests only (every request there comes from one "IP").
  const blocked = isUsingLocalStore() ? null : await creationBlocked(hash);
  if (blocked) return error(blocked, 429);

  const store = db();
  const tripLabel = tripName.data.replace(/\s+/g, " ");
  let trip = null;
  for (let i = 0; i < 5 && !trip; i++) {
    trip = await store.createTrip({ slug: makeSlug(tripLabel, body.presetId), name: tripLabel, preset_id: body.presetId, creator_hash: hash });
  }
  if (!trip) return error("Couldn't start the trip — try again.", 500);

  const displayName = name.data.replace(/\s+/g, " ");
  const owner = await store.createParticipant(trip.id, { name: displayName, pinHash: await bcrypt.hash(pin.data, 10), role: "owner" });
  if (!owner) {
    await store.deleteTrip(trip.id);
    return error("Couldn't start the trip — try again.", 500);
  }
  await startSession(trip.id, owner.id);
  await logAction(trip.id, { id: owner.id, name: owner.display_name }, "Started the trip", null, { preset: trip.preset_id });
  return json({ slug: trip.slug, name: trip.name, url: tripPath(trip.slug), presetId: trip.preset_id }, 201);
}
