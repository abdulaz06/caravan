// The e2e server runs on a local JSON store. These helpers find the file that
// holds a trip (the e2e store in CI, the dev store when a local server is
// reused) so a test can shape data the UI can't make on its own — an "old"
// trip, or the demo crew seeded into a real trip. Never a real database.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = [".data/e2e-db.json", ".data/dev-db.json"].map((f) => path.resolve(f));

type FileDb = { trips: { id: string; slug: string; rules: unknown }[]; [k: string]: unknown };

/** The local store file that holds this trip. */
export function storeFileFor(slug: string): string {
  for (const f of CANDIDATES) {
    if (!fs.existsSync(f)) continue;
    const db = JSON.parse(fs.readFileSync(f, "utf8")) as FileDb;
    if (db.trips?.some((t) => t.slug === slug)) return f;
  }
  throw new Error(`no local store holds ${slug}`);
}

/** Edit a trip's row in the local store (the server reads the file on every request). */
export function editTrip(slug: string, fn: (trip: FileDb["trips"][number]) => void) {
  const file = storeFileFor(slug);
  const db = JSON.parse(fs.readFileSync(file, "utf8")) as FileDb;
  fn(db.trips.find((t) => t.slug === slug)!);
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

/** Seed the demo's twelve fictional travellers into a real trip (scripts/lib/seed-crew.ts). */
export function seedCrew(slug: string) {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "--conditions=react-server", "scripts/lib/seed-crew.ts", slug], {
    env: { ...process.env, CARAVAN_LOCAL_STORE: "1", CARAVAN_LOCAL_STORE_FILE: storeFileFor(slug) },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}
