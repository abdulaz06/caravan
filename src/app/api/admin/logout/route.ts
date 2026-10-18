import { json } from "@/lib/server/http";
import { endAdminSession } from "@/lib/server/session";

export async function POST() {
  await endAdminSession();
  return json({ ok: true });
}
