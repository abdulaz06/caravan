import { isSubmittable } from "@/lib/itinerary";
import { parseItinerary } from "@/lib/schema";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
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
  const [settings, existing, body] = await Promise.all([
    db().getSettings(),
    db().getItinerary(p.id),
    readJson(req),
  ]);
  if (settings.edits_locked) return error("locked", 423);

  const data = parseItinerary(body?.data);
  if (!data) return error("That itinerary didn't look right — try refreshing.", 400);

  const submit = body?.submit === true;
  if (submit && !data.startDate) return error("Pick your dates before submitting.", 400);
  if (submit && !isSubmittable(data)) return error("The group voted 6 days. Switch back to submit.", 400);

  const now = new Date().toISOString();
  const status = submit || existing?.status === "submitted" ? "submitted" : "draft";
  const saved = await db().saveItinerary({
    participant_id: p.id,
    data,
    status,
    submitted_at: existing?.submitted_at ?? (submit ? now : null),
    updated_at: now,
  });
  return json({ status: saved.status, updatedAt: saved.updated_at, submittedAt: saved.submitted_at });
}
