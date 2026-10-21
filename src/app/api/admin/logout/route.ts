import { json } from "@/lib/server/http";
import { endConsoleSession } from "@/lib/server/session";

export async function POST() {
  await endConsoleSession();
  return json({ ok: true });
}
