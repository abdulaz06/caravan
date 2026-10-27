import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { GroupView } from "@/components/group/group-view";
import { tripLength } from "@/engine/itinerary";
import { balanceOf } from "@/engine/timeline";
import { initialCurrency } from "@/lib/server/currency-pref";
import { computeStats, loadPeople, realPeople } from "@/lib/server/group";
import { getPopular } from "@/lib/server/popular";
import { PopularProvider } from "@/components/popular";
import { isTestName } from "@/lib/test-users";
import { pageContext } from "@/lib/server/page-context";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "The crew" };

export default async function GroupPage({ params }: PageProps<"/t/[slug]/group">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const ctx = await pageContext(trip, me);
  // Test users ("zz-test-…") and demo guests never show up or count here — except to themselves.
  const [all, rates, popular] = await Promise.all([loadPeople(trip), getRates(), getPopular(trip)]);
  const people = all.filter((p) => p.id === me.id || (!isTestName(p.name) && !p.guest));
  const stats = computeStats(ctx.trip.engine, realPeople(people));
  const mine = people.find((p) => p.id === me.id);
  // Browsing others: after submitting (default), always, or off — a Trip rule.
  const canBrowse = ctx.trip.rules.browse === "always" || (ctx.trip.rules.browse === "after_submit" && mine?.status === "submitted");
  const itineraries = canBrowse
    ? people
        .filter((p) => p.status === "submitted" && p.data)
        .map((p) => ({
          id: p.id,
          name: p.name,
          isMe: p.id === me.id,
          startDate: p.data!.startDate,
          endDate: p.data!.endDate,
          days: tripLength(p.data!),
          picks: p.picks,
          balance: balanceOf(ctx.trip.engine, p.data!).score,
        }))
    : [];
  const order = { submitted: 0, draft: 1, new: 2 } as const;
  const members = people
    .map((p) => ({ id: p.id, name: p.name, isMe: p.id === me.id, status: p.status, organizer: p.role !== "member" }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || order[a.status] - order[b.status]);
  const currency = await initialCurrency(mine?.data?.preferences.currency, ctx.trip.rules.defaultCurrency);
  return (
      <CurrencyProvider initial={currency} rates={rates}>
        <PopularProvider initial={popular}>
        <GroupView
          stats={stats}
          myStatus={mine?.status ?? "new"}
          canBrowse={canBrowse}
          itineraries={itineraries}
          members={members}
          editsLocked={ctx.locked}
          isOrganizer={ctx.isOrganizer}
        />
        </PopularProvider>
      </CurrencyProvider>
  );
}
