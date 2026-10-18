import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinFlow } from "@/components/join-flow";
import { db } from "@/lib/server/db";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "Join the trip" };

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  if (await currentParticipant()) redirect("/trip");
  const { returning } = await searchParams;
  const people = (await db().listParticipants()).map((p) => ({ id: p.id, name: p.display_name }));
  return <JoinFlow people={people} startReturning={returning === "1" && people.length > 0} />;
}
