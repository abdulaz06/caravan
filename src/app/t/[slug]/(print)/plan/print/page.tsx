import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lockup } from "@/components/brand/wordmark";
import { PrintButton } from "@/components/plan/print-button";
import { familyView } from "@/engine/family";
import { bannedIn } from "@/engine/family-words";
import { STAY_ID } from "@/engine/itinerary";
import { daysNightsLabel } from "@/engine/structure";
import { buildTimeline } from "@/engine/timeline";
import { dayLabel } from "@/lib/dates";
import { loadPublicPlan } from "@/lib/server/plan";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "The plan · print" };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** A clean, ink-friendly page of the published plan: print it or save it as a PDF. */
export default async function PlanPrintPage({ params, searchParams }: PageProps<"/t/[slug]/plan/print">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const plan = await loadPublicPlan(trip, me);
  const family = (await searchParams).family === "1" && trip.rules.familyButton;
  const e = trip.engine;
  const { catalog } = e;
  const { preset } = catalog;
  if (!plan) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold">The plan isn&apos;t out yet.</p>
        <Link href={tripPath(trip.trip.slug, "/trip")} className="mt-4 inline-block font-semibold underline">
          Back to the trip
        </Link>
      </main>
    );
  }
  const data = family ? familyView(e, plan.itinerary) : plan.itinerary;
  const timeline = buildTimeline(e, data);
  const bySlot = new Map(plan.slots.map((s) => [`${s.day}:${s.slot}`, s]));
  // Family-friendly mode: no line that names a nightlife pick.
  const clean = (t: string) => (family && bannedIn(t).length ? "" : t);
  const titleOf = (id: string) => catalog.byId[family ? catalog.familyIdFor(id) : id]?.title ?? id;
  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 text-[#1b1b1b] print:max-w-none print:px-0 print:py-0">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link href={tripPath(trip.trip.slug, "/plan")} className="text-[14px] font-semibold text-[#444] underline underline-offset-2">
            ← Back to the plan
          </Link>
          <PrintButton />
        </div>
        <header className="mt-8 border-b-2 border-[#1b1b1b] pb-4 print:mt-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#555]">
              {trip.trip.name} · The plan · v{plan.version}
            </p>
            <Lockup size="sm" />
          </div>
          <h1 className="font-display mt-2 text-[40px] font-semibold leading-none">
            {preset.name}, <span className="italic">together</span>
          </h1>
          <p className="mt-2 text-[16px] font-semibold">
            {dayLabel(plan.dates.start)} → {dayLabel(plan.dates.end)} · {daysNightsLabel(plan.dates.length)}
          </p>
          <p className="mt-1 text-[13px] text-[#444]">{plan.decided}</p>
        </header>

        <table className="mt-6 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#bbb] text-[11px] font-bold uppercase tracking-wide text-[#555]">
              <th className="w-[22%] py-2 pr-3">Day</th>
              <th className="py-2 pr-3">{preset.structure.slots.day.label}</th>
              <th className="py-2">{preset.structure.slots.night.label}</th>
            </tr>
          </thead>
          <tbody>
            {timeline.days.map((t) => (
              <tr key={t.index} className="break-inside-avoid border-b border-[#ddd] align-top">
                <td className="py-2.5 pr-3">
                  <p className="font-bold">Day {t.index + 1}</p>
                  <p>{t.date ? dayLabel(t.date) : ""}</p>
                  <p className="text-[12px] text-[#555]">{t.name}</p>
                  {t.special && <p className="text-[12px] font-semibold">{t.special.name}</p>}
                </td>
                {t.plan.kind === "departure" ? (
                  <td colSpan={2} className="py-2.5 text-[#444]">
                    {preset.structure.departure.text}
                  </td>
                ) : (
                  (["day", "night"] as const).map((slot) => {
                    const ps = bySlot.get(`${t.index}:${slot}`);
                    if (!t[slot].area || !ps) {
                      return (
                        <td key={slot} className="py-2.5 pr-3 text-[#888]">
                          {t.plan.departs ? "Fly home" : "—"}
                        </td>
                      );
                    }
                    return (
                      <td key={slot} className="py-2.5 pr-3">
                        {t[slot].items.map((v, n) => {
                          const pi = ps.items.find((x) => x.key === v.item.key) ?? ps.items[n];
                          const title = v.resolved.kind === "stay" ? v.resolved.stay.title : v.resolved.activity.title;
                          const sum = pi && pi.id !== STAY_ID ? plan.rsvps[pi.key] : null;
                          const why = pi ? pi.reasons.map((r) => clean(r.text)).find(Boolean) : "";
                          return (
                            <div key={v.item.key} className="mb-1.5">
                              <p className="font-semibold">{title}</p>
                              {why && <p className="text-[11.5px] text-[#555]">{why}</p>}
                              {sum && sum.in + sum.skip > 0 && (
                                <p className="text-[11.5px] text-[#555]">
                                  {sum.in} in · {sum.skip} skipping
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {ps.split && (
                          <p className="text-[11.5px] font-semibold">
                            The group splits: {ps.split.a.votes} → {titleOf(ps.split.a.id)}, {ps.split.b.votes} → {titleOf(ps.split.b.id)}
                          </p>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 break-inside-avoid text-[13px]">
          <p className="font-bold">Budget estimate</p>
          <p>
            About {money(plan.budget.perPerson[0])}–{money(plan.budget.perPerson[1])} per person (USD): activities, shared transport and a mid-range place to
            stay. Flights not included.
          </p>
        </section>
        <p className="mt-8 text-[11px] text-[#777]">Planned together on Caravan · {preset.destination.season}</p>
      </div>
    </main>
  );
}
