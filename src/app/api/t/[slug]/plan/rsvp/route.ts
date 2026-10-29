import { z } from "zod";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { loadPublicPlan } from "@/lib/server/plan";
import { withTrip } from "@/lib/server/route";
import { currentParticipant } from "@/lib/server/session";

const schema = z.object({
  key: z.string().min(1).max(64),
  status: z.enum(["in", "skip"]).nullable(),
  choice: z.string().min(1).max(64).nullable().optional(),
});

/** "I'm in" / "I'll skip" (null clears it) on an item of the published plan; split items take a side. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/plan/rsvp">) {
  return withTrip(ctx, async (trip) => {
    const me = await currentParticipant(trip.trip);
    if (!me) return error("Not signed in", 401);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return error("That didn't look right", 400);
    const { key, status } = parsed.data;
    const plan = await db().getPublishedPlan(trip.trip.id);
    if (!plan) return error("There's no plan yet", 404);
    const slot = plan.data.slots.find((s) => s.items.some((i) => i.key === key));
    const item = slot?.items.find((i) => i.key === key);
    if (!slot || !item || item.id === "stay") return error("That isn't in the plan", 404);
    // A split slot's main item takes a side; anything else has no choice.
    const split = item.role === "main" && slot.split?.status === "accepted" ? slot.split : null;
    const choice = status === "in" && split ? (parsed.data.choice === split.b.id ? split.b.id : split.a.id) : null;
    await db().setRsvp({ trip_id: trip.trip.id, item_key: key, participant_id: me.id, status, choice });
    const fresh = await loadPublicPlan(trip, me);
    return json({ rsvp: fresh?.rsvps[key] ?? null });
  });
}
