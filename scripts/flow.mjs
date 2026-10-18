// End-to-end flow test + screenshots (phone viewport).
// Usage: node scripts/flow.mjs <outDir>   (env: BASE, CHROME_PATH, NAME, PIN, ADMIN_PASSWORD)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "screenshots";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH;
const stamp = Date.now().toString(36).slice(-4);
const NAME = process.env.NAME ?? `Tester ${stamp}`;
const NAME2 = `Friend ${stamp}`;
const PIN = process.env.PIN ?? "4826";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const [vw, vh] = (process.env.VIEW ?? "390x844").split("x").map(Number);
const phone = { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let n = 0;
const errors = [];

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 700);
  if (opts.full) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 250) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
  }
  const file = path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.full });
  console.log("📸", file);
}

async function eventually(fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn().catch(() => null);
    if (v) return { value: v, ms: Date.now() - t0 };
    await new Promise((r) => setTimeout(r, 250));
  }
  return { value: null, ms: Date.now() - t0 };
}

function step(label) {
  console.log(`\n▶ ${label}`);
}

async function expect(cond, msg) {
  if (!(await cond)) {
    errors.push(msg);
    console.log("  ✗", msg);
  } else console.log("  ✓", msg);
}

async function join(page, name) {
  await page.goto(base + "/join");
  await page.getByLabel("What should we call you?").fill(name);
  await page.locator("#pin").fill(PIN);
  await page.getByRole("button", { name: /Let's go/ }).click();
  await page.waitForURL("**/trip**");
}

async function pickDates(page, startLabel, endLabel) {
  await page.getByRole("button", { name: startLabel, exact: false }).first().click();
  await page.getByRole("button", { name: endLabel, exact: false }).first().click();
}

// ── User 1 ───────────────────────────────────────────────────────────
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text()) && errors.push(`console: ${m.text()}`));

step("Welcome");
await page.goto(base + "/");
await shot(page, "welcome");

