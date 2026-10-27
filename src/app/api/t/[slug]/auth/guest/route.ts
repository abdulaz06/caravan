import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { MAX_DEMO_GUESTS } from "@/lib/server/demo";
import { error, json } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";
import { currentParticipant, startSession } from "@/lib/server/session";

const ANIMALS = ["Otter", "Gecko", "Heron", "Lynx", "Puffin", "Ibex", "Tapir", "Koala", "Falcon", "Panda", "Yak", "Orca", "Marten", "Lemur"];

/** "Try it as a guest" on the demo trip: a throwaway traveller, gone at the nightly reset. */
export async function POST(_req: Request, ctx: RouteContext<"/api/t/[slug]/auth/guest">) {
  return withTrip(ctx, async (trip) => {
    if (trip.trip.kind !== "demo") return error("Guests are for the demo trip only", 403);
    const me = await currentParticipant(trip.trip);
    if (me) return json({ id: me.id, name: me.display_name });

    const store = db();
    const people = await store.listParticipants(trip.trip.id);
    if (people.filter((p) => p.guest).length >= MAX_DEMO_GUESTS) {
      return error("The demo is full for today — it resets overnight. Try again tomorrow!", 429);
    }
    // Nobody signs back in as a guest, so the PIN is random and never shown.
    const pinHash = await bcrypt.hash(randomBytes(16).toString("hex"), 8);
    for (let i = 0; i < 6; i++) {
      const name = `Guest ${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(10, 100)}`;
      const row = await store.createParticipant(trip.trip.id, { name, pinHash, guest: true });
      if (row) {
        await startSession(trip.trip.id, row.id);
        return json({ id: row.id, name: row.display_name }, 201);
      }
    }
    return error("Couldn't start a guest visit — try again.", 500);
  });
}
