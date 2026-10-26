import { redirect } from "next/navigation";
import { Welcome } from "@/components/welcome";
import { publicCounts } from "@/lib/server/group";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

/** A trip's invite link: the welcome poster, or straight into your plan if you've joined. */
export default async function TripHome({ params }: PageProps<"/t/[slug]">) {
  const trip = await tripFromParams(params);
  if (await currentParticipant(trip.trip)) redirect(tripPath(trip.trip.slug, "/trip"));
  return <Welcome counts={await publicCounts(trip)} />;
}
