import { error, json, readJson } from "@/lib/server/http";
import { checkAdminPassword, startAdminSession } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = await readJson(req);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !checkAdminPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return error("Wrong password", 401);
  }
  await startAdminSession();
  return json({ ok: true });
}
