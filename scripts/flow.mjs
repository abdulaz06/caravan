// End-to-end flow test + screenshots.
// Usage: node --env-file=.env.local scripts/flow.mjs <outDir>
//   env: BASE (default http://localhost:3000), CHROME_PATH, VIEW (e.g. 375x667), PIN, ADMIN_PASSWORD
//   Against a local-store server on :3100 (LANKS_LOCAL_STORE=1) it also tests the
//   upgrade of an older (v2) itinerary by writing it straight into .data/dev-db.json.
import { chromium, webkit } from "playwright";
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
const SHOTS = path.join(process.cwd(), "screenshots");
const VIEWSUFFIX = process.env.VIEW ? `-${process.env.VIEW}` : "";
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
/** Save the generated share image from the open share sheet (download), into outDir and screenshots/. */
async function saveShare(pg, format, name) {
  const label = format === "story" ? "Story" : "Square";
  await pg.getByRole("button", { name: `Save ${label} image` }).waitFor({ timeout: 20000 });
  await eventually(() => pg.getByRole("button", { name: `Save ${label} image` }).isEnabled(), 20000);
  const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 20000 }), pg.getByRole("button", { name: `Save ${label} image` }).click()]);
  const file = path.join(outDir, `${name}.png`);
  await dl.saveAs(file);
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.copyFileSync(file, path.join(SHOTS, `${name}.png`));
  return file;
}
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
const ids = (list) => (list ?? []).map((x) => x.id);

