// The Ella day trip (Little Adam's Peak): the one big day trip that reaches
// beyond ~2.5 hrs from Galle. Two variants — "sunrise" (leave ~12:30am) and
// "calm" (leave ~5am). The evening before a sunrise trip gets a soft
// early-night note (never a lock) and a gentle warning if it has late plans.
import { activitiesById, isNightlife, type Activity, type ActivityVariant } from "@/content";
import { roleAt, type ItineraryData, type SlotItem } from "./itinerary";

export const ELLA_ID = "ella-little-adams-peak";

export const tripVariants = (): ActivityVariant[] => activitiesById[ELLA_ID]?.variants ?? [];
export const tripVariant = (id: string | undefined): ActivityVariant | undefined =>
  tripVariants().find((v) => v.id === id) ?? tripVariants()[0];

/** The Ella day trip on a day's daytime, if any. */
export function tripOn(data: Pick<ItineraryData, "days">, index: number): { item: SlotItem; variant: ActivityVariant } | null {
  const item = data.days[index]?.day.find((x) => x.id === ELLA_ID);
  const variant = item ? tripVariant(item.variant) : undefined;
  return item && variant ? { item, variant } : null;
}

/** The variant leaving in the small hours tomorrow (so tonight should be an early one), if any. */
export function earlyNightBefore(data: Pick<ItineraryData, "days">, index: number): ActivityVariant | null {
  const next = tripOn(data, index + 1);
  return next?.variant.eveBefore ? next.variant : null;
}

/** Galle days only (never Day 2's on-the-way daytime or a Colombo day). */
export function tripPlaceable(data: ItineraryData, index: number): { ok: true } | { ok: false; reason: string } {
  return roleAt(data, index) === "galle" ? { ok: true } : { ok: false, reason: "The Ella day trip fits on the Galle days only" };
}

/** Late-night plans (parties, bars, big nights) in an evening. */
export function lateNightItems(data: Pick<ItineraryData, "days">, index: number): Activity[] {
  return (data.days[index]?.night ?? [])
    .map((x) => activitiesById[x.id])
    .filter((a): a is Activity => !!a && (a.vibe >= 2 || isNightlife(a)));
}
