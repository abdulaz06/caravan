import type { Metadata } from "next";
import { TripShell } from "@/components/trip-shell";
import { BRAND } from "@/lib/brand";
import { loadTrip, tripFromParams } from "@/lib/server/trip";

export async function generateMetadata({ params }: LayoutProps<"/t/[slug]">): Promise<Metadata> {
  const trip = await loadTrip((await params).slug);
  if (!trip) return { title: "Trip not found" };
  const d = trip.preset.destination;
  const title = `${trip.trip.name} · Build your dream ${trip.preset.name} trip`;
  const og = `/og/${trip.presetId}.jpg`;
  const description = `${d.tagline}. ${d.season}. Pick your dates, choose your days and nights, and help shape the plan. Planned together on ${BRAND.name}.`;
  return {
    title: { default: trip.trip.name, template: `%s · ${trip.trip.name}` },
    description,
    // A link preview per destination (scripts/make-brand-assets.mjs → public/og/<preset>.jpg).
    openGraph: { title, description, siteName: BRAND.name, type: "website", images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
    // Invite links are private: keep every trip out of search engines.
    robots: { index: false, follow: false },
  };
}

/** Every page of a trip: its preset's theme, engine and paths. */
export default async function TripLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  return <TripShell trip={await tripFromParams(params)}>{children}</TripShell>;
}
