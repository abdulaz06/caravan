import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { savePlan } from "@/lib/server/save-plan";
import { currentParticipant } from "@/lib/server/session";

export async function GET() {
  const p = await currentParticipant();
  if (!p) return error("Not signed in", 401);
  const row = await db().getItinerary(p.id);
  return json(row ?? null);
}

/** Autosave (debounced from the client) and submit. */
export async function PUT(req: Request) {
  const p = await currentParticipant();
  if (!p) return error("Not signed in", 401);
  return savePlan(p, await readJson(req));
}
