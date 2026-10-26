// `npm run dev:local` — the dev server on the local JSON store (.data/dev-db.json),
// never a real database. Port 3100 unless PORT is set. Used by the e2e tests.
import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3100";
const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CARAVAN_LOCAL_STORE: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
