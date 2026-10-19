// End-to-end flow test + screenshots.
// Usage: node --env-file=.env.local scripts/flow.mjs <outDir>
//   env: BASE (default http://localhost:3000), CHROME_PATH, VIEW (e.g. 375x667), PIN, ADMIN_PASSWORD
//   Against a local-store server on :3100 (LANKS_LOCAL_STORE=1) it also tests the
//   v1 → v2 migration by writing an old itinerary straight into .data/dev-db.json.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "screenshots/flow";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH;
const stamp = Date.now().toString(36).slice(-4);
const NAME = `Tester ${stamp}`;
const NAME2 = `Friend ${stamp}`;
const NAME3 = `Oldtimer ${stamp}`;
const PIN = process.env.PIN ?? "4826";
const LOCAL_DB = path.join(process.cwd(), ".data", "dev-db.json");
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

async function eventually(fn, timeout = 9000) {
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
  if (!(await Promise.resolve(cond).catch(() => false))) {
    errors.push(msg);
    console.log("  ✗", msg);
  } else console.log("  ✓", msg);
}

const saved = (pg, pred) =>
  eventually(async () => {
    const r = await pg.request.get(base + "/api/itinerary").then((x) => x.json());
    return r?.data && pred(r) ? r : null;
  });

async function join(page, name) {
  await page.goto(base + "/join");
  await page.getByLabel("What should we call you?").fill(name);
  await page.locator("#pin").fill(PIN);
  await page.getByRole("button", { name: /Let's go/ }).click();
  await page.waitForURL("**/trip**");
}

async function pickDates(page, startLabel, endLabel) {
  await page.getByRole("button", { name: startLabel }).first().click();
  await page.getByRole("button", { name: endLabel }).first().click();
}

const row = (page, i) => page.locator("ol > li").nth(i);
const sheet = (page) => page.getByRole("dialog").last();

async function openSlot(page, i, which) {
  await row(page, i).getByRole("button", { name: which }).first().click();
  await page.waitForTimeout(900);
}

async function closeSheet(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

// ── User 1: Mon 28 Dec – Sat 2 Jan (6 days → Colombo 2, Galle 4; NYE in Galle) ──
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text()) && errors.push(`console: ${m.text()}`));

step("Welcome & join");
await page.goto(base + "/");
await shot(page, "welcome");
await join(page, NAME);

step("Dates spanning NYE");
await pickDates(page, "Mon 28 Dec", "Sat 2 Jan");
await page.getByRole("button", { name: /Exact dates/ }).click();
await expect(page.getByText("6 days").first().waitFor({ timeout: 4000 }).then(() => true), "trip length shows 6 days");
await shot(page, "dates-picked");
await page.getByRole("button", { name: /Build days/ }).click();
await page.waitForTimeout(800);

step("Base split, section headers and fixed travel legs");
await expect(page.getByLabel("Colombo 2 days, then Galle 4 days").isVisible(), "6 days → Colombo 2 · Galle 4");
await expect(page.getByRole("heading", { name: "Colombo", exact: true }).isVisible(), "Colombo section header");
await expect(page.getByRole("heading", { name: "Galle", exact: true }).isVisible(), "Galle section header");
await expect(row(page, 0).getByText("Land at Colombo airport (CMB) → Colombo").isVisible(), "arrival leg on Day 1");
await expect(row(page, 2).getByText("Road trip · Colombo → Galle").isVisible(), "Colombo → Galle leg on Day 3");
await expect(row(page, 5).getByText("Road trip · Galle → Colombo airport (CMB)").isVisible(), "departure leg on the last day");
await shot(page, "build-empty");
await shot(page, "build-empty-full", { full: true });

step("Colombo day: only Colombo options; Kandy by road");
await openSlot(page, 1, "Pick your daytime");
await expect(sheet(page).getByRole("button", { name: /^Pick Colombo by tuk-tuk/ }).isVisible(), "Colombo option offered on a Colombo day");
await expect(sheet(page).getByRole("button", { name: /^Pick Blue whale watching/ }).count().then((c) => c === 0), "no Galle-area option on a Colombo day");
await shot(page, "matchup-colombo-day", { wait: 300 });
await sheet(page).getByRole("button", { name: /^Pick Kandy day trip/ }).click();
await page.waitForTimeout(800);
await shot(page, "kandy-transport-choice");
await sheet(page).getByRole("button", { name: /^Road trip:/ }).click();
await page.waitForTimeout(300);
await sheet(page).getByRole("button", { name: /Pick for Day 2 · Road trip/ }).click();
await page.waitForTimeout(1300);
let r = await saved(page, (x) => x.data.days[1].day?.optionId === "kandy-day-trip");
await expect(r.value?.data.days[1].day.transport === "road", "Kandy saved with transport: road");
await expect(row(page, 1).getByText("Drive back · Kandy → Colombo").isVisible(), "Kandy return leg (road) shown");

step("Galle day: only Galle options; pick surf from the detail sheet");
await openSlot(page, 2, "Pick your daytime");
await expect(sheet(page).getByRole("button", { name: /^Pick Learn to surf in Weligama Bay/ }).isVisible(), "Galle option offered on a Galle day");
await expect(sheet(page).getByRole("button", { name: /^Pick Colombo by tuk-tuk/ }).count().then((c) => c === 0), "no Colombo option on a Galle day");
await shot(page, "matchup-galle-day", { wait: 300 });
await sheet(page).getByRole("button", { name: /More about Learn to surf/ }).click();
await shot(page, "option-detail", { wait: 900 });
await page.getByRole("button", { name: /Pick for Day 3/ }).last().click();
await page.waitForTimeout(1300);

step("Secret Jungle Party on a Wednesday → gentle Friday warning");
await openSlot(page, 2, "Pick your evening");
await expect(sheet(page).getByText("Fridays only").first().isVisible(), "'Fridays only' badge on the tile");
await shot(page, "matchup-jungle-party", { wait: 300 });
await sheet(page).getByRole("button", { name: /^Pick Secret Jungle Party/ }).click();
await page.waitForTimeout(1300);
await expect(row(page, 2).getByText(/only runs on Fridays — this is a Wednesday/).isVisible(), "non-Friday warning shown, pick not blocked");
await shot(page, "jungle-party-warning");

step("NYE in the Galle base");
await openSlot(page, 3, "Pick your New Year's Eve");
await expect(sheet(page).getByRole("button", { name: /^Pick NYE in Galle Fort/ }).isVisible(), "Galle NYE pair offered on 31 Dec");
await expect(sheet(page).getByRole("button", { name: /^Pick NYE rooftop countdown in Colombo/ }).count().then((c) => c === 0), "Colombo NYE not offered in Galle");
await shot(page, "matchup-nye-galle", { wait: 300 });
await sheet(page).getByRole("button", { name: /^Pick NYE beach party/ }).click();
await page.waitForTimeout(1300);

step("Repeats, both halves of a pair, Stay in day + night");
await openSlot(page, 4, "Pick your daytime");
await expect(sheet(page).getByText("Also on Day 3").first().isVisible(), "soft 'Also on Day 3' hint on a repeat");
await sheet(page).getByRole("button", { name: /^Pick Unawatuna & Jungle Beach day/ }).click();
await page.waitForTimeout(1100);
await openSlot(page, 5, "Daytime · before you fly");
await sheet(page).getByRole("button", { name: /^Pick Learn to surf in Weligama Bay/ }).click();
await page.waitForTimeout(1100);
await openSlot(page, 0, "Landing day");
await shot(page, "matchup-stay-day", { wait: 300 });
await sheet(page).getByRole("button", { name: /^Pick Stay in/ }).click();
await page.waitForTimeout(1100);
await openSlot(page, 4, "Pick your evening");
await sheet(page).getByRole("button", { name: /^Pick Stay in/ }).click();
await page.waitForTimeout(1500);
r = await saved(page, (x) => x.data.days[4].night?.type === "stay" && x.data.days[0].day?.type === "stay");
const dd = r.value?.data.days ?? [];
await expect(dd[2]?.day?.optionId === "weligama-surf-lesson" && dd[5]?.day?.optionId === "weligama-surf-lesson", "same option saved on Day 3 and Day 6");
await expect(dd[4]?.day?.optionId === "unawatuna-jungle-beach", "other half of the surf pair on Day 5");
await expect(dd[0]?.day?.type === "stay" && dd[4]?.night?.type === "stay", "Stay in saved on a daytime and an evening");

step("Add-ons (filtered by base) + switch Kandy to the train");
await row(page, 1).getByRole("button", { name: "Add-on" }).first().click();
await page.waitForTimeout(800);
await expect(sheet(page).getByRole("button", { name: /^Snorkelling/ }).count().then((c) => c === 0), "no Galle add-ons on a Colombo pick");
await sheet(page).getByRole("button", { name: /^Bowling/ }).click();
await page.waitForTimeout(400);
await sheet(page).getByRole("button", { name: /^Arcade, VR/ }).click();
await page.waitForTimeout(400);
await sheet(page).getByRole("button", { name: /^Scenic train:/ }).click();
await shot(page, "option-sheet-kandy", { wait: 500 });
await closeSheet(page);
await row(page, 2).getByRole("button", { name: "Add-on" }).first().click();
await page.waitForTimeout(800);
await expect(sheet(page).getByRole("button", { name: /^Bowling/ }).count().then((c) => c === 0), "no Colombo add-ons on a Galle pick");
await sheet(page).getByRole("button", { name: /^Snorkelling/ }).click();
await page.waitForTimeout(400);
await closeSheet(page);
r = await saved(page, (x) => x.data.days[2].day?.addOns?.includes("snorkel-jungle-beach") && x.data.days[1].day?.transport === "train");
await expect(
  JSON.stringify(r.value?.data.days[1].day.addOns) === JSON.stringify(["playdium-bowling", "playdium-arcade"]),
  "Colombo add-ons saved on the Kandy pick",
);
await expect(r.value?.data.days[1].day.transport === "train", "Kandy switched to the scenic train");
await expect(row(page, 1).getByText("Train back · Kandy → Colombo Fort").isVisible(), "train return leg shown");
await expect(row(page, 2).getByText("Snorkelling").isVisible(), "add-on chip on the day card");
await shot(page, "build-addons");

step("Quick fill keeps manual picks");
await page.getByRole("button", { name: /Quick fill/ }).click();
await page.getByRole("button", { name: /Fill the empty slots/ }).click();
await page.waitForTimeout(1300);
r = await saved(page, (x) => x.data.days[1].night && x.data.days[3].day);
await expect(r.value?.data.days[1].day.optionId === "kandy-day-trip" && r.value?.data.days[3].night?.pairId === "nye-galle", "manual picks kept");
await shot(page, "build-quickfilled", { full: true });

step("Reorder within Galle; NYE evening stays on 31 Dec; can't cross into Colombo");
const before = r.value;
const h4 = page.getByRole("button", { name: "Drag to reorder day 4" });
await h4.focus();
await page.keyboard.press("Space");
await page.waitForTimeout(150);
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(250);
await page.keyboard.press("Space");
await page.waitForTimeout(1300);
r = await saved(page, (x) => JSON.stringify(x.data.days[2].day) === JSON.stringify(before.data.days[3].day));
await expect(!!r.value, "day 4's daytime moved to day 3");
await expect(r.value?.data.days[3].night?.pairId === "nye-galle", "NYE evening still pinned to 31 Dec");
const colomboBefore = JSON.stringify((r.value ?? before).data.days.slice(0, 2));
const h3 = page.getByRole("button", { name: "Drag to reorder day 3" });
await h3.focus();
await page.keyboard.press("Space");
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
}
await page.keyboard.press("Space");
await page.waitForTimeout(1300);
const afterCross = await page.request.get(base + "/api/itinerary").then((x) => x.json());
await expect(JSON.stringify(afterCross.data.days.slice(0, 2)) === colomboBefore, "Colombo days untouched by a Galle drag");

