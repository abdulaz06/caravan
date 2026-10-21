import { regions } from "@/content";
import { dayLabel } from "@/lib/dates";
import { daysNightsLabel, normalize, tripLength } from "@/lib/itinerary";
import type { PeekItem, PeekPlan } from "@/lib/peek";
import { balanceLabel, balanceOf, buildTimeline, type SlotView } from "@/lib/timeline";
import { db } from "@/lib/server/db";
import { error, json } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { loadRules } from "@/lib/server/rules";
import { currentParticipant } from "@/lib/server/session";


/** Picks only: titles, area and cover photo — no ids, details, notes or private answers. */
function items(view: SlotView): PeekItem[] {
  return view.items.map((v) =>
    v.resolved.kind === "stay"
      ? { title: v.resolved.stay.title, area: null, photo: null, emoji: "🌴" }
      : {
          title: v.resolved.activity.title,
          area: regions[v.resolved.activity.region].short,
          photo: v.resolved.activity.images[0]?.src ?? null,
          emoji: v.resolved.activity.emoji ?? null,
        },
  );
}

/** 👀 Peek at someone's plan (drafts too). Only the fields above ever leave the server. */
export async function GET(_req: Request, ctx: RouteContext<"/api/peek/[id]">) {
  const me = await currentParticipant();
  if (!me) return error("Sign in first", 401);
  const { rules } = await loadRules();
  if (!rules.peek) return error("Peeking is switched off", 403, { code: "peek_off" });
  const { id } = await ctx.params;
  if (id === me.id) return error("That's your own plan!", 400);
  const [person, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
  if (!person) return error("Not found", 404);

  const { first } = await db().recordPeek(me.id, person.id);
  if (first) await logAction({ id: me.id, name: me.display_name }, "peek", { id: person.id, name: person.display_name });

  const data = row ? normalize(row.data) : null;
  const t = data ? buildTimeline(data) : null;
  const balance = data ? balanceOf(data) : null;
  const plan: PeekPlan = {
    name: person.display_name,
    status: row ? row.status : "new",
    dates: data?.startDate && data.endDate ? `${dayLabel(data.startDate)} → ${dayLabel(data.endDate)}` : null,
    length: data?.startDate ? daysNightsLabel(tripLength(data)) : null,
    days: t ? t.days.map((d) => ({ label: d.label, name: d.name, day: items(d.day), night: items(d.night) })) : [],
    balance: { score: balance?.score ?? null, title: balanceLabel(balance?.score ?? null).title },
  };
  return json(plan);
}
