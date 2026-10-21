import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PeekView } from "@/components/group/peek-view";
import { db } from "@/lib/server/db";
import { loadRules } from "@/lib/server/rules";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "👀 Peek" };

/** The keyhole page. The plan itself comes from /api/peek/[id], which returns only what a peek may show. */
export default async function PeekPage({ params }: PageProps<"/group/peek/[id]">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const { rules } = await loadRules();
  const { id } = await params;
  if (!rules.peek || id === me.id) redirect("/group");
  const person = await db().getParticipant(id);
  if (!person) notFound();
  return <PeekView id={person.id} name={person.display_name} />;
}
