import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinFlow } from "@/components/join-flow";
import { db } from "@/lib/server/db";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "Join the trip" };

export default async function JoinPage({ params, searchParams }: PageProps<"/t/[slug]/join">) {
  const trip = await tripFromParams(params);
  if (await currentParticipant(trip.trip)) redirect(tripPath(trip.trip.slug, "/trip"));
  const { returning } = await searchParams;
  const people = (await db().listParticipants(trip.trip.id)).filter((p) => !p.guest).map((p) => ({ id: p.id, name: p.display_name }));
  return <JoinFlow people={people} startReturning={returning === "1" && people.length > 0} />;
}