step("Moving a pick: other-base days are unavailable");
await page.getByRole("button", { name: /^Daytime: Kandy/ }).click();
await page.waitForTimeout(700);
await sheet(page).getByRole("button", { name: "Move to another day" }).click();
await page.waitForTimeout(500);
await expect(sheet(page).getByText("Galle base").first().isVisible(), "Galle days marked unavailable for a Colombo pick");
await shot(page, "slot-move-bases");
await closeSheet(page);

step("Currency switching");
await page.getByRole("button", { name: /^Currency:/ }).click();
await page.waitForTimeout(400);
await shot(page, "currency-picker");
await page.getByRole("option", { name: /LKR/ }).click();
await page.waitForTimeout(800);
await expect(page.getByRole("button", { name: "Open trip budget" }).innerText().then((t) => /Rs|LKR/.test(t)), "budget pill shows rupees");
r = await saved(page, (x) => x.data.preferences.currency === "LKR");
await expect(!!r.value, "currency saved to preferences");
await shot(page, "build-lkr");

step("Budget tracker");
await page.getByRole("button", { name: "Open trip budget" }).click();
await page.waitForTimeout(900);
await shot(page, "budget-sheet");
const total = () => sheet(page).locator("p", { hasText: /^≈ / }).first().innerText();
const t0 = await total();
await sheet(page).getByText("Include places to stay").click();
await page.waitForTimeout(600);
const t1 = await total();
await expect(t0 !== t1, `total changes when accommodation is toggled (${t0} → ${t1})`);
await sheet(page).locator("label", { hasText: "Learn to surf" }).first().click();
await page.waitForTimeout(600);
const t2 = await total();
await expect(t1 !== t2, `total drops when a line is unticked (${t1} → ${t2})`);
r = await saved(page, (x) => x.data.budget?.accommodation === false && (x.data.budget?.excluded ?? []).length > 0);
await expect(!!r.value, "budget toggles saved (accommodation off + one excluded line)");
await sheet(page).getByText("Include places to stay").click();
await page.waitForTimeout(500);
await sheet(page).getByText("Untick anything you").scrollIntoViewIfNeeded();
await shot(page, "budget-sheet-lines", { wait: 400 });
await closeSheet(page);
await page.getByRole("button", { name: /^Currency:/ }).click();
await page.getByRole("option", { name: /GBP/ }).click();
await page.waitForTimeout(600);
await expect(page.getByRole("button", { name: "Open trip budget" }).innerText().then((t) => t.includes("£")), "switched to GBP");