async function join(page, name) {
  await page.goto(base + "/join");
  await page.getByLabel("What should we call you?").fill(name);
  await page.locator("#pin").fill(PIN);
  await page.getByRole("button", { name: /Let's go/ }).click();
  await page.waitForURL("**/trip**");
}

const dateBtn = (page, label) => page.getByRole("button", { name: new RegExp(`^${label}`) }).first();
async function tapDate(page, label) {
  await dateBtn(page, label).click();
  await page.waitForTimeout(400);
}
/** Drag the date window from one (in-window) day to another, like a finger would — holding near the edge auto-scrolls. */
async function dragWindow(page, from, to) {
  const c = (b) => [b.x + b.width / 2, b.y + b.height / 2];
  const fromBtn = dateBtn(page, from);
  await fromBtn.scrollIntoViewIfNeeded();
  const a = await fromBtn.boundingBox();
  const vp = page.viewportSize();
  await page.mouse.move(...c(a));
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    const b = await dateBtn(page, to).boundingBox();
    if (b && b.y > 180 && b.y + b.height < vp.height - 210) {
      // Leave the auto-scroll zone, let the page settle, then re-measure and drop on the target.
      await page.mouse.move(c(a)[0], vp.height / 2, { steps: 2 });
      await page.waitForTimeout(250);
      const b2 = await dateBtn(page, to).boundingBox();
      await page.mouse.move(...c(b2), { steps: 6 });
      break;
    }
    await page.mouse.move(c(a)[0], vp.height - 190, { steps: 3 });
    await page.waitForTimeout(80);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const row = (page, i) => page.locator("ol > li").nth(i);
const sheet = (page) => page.getByRole("dialog").last();
const summary = (page) => page.locator(".fixed.bottom-0").last();

async function openSlot(page, i, which) {
  await row(page, i).getByRole("button", { name: which }).first().click();
  await page.waitForTimeout(900);
}
async function closeSheet(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

// ── User 1 ───────────────────────────────────────────────────────────
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text()) && errors.push(`console: ${m.text()}`));

step("Welcome & join");
await page.goto(base + "/");
await shot(page, "welcome");
await join(page, NAME);

step("Dates: 6-day window by default, drag across months, clamp at 31 Jan");
await expect(page.getByRole("button", { name: /6 days · 5 nights/ }).first().getAttribute("aria-pressed").then((v) => v === "true"), "6 days · 5 nights preset selected by default");
await shot(page, "dates-empty");
await tapDate(page, "Sat 26 Dec");
await expect(summary(page).getByText("6 days · 5 nights").isVisible(), "summary shows 6 days · 5 nights");
await expect(summary(page).getByText(/Sat 26 Dec → Thu 31 Dec/).isVisible(), "tapping 26 Dec places a 6-day window to 31 Dec");
await expect(summary(page).getByText("You'd fly home on New Year's Eve").isVisible(), "NYE on the fly-home day is flagged");
await shot(page, "dates-window");
await dragWindow(page, "Mon 28 Dec", "Sat 2 Jan");
await expect(summary(page).getByText(/Thu 31 Dec → Tue 5 Jan/).isVisible(), "dragging the window moved it across into January");
await shot(page, "dates-dragged");
await tapDate(page, "Fri 29 Jan");
await expect(summary(page).getByText(/Tue 26 Jan → Sun 31 Jan/).isVisible(), "window can't run past 31 Jan");
await tapDate(page, "Mon 28 Dec");
await expect(summary(page).getByText(/Mon 28 Dec → Sat 2 Jan/).isVisible(), "window placed Mon 28 Dec → Sat 2 Jan");
await expect(summary(page).getByText(/NYE on Day 4 · Galle/).isVisible(), "NYE lands on Day 4 in Galle");
await page.getByRole("button", { name: /Exact dates/ }).click();
await shot(page, "dates-picked");
let r = await saved(page, (x) => x.data.startDate === "2026-12-28" && x.data.endDate === "2027-01-02" && x.data.days.length === 6);
await expect(!!r.value, "saved as 6 days (28 Dec – 2 Jan)");
await page.getByRole("button", { name: /Build days/ }).click();
await page.waitForTimeout(900);

step("Day structure: Colombo 1 night → Galle 4 nights; Day 1/2/6");
await expect(page.getByLabel("Colombo 1 night, then Galle 4 nights").isVisible(), "header: Colombo 1 night → Galle 4 nights");
await expect(row(page, 0).getByText("Land in Colombo").isVisible(), "Day 1 · Land in Colombo");
await expect(row(page, 0).getByText(/Our only Colombo day/).isVisible(), "Day 1 says it's the only Colombo day");
await expect(row(page, 0).getByText("CMB → Colombo").isVisible(), "Day 1 leg: CMB → Colombo");
await expect(row(page, 1).getByText("Road trip to Galle").first().isVisible(), "Day 2 · Road trip to Galle");
await expect(row(page, 1).getByText(/Road trip · Colombo → Galle/).isVisible(), "Day 2 leg: Colombo → Galle");
await expect(row(page, 5).getByText("Check out & fly home").isVisible(), "Day 6 · Check out & fly home");
await expect(row(page, 5).getByText(/Galle → CMB airport/).isVisible(), "Day 6 leg: Galle → CMB");
await expect(row(page, 5).getByRole("button").count().then((c) => c === 0), "Day 6 has no slots and isn't editable");
await shot(page, "build-empty");
await shot(page, "build-empty-full", { full: true });

step("Day 1: Colombo options only");
await openSlot(page, 0, "Pick your Colombo daytime");
await expect(sheet(page).getByRole("button", { name: /^Pick Colombo by tuk-tuk/ }).isVisible(), "Colombo option on Day 1");
await expect(sheet(page).getByRole("button", { name: /^Pick Galle Fort/ }).count().then((c) => c === 0), "no Galle options on Day 1");
await expect(sheet(page).getByText(/Kandy/).count().then((c) => c === 0), "Kandy day trip is gone");
await sheet(page).getByRole("button", { name: /^Pick Colombo by tuk-tuk/ }).click();
await page.waitForTimeout(1100);
await openSlot(page, 0, "Pick your Colombo night");
await shot(page, "matchup-colombo-night", { wait: 300 });
await sheet(page).getByRole("button", { name: /More about Pub Golf: tee off at Bellagio/ }).click();
await page.waitForTimeout(900);
await expect(sheet(page).getByText("Bellagio Colombo casino", { exact: true }).isVisible(), "Pub Golf course tees off at Bellagio");
await expect(sheet(page).getByText("Tee-off").first().isVisible(), "Hole 0 · Tee-off");
await shot(page, "pub-golf-bellagio", { wait: 300 });
await sheet(page).getByRole("button", { name: /Pick for Day 1/ }).click();
await page.waitForTimeout(1200);

step("Day 2: en-route stops only in the daytime; Galle in the evening");
await openSlot(page, 1, "Pick a stop on the way");
await expect(sheet(page).getByRole("button", { name: /^Pick Madu River/ }).isVisible(), "en-route stop offered on Day 2 daytime");
await expect(sheet(page).getByRole("button", { name: /^Pick Galle Fort|^Pick Learn to surf/ }).count().then((c) => c === 0), "no Galle-base daytime options on Day 2");
await expect(sheet(page).getByRole("button", { name: /^Pick Straight to Galle/ }).isVisible(), "'Straight to Galle' in place of Stay in");
await shot(page, "matchup-enroute", { wait: 300 });
await sheet(page).getByRole("button", { name: /^Pick Madu River/ }).click();
await page.waitForTimeout(1100);
await expect(row(page, 1).getByLabel(/Stops on the way: Madu River/).isVisible(), "route strip shows the stop on the coast road");
await row(page, 1).getByRole("button", { name: "Add another to daytime" }).click();
await page.waitForTimeout(800);
await expect(sheet(page).getByRole("button", { name: /^Add Learn to surf/ }).count().then((c) => c === 0), "Day 2 catalog is en-route only");
await sheet(page).getByRole("button", { name: /^Add Ambalangoda devil masks/ }).click();
await page.waitForTimeout(1100);
await openSlot(page, 1, "Pick your evening");
await sheet(page).getByRole("button", { name: /^Pick Sunset on Galle Fort/ }).click();
await page.waitForTimeout(1200);
r = await saved(page, (x) => x.data.days[1].night.length === 1);
await expect(JSON.stringify(ids(r.value?.data.days[1].day)) === JSON.stringify(["madu-river-safari", "ambalangoda-masks"]), "Day 2 daytime saved as two en-route stops");
await shot(page, "build-day2");

step("Multiple items per slot: matchup first, then the catalog with filters + search");
await openSlot(page, 2, "Pick your daytime");
await sheet(page).getByRole("button", { name: /^Pick Learn to surf in Weligama Bay/ }).click();
await page.waitForTimeout(1100);
await row(page, 2).getByRole("button", { name: "Add another to daytime" }).click();
await page.waitForTimeout(800);
await shot(page, "catalog", { wait: 300 });
await sheet(page).getByRole("button", { name: "Beach & Water" }).click();
await page.waitForTimeout(400);
await expect(sheet(page).getByRole("button", { name: /^Add Snorkelling/ }).isVisible(), "Quick extras appear in the catalog (Beach & Water)");
await expect(sheet(page).getByRole("button", { name: /^Add Galle Fort: ramparts/ }).count().then((c) => c === 0), "category filter hides culture options");
await shot(page, "catalog-water", { wait: 300 });
await sheet(page).getByLabel("Search activities").fill("dalawella");
await page.waitForTimeout(400);
await sheet(page).getByRole("button", { name: /^Add Dalawella/ }).click();
await page.waitForTimeout(1100);
await row(page, 2).getByRole("button", { name: "Add another to daytime" }).click();
await page.waitForTimeout(800);
await sheet(page).getByRole("button", { name: "Chill / Stay in" }).click();
await page.waitForTimeout(300);
await sheet(page).getByRole("button", { name: /^Add Ayurvedic massage/ }).click();
await page.waitForTimeout(1200);
await expect(row(page, 2).getByText(/planned/).first().isVisible(), "slot shows a time total")
await expect(row(page, 2).getByText(/Weligama → Unawatuna/).isVisible(), "travel hop between items in different towns");
r = await saved(page, (x) => x.data.days[2].day.length === 3);
await expect(JSON.stringify(ids(r.value?.data.days[2].day)) === JSON.stringify(["weligama-surf-lesson", "dalawella-turtles", "ayurveda-massage-galle"]), "three items saved in order");
await shot(page, "build-multi");
// reorder within the slot: move Dalawella earlier
await row(page, 2).getByRole("button", { name: /^Daytime: Dalawella/ }).click();
await page.waitForTimeout(700);
await shot(page, "item-sheet", { wait: 200 });
await sheet(page).getByRole("button", { name: "Earlier" }).click();
await page.waitForTimeout(400);
await closeSheet(page);
r = await saved(page, (x) => x.data.days[2].day[0]?.id === "dalawella-turtles");
await expect(!!r.value, "items reorder within a slot");
await row(page, 2).getByRole("button", { name: /^Daytime: Ayurvedic massage/ }).click();
await page.waitForTimeout(600);
await sheet(page).getByRole("button", { name: "Remove" }).click();
await page.waitForTimeout(800);
r = await saved(page, (x) => x.data.days[2].day.length === 2);
await expect(!!r.value, "items can be removed");

step("Secret Jungle Party on a Wednesday → gentle Friday warning; move it to Friday");
await openSlot(page, 2, "Pick your evening");
await expect(sheet(page).getByText("Fridays only").first().isVisible(), "'Fridays only' badge");
await sheet(page).getByRole("button", { name: /^Pick Secret Jungle Party/ }).click();
await page.waitForTimeout(1200);
await expect(row(page, 2).getByText(/only runs on Fridays — this is a Wednesday/).isVisible(), "non-Friday warning shown, not blocked");
await row(page, 2).getByRole("button", { name: /^Evening: Secret Jungle Party/ }).click();
await page.waitForTimeout(600);
await sheet(page).getByRole("button", { name: "Move to another day" }).click();
await page.waitForTimeout(400);
await expect(sheet(page).getByText("Colombo day").isVisible(), "can't move a Galle evening to the Colombo day");
await shot(page, "move-targets", { wait: 200 });
await sheet(page).getByRole("button", { name: /Day 5/ }).click();
await page.waitForTimeout(1000);
r = await saved(page, (x) => x.data.days[4].night.some((y) => y.id === "secret-jungle-party"));
await expect(!!r.value && !r.value.data.days[2].night.length, "moved to Day 5 (Fri 1 Jan)");
await expect(row(page, 4).getByText(/only runs on Fridays/).count().then((c) => c === 0), "no warning on a Friday");

step("NYE on Day 4 (Galle pair)");
await openSlot(page, 3, "Pick your New Year's Eve");
await expect(sheet(page).getByRole("button", { name: /^Pick NYE in Galle Fort/ }).isVisible(), "Galle NYE pair on 31 Dec");
await sheet(page).getByRole("button", { name: /^Pick NYE beach party/ }).click();
await page.waitForTimeout(1200);

step("Quick fill keeps manual picks");
await page.getByRole("button", { name: /Quick fill/ }).click();
await page.getByRole("button", { name: /Fill the empty slots/ }).click();
await page.waitForTimeout(1300);
r = await saved(page, (x) => x.data.days[3].day.length && x.data.days[4].day.length && x.data.days[2].night.length);
await expect(r.value?.data.days[1].day[0]?.id === "madu-river-safari" && r.value?.data.days[3].night[0]?.id === "nye-mirissa-beach-party", "manual picks kept");
await expect(r.value?.data.days[5].day.length === 0 && r.value?.data.days[5].night.length === 0, "Day 6 stays empty");
await shot(page, "build-quickfilled", { full: true });

step("Reorder Galle days; NYE evening stays on 31 Dec; Day 2 can't be dragged");
const before = r.value;
await expect(page.getByRole("button", { name: "Drag to reorder day 2" }).count().then((c) => c === 0), "Day 2 has no drag handle");
const h4 = page.getByRole("button", { name: "Drag to reorder day 4" });
await h4.focus();
await page.keyboard.press("Space");
await page.waitForTimeout(150);
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(250);
await page.keyboard.press("Space");
await page.waitForTimeout(1300);
r = await saved(page, (x) => JSON.stringify(x.data.days[2].day) === JSON.stringify(before.data.days[3].day));
await expect(!!r.value, "Day 4's daytime moved to Day 3");
await expect(r.value?.data.days[3].night[0]?.id === "nye-mirissa-beach-party", "NYE evening still pinned to 31 Dec");
await expect(JSON.stringify(r.value?.data.days.slice(0, 2)) === JSON.stringify(before.data.days.slice(0, 2)), "Days 1–2 untouched");

step("Currency + budget (Colombo 1 night, Galle 4 nights)");
await page.getByRole("button", { name: /^Currency:/ }).click();
await page.getByRole("option", { name: /GBP/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Open trip budget" }).click();
await page.waitForTimeout(900);
await expect(sheet(page).getByText("Colombo · 1 night").isVisible(), "budget: Colombo · 1 night");
await expect(sheet(page).getByText("Galle · 4 nights").isVisible(), "budget: Galle · 4 nights");
const total = () => sheet(page).locator("p", { hasText: /^≈ / }).first().innerText();
const t0 = await total();
await sheet(page).getByText("Include places to stay").click();
await page.waitForTimeout(600);
const t1 = await total();
await expect(t0 !== t1 && t0.includes("£"), `total changes when accommodation is toggled (${t0} → ${t1})`);
await sheet(page).getByText("Include places to stay").click();
await page.waitForTimeout(400);
await shot(page, "budget-sheet");
await closeSheet(page);

step("5-day preview: sandboxed, never saved, submit blocked, switching back restores");
const real = (await page.request.get(base + "/api/itinerary").then((x) => x.json())).data;
await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Dates" }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Preview.*5 days · 4 nights/ }).click();
await page.waitForTimeout(600);
await expect(summary(page).getByText(/Mon 28 Dec → Fri 1 Jan/).isVisible(), "preview window is 5 days");
await expect(page.getByText(/Previewing 5 days · 4 nights/).first().isVisible(), "preview banner shown");
await shot(page, "preview-dates");
await page.getByRole("button", { name: /Build days/ }).click();
await page.waitForTimeout(900);
await expect(page.getByLabel("Colombo 1 night, then Galle 3 nights").isVisible(), "preview header: Galle 3 nights");
await expect(page.locator("ol > li").count().then((c) => c === 5), "preview has 5 day cards");
await row(page, 2).getByRole("button", { name: "Add another to evening" }).click();
await page.waitForTimeout(700);
await sheet(page).getByRole("button", { name: /^Add Sunset catamaran/ }).click();
await page.waitForTimeout(1500);
await shot(page, "preview-build");
const during = (await page.request.get(base + "/api/itinerary").then((x) => x.json())).data;
await expect(JSON.stringify(during.days) === JSON.stringify(real.days) && during.endDate === "2027-01-02", "preview edits are not autosaved");
await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Review" }).click();
await page.waitForTimeout(1500);
await expect(page.getByText("The group voted 6 days. Switch back to submit.").isVisible(), "friendly note on review");
await expect(page.getByRole("button", { name: /Submit my trip/ }).isDisabled(), "Submit disabled in preview");
await shot(page, "preview-review");
await page.getByRole("button", { name: "Back to 6 days" }).first().click();
await page.waitForTimeout(900);
await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Days" }).click();
await page.waitForTimeout(900);
await expect(page.locator("ol > li").count().then((c) => c === 6), "back to 6 day cards");
await expect(page.getByLabel("Colombo 1 night, then Galle 4 nights").isVisible(), "back to Galle 4 nights");
await expect(row(page, 2).getByText("Sunset catamaran").count().then((c) => c === 0), "the preview-only edit is gone");
const fivePut = await page.request.put(base + "/api/itinerary", {
  data: { data: { ...real, endDate: "2027-01-01", days: real.days.slice(0, 5) }, submit: true },
});
await expect(fivePut.status() === 400, "server rejects a 5-day submission");

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

step("Review map: zoomed to the coast, each day highlightable");
await page.goto(base + "/trip?step=review");
await page.waitForTimeout(2200);
await expect(page.getByRole("img", { name: /^Route map/ }).isVisible(), "zoomed route map on the review page");
await expect(page.getByRole("button", { name: /^Day 3/ }).isVisible(), "a chip for each day");
await page.getByRole("button", { name: /^Day 3/ }).click();
await page.waitForTimeout(700);
await expect(page.getByText(/Day 3 · Galle base/).first().isVisible(), "tapping a day highlights its route");
await page.locator("section").filter({ has: page.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-review-map-day3.png`) });
await page.getByRole("button", { name: /^All days/ }).click();
await page.waitForTimeout(500);
await page.locator("section").filter({ has: page.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-review-map-all.png`) });

step("Share my trip: Story + Square images");
await page.getByRole("button", { name: /Share my trip/ }).click();
await page.waitForTimeout(500);
const storyFile = await saveShare(page, "story", `share-story${VIEWSUFFIX}`);
const squareFile = await saveShare(page, "square", `share-square${VIEWSUFFIX}`);
await expect(JSON.stringify(pngSize(storyFile)) === "[1080,1920]", "Story image is 1080×1920");
await expect(JSON.stringify(pngSize(squareFile)) === "[1080,1080]", "Square image is 1080×1080");
await shot(page, "share-sheet", { wait: 300 });
await closeSheet(page);

step("Halal mode: view-only, never saved");
const rowBefore = JSON.stringify(await page.request.get(base + "/api/itinerary").then((x) => x.json()));
const fileRow = () => {
  if (!fs.existsSync(LOCAL_DB) || !base.includes(":3100")) return null;
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  const me = dbj.participants.find((x) => x.display_name === NAME);
  return JSON.stringify(dbj.itineraries.find((x) => x.participant_id === me.id));
};
const fileBefore = fileRow();
await expect(page.getByText("Pub Golf: tee off at Bellagio").first().isVisible(), "nightlife item shown normally");
await page.getByRole("switch", { name: "Halal mode" }).click();
await page.waitForTimeout(800);
await expect(page.getByText("Halal mode: preview only, your real plan is untouched.").isVisible(), "Halal banner with the promise");
await expect(page.getByText("Colombo night food & dessert crawl").first().isVisible(), "Pub Golf swapped for the dessert crawl");
await expect(page.getByText("Pub Golf: tee off at Bellagio").filter({ visible: true }).count().then((c) => c === 0), "no nightlife left in view");
await expect(page.getByText("Haram", { exact: true }).isVisible() && page.getByText("Halal", { exact: true }).first().isVisible(), "meter relabelled Halal ↔ Haram");
await expect(page.getByRole("button", { name: /Edit days/ }).count().then((c) => c === 0), "editing disabled while it's on");
await shot(page, "halal-review", { wait: 300 });
await shot(page, "halal-review-full", { full: true });
await page.getByRole("button", { name: /Share my trip/ }).click();
await page.waitForTimeout(500);
const halalStory = await saveShare(page, "story", `share-story-halal${VIEWSUFFIX}`);
await saveShare(page, "square", `share-square-halal${VIEWSUFFIX}`);
await expect(JSON.stringify(pngSize(halalStory)) === "[1080,1920]", "Halal-mode Story image exported");
await closeSheet(page);
await page.waitForTimeout(2500);
const rowDuring = JSON.stringify(await page.request.get(base + "/api/itinerary").then((x) => x.json()));
await expect(rowDuring === rowBefore, "DB row unchanged while Halal mode is on");
await page.getByRole("button", { name: "Turn Halal mode off" }).click();
await page.waitForTimeout(600);
await expect(page.getByText("Pub Golf: tee off at Bellagio").first().isVisible(), "switching off restores the real plan");
await page.getByRole("switch", { name: "Halal mode" }).click();
await page.waitForTimeout(400);
await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Days" }).click();
await page.waitForTimeout(600);
await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Review" }).click();
await page.waitForTimeout(1200);
await expect(page.getByRole("switch", { name: "Halal mode" }).getAttribute("aria-checked").then((v) => v === "false"), "Halal mode resets when you leave the page");
await page.waitForTimeout(2000);
const rowAfter = JSON.stringify(await page.request.get(base + "/api/itinerary").then((x) => x.json()));
await expect(rowAfter === rowBefore, "DB row byte-identical after Halal mode (API)");
if (fileBefore !== null) await expect(fileRow() === fileBefore, "DB row byte-identical after Halal mode (stored row)");

// ── User 2: NYE on different days ────────────────────────────────────
step("Second user: NYE on Day 2 (evening), Day 1 (Colombo) and Day 6 (flying)");
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
await tapDate(p2, "Wed 30 Dec");
await p2.getByRole("button", { name: /Build days/ }).click();
await p2.waitForTimeout(800);
await openSlot(p2, 1, "Pick your New Year's Eve");
await expect(sheet(p2).getByRole("button", { name: /^Pick NYE in Galle Fort/ }).isVisible(), "NYE on Day 2 evening → Galle pair");
await shot(p2, "matchup-nye-day2", { wait: 300 });
await closeSheet(p2);
await p2.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Dates" }).click();
await p2.waitForTimeout(500);
await tapDate(p2, "Thu 31 Dec");
await p2.getByRole("button", { name: /Build days/ }).click();
await p2.waitForTimeout(800);
await openSlot(p2, 0, "Pick your New Year's Eve");
await expect(sheet(p2).getByRole("button", { name: /^Pick NYE rooftop countdown in Colombo/ }).isVisible(), "NYE on Day 1 → Colombo pair");
await sheet(p2).getByRole("button", { name: /^Pick NYE by the sea at Mount Lavinia/ }).click();
await p2.waitForTimeout(1100);
await p2.getByRole("button", { name: /Quick fill/ }).click();
await p2.getByRole("button", { name: /Fill the empty slots/ }).click();
await p2.waitForTimeout(1500);
const q2 = await saved(p2, (x) => x.data.days[2].day.length && x.data.startDate === "2026-12-31");
await expect(q2.value?.data.days[0].night[0]?.id === "nye-mount-lavinia", "NYE pick kept through quick fill");
await shot(p2, "build-nye-day1", { full: true });
await p2.goto(base + "/trip?step=review");
await p2.getByRole("button", { name: /Submit my trip/ }).click();
await p2.waitForTimeout(1200);

step("More friends for the group spectrum (a party animal and a nature lover)");
const template = (await page.request.get(base + "/api/itinerary").then((x) => x.json())).data;
const mk = (id) => [{ key: Math.random().toString(36).slice(2, 10), id }];
const EXTRA = [
  { name: `Partyer ${stamp}`, day: ["galle-fort", "mirissa-beach-hop", "unawatuna-jungle-beach"], night: ["secret-jungle-party", "doctors-house-madiha", "mirissa-beach-bars"], c1: "colombo-club-night" },
  { name: `Hiker ${stamp}`, day: ["kanneliya-trek", "sinharaja-day-trip", "kottawa-rainforest"], night: ["stay", "stay", "galle-fort-sunset-dinner"], c1: "galle-face-street-food" },
];
for (const u of EXTRA) {
  const cx = await browser.newContext(phone);
  const pu = await cx.newPage();
  await join(pu, u.name);
  const d = structuredClone(template);
  d.days[0].day = mk(u.name.startsWith("Hiker") ? "negombo-lagoon" : "colombo-tuk-tuk");
  d.days[0].night = mk(u.c1);
  d.days[1].day = mk("madu-river-safari");
  d.days[1].night = [];
  for (let i = 0; i < 3; i++) {
    d.days[2 + i].day = mk(u.day[i]);
    d.days[2 + i].night = i === 1 ? d.days[3].night : mk(u.night[i]);
  }
  const res = await pu.request.put(base + "/api/itinerary", { data: { data: d, submit: true } });
  await expect(res.ok(), `${u.name} submitted`);
  await cx.close();
}
await p2.goto(base + "/group");
await expect(p2.getByRole("region", { name: "Group spectrum" }).isVisible(), "group spectrum at the top");
await expect(p2.getByRole("region", { name: "Group spectrum" }).getByRole("link", { name: new RegExp(`^Partyer ${stamp}`) }).isVisible(), "everyone plotted on the spectrum");
const partyBox = await p2.getByRole("region", { name: "Group spectrum" }).getByRole("link", { name: new RegExp(`^Partyer ${stamp}`) }).boundingBox();
const hikerBox = await p2.getByRole("region", { name: "Group spectrum" }).getByRole("link", { name: new RegExp(`^Hiker ${stamp}`) }).boundingBox();
await expect(partyBox && hikerBox && partyBox.x > hikerBox.x, "nightlife-heavy friend sits right of the nature lover");
await p2.waitForTimeout(1800); // avatars pop in one by one
await p2.getByRole("region", { name: "Group spectrum" }).screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-group-spectrum.png`) });
await expect(p2.getByLabel(/Nature to nightlife/).first().isVisible(), "each trip card shows its meter");
await shot(p2, "group-full", { full: true, wait: 1200 });
await p2.getByRole("region", { name: "Group spectrum" }).getByRole("link", { name: new RegExp(`^Hiker ${stamp}`) }).click();
await p2.waitForURL("**/group/**");
await expect(p2.getByText(new RegExp(`Hiker ${stamp}'s`)).first().isVisible(), "tapping an avatar opens their trip");
await p2.goto(base + "/group");
await p2.waitForTimeout(800);
await p2.getByRole("link", { name: new RegExp(NAME) }).first().click();
await p2.waitForURL("**/group/**");
await shot(p2, "person-view", { wait: 2000 });
await shot(p2, "person-view-full", { full: true });
// NYE on the fly-home day
await p2.goto(base + "/trip?step=dates");
await p2.waitForTimeout(800);
await tapDate(p2, "Sat 26 Dec");
await expect(summary(p2).getByText("You'd fly home on New Year's Eve").isVisible(), "NYE on Day 6 is flagged on the calendar");

// ── User 3: upgrade of an older (v2) itinerary ───────────────────────
step("Migration of an older itinerary");
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
      version: 2,
      startDate: "2026-12-28",
      endDate: "2027-01-03",
      flexibility: "exact",
      preferences: { currency: "LKR" },
      days: [
        { id: "m1", day: { type: "stay" }, night: { pairId: "colombo-nights", optionId: "colombo-club-night" } },
        { id: "m2", day: { pairId: "kandy-or-design", optionId: "kandy-day-trip", transport: "road", addOns: ["playdium-bowling"] }, night: { pairId: "lucky-or-thirsty", optionId: "casino-night" } },
        { id: "m3", day: { pairId: "south-surf", optionId: "weligama-surf-lesson", addOns: ["snorkel-jungle-beach"] }, night: { pairId: "jungle-or-golf", optionId: "secret-jungle-party" } },
        { id: "m4", day: { pairId: "reef-or-ramparts", optionId: "galle-fort" }, night: { pairId: "nye-galle", optionId: "nye-mirissa-beach-party" } },
        { id: "m5", day: { pairId: "mirissa-ocean", optionId: "mirissa-whale-watching" }, night: { type: "stay" } },
        { id: "m6", day: { pairId: "reef-or-ramparts", optionId: "hikkaduwa-turtles" }, night: null },
        { id: "m7", day: { pairId: "mirissa-ocean", optionId: "mirissa-beach-hop" }, night: null },
      ],
    },
  });
  fs.writeFileSync(LOCAL_DB, JSON.stringify(dbj, null, 2));
  await p3.goto(base + "/trip");
  await p3.waitForTimeout(1300);
  await expect(p3.getByText(/The group voted for 6 days · 5 nights/).isVisible(), "one-time note explains the group decision");
  await expect(p3.getByText(/\(5 cleared\)/).isVisible(), "5 picks that no longer fit were cleared");
  await shot(p3, "migration-note");
  const mig = await saved(p3, (x) => x.data.version === 3);
  const md = mig.value?.data;
  await expect(md?.days.length === 6 && md.startDate === "2026-12-28" && md.endDate === "2027-01-02", "kept the start date, now 6 days");
  await expect(
    JSON.stringify(ids(md?.days[0].day)) === '["stay"]' &&
      JSON.stringify(ids(md?.days[0].night)) === '["colombo-club-night"]' &&
      JSON.stringify(ids(md?.days[2].day)) === '["weligama-surf-lesson","snorkel-jungle-beach"]' &&
      md?.days[3].night[0]?.id === "nye-mirissa-beach-party",
    "valid picks kept (add-on became a Quick extra)",
  );
  await expect(!md?.days[1].day.length && !md?.days[1].night.length && !md?.days[5].day.length, "invalid picks cleared (Kandy, casino on Day 2, Day 6)");
  await expect(mig.value?.status === "submitted", "still submitted after the upgrade");
  await p3.reload();
  await p3.waitForTimeout(1500);
  await expect(p3.getByText(/The group voted for 6 days/).count().then((c) => c === 0), "note doesn't come back after reload");
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
    await expect(mine.some((l) => l.includes(",dalawella-turtles,")) && mine.some((l) => l.includes(",2,option,")), "long CSV: one row per item, with position");
    await expect(mine.some((l) => l.includes(",enroute,")), "long CSV carries where (enroute)");
  }
  if (f === "csv") await expect(body.split("\n")[0].includes("trip_nights") && body.includes(",6,5,1,4,"), "wide CSV has days · nights (6 · 5, 1 + 4)");
  if (f === "json") await expect(body.includes("6 days · 5 nights") && body.includes("totalUsd"), "JSON export has days · nights and the budget");
}
await page.goto(base + "/trip");
await page.waitForTimeout(1200);
await expect(page.getByText(/Edits are closed/).first().isVisible(), "locked banner visible to participants");
const put = await page.request.put(base + "/api/itinerary", { data: { data: real } });
await expect(put.status() === 423, "API rejects edits while locked");
await pa.getByRole("switch", { name: /Lock edits/ }).click();
await pa.waitForTimeout(600);

