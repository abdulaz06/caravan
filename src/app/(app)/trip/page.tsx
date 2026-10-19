import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { TripApp } from "@/components/trip/trip-app";
import { emptyItinerary, migrationLoss, normalize } from "@/lib/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "My trip" };

export default async function TripPage({ searchParams }: PageProps<"/trip">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const [row, settings, sp, rates] = await Promise.all([
    db().getItinerary(me.id),
    db().getSettings(),
    searchParams,
    getRates(),
  ]);
  const data = row ? normalize(row.data) : emptyItinerary();
  // Itineraries saved before the fixed 6-day structure are moved over; -1 = already current.
  const migrated = row ? migrationLoss(row.data) : -1;
  const currency = await initialCurrency(data.preferences.currency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <TripApp
        name={me.display_name}
        initialData={data}
        initialStatus={row?.status ?? "draft"}
        initialUpdatedAt={row?.updated_at ?? null}
        editsLocked={settings.edits_locked}
        requestedStep={typeof sp.step === "string" ? sp.step : undefined}
        migratedPicks={migrated}
        needsUpgradeSave={migrated >= 0}
      />
    </CurrencyProvider>
  );
}