step("Preferences, review & submit");
await page.getByRole("button", { name: /Next: a few extras/ }).click();
await page.getByRole("button", { name: /^●●●\s/ }).click();
await page.getByRole("button", { name: /Villa with pool/ }).click();
await page.getByRole("button", { name: "Surfing" }).click();
await page.getByLabel("Flying in from").fill("London");
await shot(page, "prefs");
await page.getByRole("button", { name: /Review my trip/ }).click();
await page.waitForTimeout(2200);
await shot(page, "review");
await shot(page, "review-full", { full: true });
await page.getByRole("button", { name: /Submit my trip/ }).click();
await page.waitForTimeout(1400);
await shot(page, "submitted");
await page.getByRole("button", { name: "Back to my trip" }).click();
await page.getByRole("button", { name: /Edit extras/ }).click();
await page.getByRole("button", { name: "Hiking" }).click();
r = await saved(page, (x) => x.data.preferences.interests?.includes("hiking"));
await expect(r.value?.status === "submitted", "edit after submit saved, still submitted");

// ── User 2: base splits for 4 / 5 / 8 days, NYE in the Colombo base ──
step("Second user: splits for 4, 5 and 8 days; NYE in Colombo");
const ctx2 = await browser.newContext(phone);
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errors.push(`pageerror(2): ${e.message}`));
await p2.goto(base + "/join");
await p2.getByLabel("What should we call you?").fill(NAME.toUpperCase());
await p2.locator("#pin").fill("1111");
await p2.getByRole("button", { name: /Let's go/ }).click();
await p2.waitForTimeout(700);
await expect(p2.getByText(/already a/).isVisible(), "case-insensitive duplicate name rejected");
await join(p2, NAME2);
const datesTab = p2.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Dates" });
for (const [s, e, label, name] of [
  ["Sat 26 Dec", "Tue 29 Dec", "Colombo 1 day, then Galle 3 days", "build-4-days"],
  ["Sat 26 Dec", "Wed 30 Dec", "Colombo 2 days, then Galle 3 days", null],
  ["Wed 30 Dec", "Wed 6 Jan", "Colombo 2 days, then Galle 6 days", "build-8-days"],
]) {
  await datesTab.click();
  await p2.waitForTimeout(500);
  await pickDates(p2, s, e);
  await p2.getByRole("button", { name: /Build days/ }).click();
  await p2.waitForTimeout(700);
  await expect(p2.getByLabel(label).isVisible(), `${s} → ${e}: ${label}`);
  if (name) await shot(p2, name);
}
await openSlot(p2, 1, "Pick your New Year's Eve");
await expect(sheet(p2).getByRole("button", { name: /^Pick NYE rooftop countdown in Colombo/ }).isVisible(), "Colombo NYE pair when 31 Dec is a Colombo day");
await expect(sheet(p2).getByRole("button", { name: /^Pick NYE by the sea at Mount Lavinia/ }).isVisible(), "Mount Lavinia NYE offered");
await shot(p2, "matchup-nye-colombo", { wait: 300 });
await sheet(p2).getByRole("button", { name: /^Pick NYE by the sea at Mount Lavinia/ }).click();
await p2.waitForTimeout(1100);
await p2.getByRole("button", { name: /Quick fill/ }).click();
await p2.getByRole("button", { name: /Fill the empty slots/ }).click();
await p2.waitForTimeout(1500);
const q2 = await saved(p2, (x) => x.data.days.length === 8 && x.data.days[2].day);
await expect(q2.value?.data.days[1].night?.optionId === "nye-mount-lavinia", "NYE pick kept through quick fill");
await p2.goto(base + "/trip?step=review");
await p2.getByRole("button", { name: /Submit my trip/ }).click();
await p2.waitForTimeout(1200);
await p2.goto(base + "/group");
await shot(p2, "group-full", { full: true, wait: 1200 });
await p2.getByRole("link", { name: new RegExp(NAME) }).first().click();
await p2.waitForURL("**/group/**");
await shot(p2, "person-view", { wait: 2000 });
await shot(p2, "person-view-full", { full: true });

// ── User 3: an old (v1, pre-bases) itinerary gets upgraded ───────────
step("Migration of an old itinerary");
if (fs.existsSync(LOCAL_DB) && base.includes(":3100")) {
  const ctx3 = await browser.newContext(phone);
  const p3 = await ctx3.newPage();
  p3.on("pageerror", (e) => errors.push(`pageerror(3): ${e.message}`));
  await join(p3, NAME3);
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  const me = dbj.participants.find((x) => x.display_name === NAME3);
  dbj.itineraries = dbj.itineraries.filter((x) => x.participant_id !== me.id);
  const now = new Date().toISOString();
  dbj.itineraries.push({
    participant_id: me.id,
    status: "submitted",
    submitted_at: now,
    updated_at: now,
    data: {
      version: 1,
      startDate: "2026-12-29",
      endDate: "2027-01-02",
      flexibility: "exact",
      preferences: {},
      days: [
        { id: "m1", day: { pairId: "ella-hikes", optionId: "ella-rock" }, night: { type: "chill" } },
        { id: "m2", day: { pairId: "mirissa-ocean", optionId: "mirissa-whale-watching" }, night: { pairId: "colombo-nights", optionId: "colombo-club-night" } },
        { id: "m3", day: { pairId: "first-day", optionId: "colombo-tuk-tuk" }, night: { pairId: "nye", optionId: "nye-mirissa-beach-party" } },
        { id: "m4", day: { pairId: "sigiriya-rocks", optionId: "pidurangala-sunrise" }, night: null },
        { id: "m5", day: null, night: null },
      ],
    },
  });
  fs.writeFileSync(LOCAL_DB, JSON.stringify(dbj, null, 2));
  await p3.goto(base + "/trip");
  await p3.waitForTimeout(1200);
  await expect(p3.getByText(/locked in Colombo \+ Galle as bases/).isVisible(), "one-time migration note shown");
  await expect(p3.getByText(/\(4 cleared\)/).isVisible(), "4 out-of-base picks cleared");
  await shot(p3, "migration-note");
  const mig = await saved(p3, (x) => x.data.version === 2);
  const md = mig.value?.data.days ?? [];
  await expect(
    md[2]?.night?.pairId === "nye-galle" && md[0]?.night?.type === "stay" && md[1]?.night?.optionId === "colombo-club-night",
    "valid picks kept (old NYE → Galle pair, chill → Stay in)",
  );
  await expect(md.slice(0, 4).every((d) => d.day === null), "out-of-base daytimes cleared");
  await expect(mig.value?.status === "submitted", "still submitted after the upgrade");
  await p3.reload();
  await p3.waitForTimeout(1500);
  await expect(p3.getByText(/locked in Colombo \+ Galle as bases/).count().then((c) => c === 0), "note doesn't come back after reload");
  await ctx3.close();
} else {
  console.log("  (skipped: needs the local-store server on :3100)");
}

step("Returning login on a new device");
const ctx4 = await browser.newContext(phone);
const p4 = await ctx4.newPage();
await p4.goto(base + "/join?returning=1");
await p4.getByRole("button", { name: NAME, exact: true }).click();
await p4.locator("#login-pin").fill(PIN);
await p4.waitForURL("**/trip**");
await expect(p4.url().includes("/trip"), "returning user logged in with PIN");
await ctx4.close();

// ── Admin ────────────────────────────────────────────────────────────
step("Admin: lock + exports");
const ctxA = await browser.newContext(phone);
const pa = await ctxA.newPage();
await pa.goto(base + "/admin");
await pa.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
await pa.getByRole("button", { name: /Enter/ }).click();
await pa.waitForTimeout(1200);
await shot(pa, "admin", { full: true });
await pa.getByRole("switch", { name: /Lock edits/ }).click();
await pa.waitForTimeout(800);
for (const f of ["json", "csv", "csv-long"]) {
  const res = await pa.request.get(`${base}/api/admin/export?format=${f}`);
  const body = await res.text();
  await expect(res.ok() && body.includes(NAME), `export ${f} works and includes ${NAME}`);
  fs.writeFileSync(path.join(outDir, `export.${f === "json" ? "json" : `${f}.csv`}`), body);
  if (f === "csv-long") {
    const mine = body.split("\n").filter((l) => l.startsWith(NAME + ","));
    await expect(mine.filter((l) => l.includes(",add-on,")).length >= 3, "long CSV has one row per add-on");
    await expect(mine.some((l) => l.includes(",kandy-day-trip,") && l.includes(",train,")), "long CSV has Kandy with its transport");
    await expect(mine.some((l) => l.includes(",colombo,")) && mine.some((l) => l.includes(",galle,")), "long CSV carries the base on each row");
  }
  if (f === "csv") await expect(body.split("\n")[0].includes("budget_estimate_low_usd"), "wide CSV has budget totals");
  if (f === "json") await expect(body.includes("totalUsd"), "JSON export includes the computed budget");
}
await page.goto(base + "/trip");
await page.waitForTimeout(1200);
await expect(page.getByText(/Edits are closed/).first().isVisible(), "locked banner visible to participants");
const put = await page.request.put(base + "/api/itinerary", { data: { data: afterCross.data } });
await expect(put.status() === 423, "API rejects edits while locked");
await pa.getByRole("switch", { name: /Lock edits/ }).click();
await pa.waitForTimeout(600);

step("Desktop");
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctxD.addCookies(await ctx.cookies());
const pd = await ctxD.newPage();
await pd.goto(base + "/trip?step=build");
await shot(pd, "desktop-build", { wait: 1800 });
await pd.goto(base + "/trip?step=review");
await shot(pd, "desktop-review", { wait: 2400 });
await ctxD.close();

step("Cleanup: delete the test users (never the organizer)");
const PROTECTED = /^abdul$/i;
const TEST = [NAME, NAME2, NAME3];
const everyone = await pa.request.get(base + "/api/people").then((x) => x.json());
for (const person of everyone.filter((x) => TEST.includes(x.name) && !PROTECTED.test(x.name))) {
  const res = await pa.request.delete(`${base}/api/admin/participants/${person.id}`);
  await expect(res.ok(), `deleted ${person.name}`);
}
const left = await pa.request.get(base + "/api/people").then((x) => x.json());
await expect(!left.some((x) => TEST.includes(x.name)), "test users gone");
await expect((await pa.request.post(base + "/api/admin/lock", { data: { locked: false } })).ok(), "edits left unlocked");

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n- ${errors.join("\n- ")}` : "\nAll checks passed ✓");
process.exit(errors.length ? 1 : 0);