step("Desktop");
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctxD.addCookies(await ctx.cookies());
const pd = await ctxD.newPage();
await pd.goto(base + "/trip?step=dates");
await shot(pd, "desktop-dates", { wait: 1500 });
await pd.goto(base + "/trip?step=build");
await shot(pd, "desktop-build", { wait: 1800 });
await pd.goto(base + "/trip?step=review");
await shot(pd, "desktop-review", { wait: 2400 });
await pd.getByRole("button", { name: /^Day 4/ }).click();
await pd.waitForTimeout(900);
await expect(pd.getByText(/Day 4 · Galle base/).first().isVisible(), "desktop: tapping a day highlights its route");
await pd.locator("section").filter({ has: pd.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-desktop-map-day4.png`) });
await pd.getByRole("button", { name: /Share my trip/ }).click();
await pd.waitForTimeout(500);
const dStory = await saveShare(pd, "story", "share-story-desktop");
const dSquare = await saveShare(pd, "square", "share-square-desktop");
await expect(JSON.stringify(pngSize(dStory)) === "[1080,1920]" && JSON.stringify(pngSize(dSquare)) === "[1080,1080]", "desktop: both share images");
await shot(pd, "desktop-share-sheet", { wait: 300 });
await closeSheet(pd);
const dRowBefore = JSON.stringify(await pd.request.get(base + "/api/itinerary").then((x) => x.json()));
await pd.getByRole("switch", { name: "Halal mode" }).click();
await pd.waitForTimeout(800);
await expect(pd.getByText("Halal mode: preview only, your real plan is untouched.").isVisible(), "desktop: Halal banner");
await shot(pd, "desktop-halal", { wait: 300 });
await pd.getByRole("button", { name: /Share my trip/ }).click();
await pd.waitForTimeout(500);
await saveShare(pd, "story", "share-story-halal-desktop");
await closeSheet(pd);
await pd.getByRole("button", { name: "Turn Halal mode off" }).click();
await pd.waitForTimeout(2500);
await expect(JSON.stringify(await pd.request.get(base + "/api/itinerary").then((x) => x.json())) === dRowBefore, "desktop: DB row byte-identical after Halal mode");
await pd.goto(base + "/group");
await pd.waitForTimeout(1500);
await expect(pd.getByRole("region", { name: "Group spectrum" }).isVisible(), "desktop: group spectrum");
await shot(pd, "desktop-group", { wait: 600 });
await pd.waitForTimeout(1200);
await pd.getByRole("region", { name: "Group spectrum" }).screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-desktop-group-spectrum.png`) });
await ctxD.close();

