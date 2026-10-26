// Big day trips with variants (e.g. a summit at sunrise vs an easy morning):
// the option a person picks has `variants`, and the chosen one is stored on
// the pick. The evening before a very early variant gets a soft early-night
// note (never a lock) and a gentle warning if it has late plans.
import type { Activity, ActivityVariant } from "./catalog";
import { planAt, type ItineraryData, type SlotItem } from "./itinerary";
import type { Engine } from "./structure";

export type DayTrip = { item: SlotItem; activity: Activity; variant: ActivityVariant };

export function variantOf(a: Activity | undefined | null, id: string | undefined): ActivityVariant | undefined {
  const vs = a?.variants ?? [];
  return vs.find((v) => v.id === id) ?? vs[0];
}

/** The variant day trip in a day's daytime, if any. */
export function tripOn(e: Engine, data: Pick<ItineraryData, "days">, index: number): DayTrip | null {
  for (const item of data.days[index]?.day ?? []) {
    const activity = e.catalog.byId[item.id];
    const variant = activity?.variants ? variantOf(activity, item.variant) : undefined;
    if (activity && variant) return { item, activity, variant };
  }
  return null;
}

/** The variant leaving in the small hours tomorrow (so tonight should be an early one), if any. */
export function earlyNightBefore(e: Engine, data: Pick<ItineraryData, "days">, index: number): ActivityVariant | null {
  const next = tripOn(e, data, index + 1);
  return next?.variant.eveBefore ? next.variant : null;
}

/** Can this big day trip go on this day? (A base's ordinary days only.) */
export function tripPlaceable(e: Engine, data: ItineraryData, index: number, activity: Activity): { ok: true } | { ok: false; reason: string } {
  if (!activity.onlyBaseDays) return { ok: true };
  const plan = planAt(e, data, index);
  if (plan?.kind === "base" && !plan.arrival && activity.areas.includes(plan.areas.day ?? "")) return { ok: true };
  const home = e.catalog.bases.find((b) => activity.areas.includes(b.area));
  return { ok: false, reason: `${activity.title.split(" · ")[0]} fits on the ${home?.name ?? "base"} days only` };
}

/** Late-night plans (big nights, nightlife) in an evening. */
export function lateNightItems(e: Engine, data: Pick<ItineraryData, "days">, index: number): Activity[] {
  return (data.days[index]?.night ?? [])
    .map((x) => e.catalog.byId[x.id])
    .filter((a): a is Activity => !!a && (a.vibe >= 2 || e.catalog.isNightlife(a)));
}
