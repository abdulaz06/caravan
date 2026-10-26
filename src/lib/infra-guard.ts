// Caravan started life as a fork of a private trip planner that real people
// still use. This guard makes sure a Caravan deployment can never be pointed
// at that project's database: next.config.ts runs it before `dev`, `build`
// and `start`, and the server runs it again before it opens a database
// connection. The protected project refs are stored as SHA-256 hashes, so the
// public repo never names them.
//
// Plain TypeScript with no imports beyond node:crypto, so next.config.ts and
// the Node scripts can load it directly.
import { createHash } from "node:crypto";

/** SHA-256 of each Supabase project ref Caravan must never connect to. */
const BLOCKED_REFS = new Set(["f014e581a1d1d94aaf5a79dcb37f96bbb755fb444c62740d0a8e5e0a69f68b1e"]);

/** Supabase project refs are 20 lowercase letters/digits. */
const REF_LENGTH = 20;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Does this text contain a protected project ref anywhere (any 20-character window)? */
export function containsBlockedRef(text: string | undefined | null, blocked: ReadonlySet<string> = BLOCKED_REFS): boolean {
  if (!text) return false;
  const s = text.toLowerCase();
  for (let i = 0; i + REF_LENGTH <= s.length; i++) {
    if (blocked.has(sha256(s.slice(i, i + REF_LENGTH)))) return true;
  }
  return false;
}

export { sha256 as hashRef };

/** Legacy Supabase keys are JWTs whose payload names the project ("ref"). */
function jwtRef(key: string | undefined): string | null {
  const payload = key?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ref?: unknown };
    return typeof json.ref === "string" ? json.ref : null;
  } catch {
    return null;
  }
}

/** Every reason the given environment points at a protected project (empty = safe). */
export function infraProblems(env: Record<string, string | undefined> = process.env): string[] {
  const out: string[] = [];
  if (containsBlockedRef(env.SUPABASE_URL)) out.push("SUPABASE_URL points at a protected project.");
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) {
    if (containsBlockedRef(jwtRef(env[name]))) out.push(`${name} belongs to a protected project.`);
  }
  return out;
}

/** Throw (refuse to boot) if the environment points at a protected project. */
export function assertSafeInfra(env: Record<string, string | undefined> = process.env): void {
  const problems = infraProblems(env);
  if (problems.length) {
    throw new Error(
      `Refusing to start Caravan: ${problems.join(" ")} Caravan needs its own Supabase project — see SETUP.md.`,
    );
  }
}
