import { db } from "@/lib/server/db";
import { json } from "@/lib/server/http";

/** Names of everyone who has joined — powers the "I've been here before" list. */
export async function GET() {
  const people = await db().listParticipants();
  return json(people.map((p) => ({ id: p.id, name: p.display_name })));
}