step("WebKit (Safari engine): share images render and download");
try {
  const wk = await webkit.launch();
  const wctx = await wk.newContext({ ...phone, acceptDownloads: true });
  await wctx.addCookies(await ctx.cookies());
  const wp = await wctx.newPage();
  wp.on("pageerror", (e) => errors.push(`webkit pageerror: ${e.message}`));
  await wp.goto(base + "/trip?step=review");
  await wp.waitForTimeout(2500);
  await wp.getByRole("button", { name: /Share my trip/ }).click();
  const wStory = await saveShare(wp, "story", `share-story-webkit${VIEWSUFFIX}`);
  const wSquare = await saveShare(wp, "square", `share-square-webkit${VIEWSUFFIX}`);
  await expect(JSON.stringify(pngSize(wStory)) === "[1080,1920]" && JSON.stringify(pngSize(wSquare)) === "[1080,1080]", "WebKit generates both images");
  await wp.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-webkit-share-sheet.png`) });
  await wk.close();
} catch (e) {
  errors.push(`webkit: ${e.message}`);
  console.log("  ✗ webkit:", e.message);
}

step("Cleanup: delete the test users (never the organizer)");
const PROTECTED = /^abdul$/i;
const TEST = [NAME, NAME2, NAME3, `Partyer ${stamp}`, `Hiker ${stamp}`];
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
