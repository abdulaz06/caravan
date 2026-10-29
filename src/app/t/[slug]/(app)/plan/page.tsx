import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PlanView } from "@/components/plan/plan-view";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { pageContext } from "@/lib/server/page-context";
import { loadPublicPlan } from "@/lib/server/plan";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "The plan" };

export default async function PlanPage({ params }: PageProps<"/t/[slug]/plan">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const ctx = await pageContext(trip, me);
  const [plan, rates, mine] = await Promise.all([loadPublicPlan(trip, me), getRates(), db().getItinerary(me.id).catch(() => null)]);
  const currency = await initialCurrency(mine?.data.preferences.currency, trip.rules.defaultCurrency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <PlanView plan={plan} isOrganizer={ctx.isOrganizer} />
    </CurrencyProvider>
  );
}
