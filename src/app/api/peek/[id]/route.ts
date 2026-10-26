import { normalize } from "@/engine/itinerary";
import type { PeekResponse } from "@/lib/peek";
import { peekPlan } from "@/lib/privacy";
import { db, roleOf } from "@/lib/server/db";
import { error, json } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { loadTrip } from "@/lib/server/trip";
import { currentParticipant } from "@/lib/server/session";

/** 👀 Peek at someone's plan (drafts too): their full itinerary, read-only — never notes or private answers. */
export async function GET(_req: Request, ctx: RouteContext<"/api/peek/[id]">) {
  const me = await currentParticipant();
  if (!me) return error("Sign in first", 401);
  const { rules, engine } = await loadTrip();
  if (!rules.peek) return error("Peeking is switched off", 403, { code: "peek_off" });
  const { id } = await ctx.params;
  if (id === me.id) return error("That's your own plan!", 400);
  const [person, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
  if (!person) return error("Not found", 404);

  const { first } = await db().recordPeek(me.id, person.id);
  if (first) await logAction({ id: me.id, name: me.display_name }, "peek", { id: person.id, name: person.display_name });

  const body: PeekResponse = {
    name: person.display_name,
    role: roleOf(person),
    status: row ? row.status : "new",
    data: row ? peekPlan(normalize(engine, row.data)) : null,
  };
  return json(body);
}
