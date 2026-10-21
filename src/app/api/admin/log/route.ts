import { db } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { asOrganizer } from "@/lib/server/organizer";

export async function GET() {
  return asOrganizer("admin", async () => json(await db().listLog(300)));
}
