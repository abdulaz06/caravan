import { error, json } from "@/lib/server/http";
import { getPopular } from "@/lib/server/popular";
import { currentParticipant } from "@/lib/server/session";

/** 🔥 Pick counts of the popular options (counts only — never who). Cached for a few minutes on the server. */
export async function GET() {
  const me = await currentParticipant();
  if (!me) return error("Sign in first", 401);
  return json(await getPopular());
}