step("Join");
await page.goto(base + "/join");
await shot(page, "join");
await page.getByLabel("What should we call you?").fill(NAME);
await page.locator("#pin").fill(PIN);
await shot(page, "join-filled");
await page.getByRole("button", { name: /Let's go/ }).click();
await page.waitForURL("**/trip**");

step("Dates spanning NYE");
await shot(page, "dates-empty");
await pickDates(page, "Mon 28 Dec", "Sat 2 Jan");
await page.getByRole("button", { name: /Exact dates/ }).click();
await shot(page, "dates-picked");
await expect(page.getByText("6 days").isVisible(), "trip length shows 6 days");
await page.getByRole("button", { name: /Build days/ }).click();

step("Build days");
await shot(page, "build-empty");
// open a daytime matchup on day 2
await page.getByRole("button", { name: "Pick your daytime" }).first().click();
await shot(page, "matchup-day", { wait: 900 });
await page.getByRole("button", { name: /More about Learn to surf/ }).click();
await shot(page, "option-detail", { wait: 900 });
await page.getByRole("button", { name: /Pick for Day/ }).click();
await page.waitForTimeout(1200);
// NYE evening
await page.getByRole("button", { name: "Pick your New Year's Eve" }).click();
await shot(page, "matchup-nye", { wait: 900 });
await page.getByRole("button", { name: /Pick NYE beach party/ }).click();
await page.waitForTimeout(1200);
await shot(page, "build-some-picks");

step("Quick fill (keep picks)");
await page.getByRole("button", { name: /Quick fill/ }).click();
await page.getByRole("button", { name: /Fill the empty slots/ }).click();
await page.waitForTimeout(1200);
await shot(page, "build-quickfilled", { full: true });
await expect(page.getByText("NYE beach party on the south coast").first().isVisible(), "NYE pick kept after quick fill");

step("Reorder: move day 4 (31 Dec) to the top — NYE evening must stay on 31 Dec");
const before = await page.request.get(base + "/api/itinerary").then((r) => r.json()).catch(() => null);
const handle = page.getByRole("button", { name: "Drag to reorder day 4" });
await handle.focus();
await page.keyboard.press("Space");
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
}
await page.keyboard.press("Space");
await page.waitForTimeout(1500);
await shot(page, "build-reordered");
const after = await page.request.get(base + "/api/itinerary").then((r) => r.json());
const d0 = after.data.days[0];
const d3 = after.data.days[3];
await expect(before && d0.day?.optionId === before.data.days[3].day?.optionId, "day 4's daytime moved to day 1");
await expect(d3.night?.pairId === "nye", "NYE evening still pinned to 31 Dec after reorder");
await expect(d0.night?.pairId !== "nye", "day 1 did not take the NYE pick");

step("Slot actions: move a daytime pick to another day");
await page.getByRole("button", { name: /^Daytime: / }).first().click();
await page.waitForTimeout(700);
await shot(page, "slot-actions");
await page.getByRole("button", { name: "Move to another day" }).click();
await page.waitForTimeout(500);
await shot(page, "slot-move");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

step("Note");
await page.getByRole("button", { name: /Add a note/ }).first().click();
await page.locator("textarea").fill("Arriving early — keen to hit the beach straight away!");
await page.getByRole("button", { name: "Save note" }).click();
await page.waitForTimeout(500);

step("Preferences");
await page.getByRole("button", { name: /Next: a few extras/ }).click();
await page.getByRole("button", { name: /\$700 – 1,000/ }).click();
await page.getByRole("button", { name: /Villa with pool/ }).click();
await page.getByRole("button", { name: "Surfing" }).click();
await page.getByRole("button", { name: "Nightlife" }).click();
await page.getByRole("button", { name: "Wildlife safari" }).click();
await page.getByLabel("Flying in from").fill("London");
await shot(page, "prefs");
await page.getByRole("button", { name: /Review my trip/ }).click();

step("Review & submit");
await page.waitForTimeout(2200); // let the route animate
await shot(page, "review");
await shot(page, "review-full", { full: true });
await page.getByRole("button", { name: /Submit my trip/ }).click();
await page.waitForTimeout(1300);
await shot(page, "submitted");
await page.getByRole("button", { name: "Back to my trip" }).click();

step("Edit after submit");
await page.getByRole("button", { name: /Edit extras/ }).click();
await page.getByRole("button", { name: "Hiking" }).click();
const polled = await eventually(async () => {
  const r = await page.request.get(base + "/api/itinerary").then((x) => x.json());
  return r?.data?.preferences?.interests?.includes("hiking") ? r : null;
});
const saved = polled.value;
console.log(`  (autosave landed after ${polled.ms} ms, incl. 800 ms debounce)`);
await expect(saved?.status === "submitted", "edit after submit saved, still submitted");

step("Group overview (user 1)");
await page.goto(base + "/group");
await shot(page, "group", { wait: 1200 });
await shot(page, "group-full", { full: true, wait: 300 });

// ── User 2 ───────────────────────────────────────────────────────────
step("Second user joins with a taken name, then a fresh one");
const ctx2 = await browser.newContext(phone);
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errors.push(`pageerror(2): ${e.message}`));
await p2.goto(base + "/join");
await p2.getByLabel("What should we call you?").fill(NAME.toUpperCase());
await p2.locator("#pin").fill("1111");
await p2.getByRole("button", { name: /Let's go/ }).click();
await p2.waitForTimeout(700);
await shot(p2, "join-name-taken");
await expect(p2.getByText(/already a/).isVisible(), "case-insensitive duplicate name rejected");
await join(p2, NAME2);
await pickDates(p2, "Sat 26 Dec", "Wed 30 Dec");
await p2.getByRole("button", { name: /Build days/ }).click();
await p2.getByRole("button", { name: /Quick fill/ }).click();
await p2.waitForTimeout(800);
await p2.goto(base + "/group");
await shot(p2, "group-locked-browse", { full: true });
await p2.goto(base + "/trip?step=review");
await p2.getByRole("button", { name: /Submit my trip/ }).click();
await p2.waitForTimeout(1000);
await p2.goto(base + "/group");
await p2.waitForTimeout(800);
await p2.getByRole("link", { name: new RegExp(NAME) }).first().click();
await p2.waitForURL("**/group/**");
await shot(p2, "person-view", { wait: 2000 });

step("Returning login on a new device");
const ctx3 = await browser.newContext(phone);
const p3 = await ctx3.newPage();
await p3.goto(base + "/join?returning=1");
await shot(p3, "returning-list");
await p3.getByRole("button", { name: NAME }).click();
await p3.locator("#login-pin").fill("0000");
await p3.waitForTimeout(800);
await shot(p3, "returning-wrong-pin");
await p3.locator("#login-pin").fill(PIN);
await p3.waitForURL("**/trip**");
await expect(p3.url().includes("/trip"), "returning user logged in with PIN");

// ── Admin ────────────────────────────────────────────────────────────
step("Admin: lock + export");
const ctxA = await browser.newContext(phone);
const pa = await ctxA.newPage();
await pa.goto(base + "/admin");
await shot(pa, "admin-login");
await pa.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
await pa.getByRole("button", { name: /Enter/ }).click();
await pa.waitForTimeout(1200);
await shot(pa, "admin", { full: true });
await pa.getByRole("switch", { name: /Lock edits/ }).click();
await pa.waitForTimeout(800);
for (const f of ["json", "csv", "csv-long"]) {
  const r = await pa.request.get(`${base}/api/admin/export?format=${f}`);
  const body = await r.text();
  await expect(r.ok() && body.includes(NAME), `export ${f} works and includes ${NAME}`);
  fs.writeFileSync(path.join(outDir, `export.${f === "json" ? "json" : `${f}.csv`}`), body);
}
await page.goto(base + "/trip");
await shot(page, "trip-locked", { wait: 1200 });
await expect(page.getByText(/Edits are closed/).first().isVisible(), "locked banner visible to participants");
const put = await page.request.put(base + "/api/itinerary", { data: { data: saved.data } });
await expect(put.status() === 423, "API rejects edits while locked");
await pa.getByRole("switch", { name: /Lock edits/ }).click();
await pa.waitForTimeout(600);

step("Desktop");
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pd = await ctxD.newPage();
await pd.goto(base + "/");
await shot(pd, "desktop-welcome", { wait: 1500 });
await ctxD.addCookies(await ctx.cookies());
await pd.goto(base + "/trip?step=build");
await shot(pd, "desktop-build", { wait: 1500 });

step("Cleanup: delete the test users");
const everyone = await pa.request.get(base + "/api/people").then((r) => r.json());
for (const person of everyone.filter((x) => x.name === NAME || x.name === NAME2)) {
  const r = await pa.request.delete(`${base}/api/admin/participants/${person.id}`);
  await expect(r.ok(), `deleted ${person.name}`);
}
const left = await pa.request.get(base + "/api/people").then((r) => r.json());
await expect(!left.some((x) => x.name === NAME || x.name === NAME2), "test users gone from the database");
const settings = await pa.request.post(base + "/api/admin/lock", { data: { locked: false } });
await expect(settings.ok(), "edits left unlocked");

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n- ${errors.join("\n- ")}` : "\nAll checks passed ✓");
process.exit(errors.length ? 1 : 0);
