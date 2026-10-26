import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { RulesProvider } from "@/components/rules";
import { TripApp } from "@/components/trip/trip-app";
import { emptyItinerary, hadReplacedPick, migrationLoss, normalize } from "@/lib/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { pageContext } from "@/lib/server/page-context";
import { getPopular } from "@/lib/server/popular";
import { getRates } from "@/lib/server/rates";
import { roommateCandidates } from "@/lib/server/roommates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "My trip" };

export default async function TripPage({ searchParams }: PageProps<"/trip">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const ctx = await pageContext(me);
  const [row, sp, rates, peekCount, popular, candidates] = await Promise.all([
    db().getItinerary(me.id),
    searchParams,
    getRates(),
    db().countPeekers(me.id).catch(() => 0),
    getPopular(),
    roommateCandidates(me.id).catch(() => []),
  ]);
  const data = row ? normalize(row.data) : emptyItinerary();
  // Itineraries saved before the fixed day structure are moved over; -1 = already current.
  const migrated = row ? migrationLoss(row.data) : -1;
  // Adam's Peak picks become the Ella day trip; saving the upgraded plan makes the note one-time.
  const swappedPeak = row ? hadReplacedPick(row.data) : false;
  const currency = await initialCurrency(data.preferences.currency, ctx.rules.defaultCurrency);
  const stamp = row?.stamp && !row.stamp.seen ? row.stamp : null;
  return (
    <RulesProvider rules={ctx.rules}>
      <CurrencyProvider initial={currency} rates={rates}>
        <TripApp
          name={me.display_name}
          initialData={data}
          initialStatus={row?.status ?? "draft"}
          initialUpdatedAt={row?.updated_at ?? null}
          editsLocked={ctx.locked}
          requestedStep={typeof sp.step === "string" ? sp.step : undefined}
          migratedPicks={migrated}
          needsUpgradeSave={migrated >= 0 || swappedPeak}
          swappedPeak={swappedPeak}
          organizers={ctx.organizers}
          isOrganizer={ctx.isOrganizer}
          peekCount={peekCount}
          popular={popular}
          roommateCandidates={candidates}
          stamp={stamp ? { kind: stamp.kind, by: stamp.by, at: stamp.at, lost: stamp.lost, text: stamp.text } : null}
        />
      </CurrencyProvider>
    </RulesProvider>
  );
}
