// End-to-end checks for the Ella day trip, the map day tabs, organizer roles + the
// console, and 👀 peek. Runs against the local-store server (CARAVAN_LOCAL_STORE=1).
// Usage: node --env-file=.env.local scripts/round7.mjs <outDir>
//   env: BASE (default http://localhost:3100), CHROME_PATH, VIEW (e.g. 375x667), ADMIN_PASSWORD
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "screenshots/round7";
const base = process.env.BASE ?? "http://localhost:3100";
const exe = process.env.CHROME_PATH;
const stamp = Date.now().toString(36).slice(-4);
const PIN = "4826";
const LOCAL_DB = path.join(process.cwd(), ".data", "dev-db.json");
const SHOTS = path.join(process.cwd(), "screenshots");
const VIEWSUFFIX = process.env.VIEW ? `-${process.env.VIEW}` : "";
if (!base.includes("localhost")) throw new Error("round7 tests run against a local server only");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const [vw, vh] = (process.env.VIEW ?? "390x844").split("x").map(Number);
// The browser sits in a different timezone from the server, so any server/client
// text mismatch (e.g. a time formatted on the server) shows up as a page error.
const TZ = { timezoneId: "Pacific/Auckland" };
const phone = { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, ...TZ };
const desktop = { viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...TZ };
let n = 0;
const errors = [];

const N = {
  climber: `Cleo ${stamp}`,
  admin: `Ada ${stamp}`,
  admin2: `Ben ${stamp}`,
  member: `Mo ${stamp}`,
  drafter: `Dee ${stamp}`,
  peeker: `Pip ${stamp}`,
  spare: `Zed ${stamp}`,
  owner: `Olive ${stamp}`,
  migrated: `Mig ${stamp}`,
};

function step(label) {
  console.log(`\n▶ ${label}`);
}
async function expect(cond, msg) {
  let ok = false;
  try {
    ok = !!(await Promise.resolve(cond));
  } catch {
    ok = false;
  }
  if (!ok) {
    errors.push(msg);
    console.log("  ✗", msg);
  } else console.log("  ✓", msg);
}
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 600);
  const file = path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.full });
  if (opts.keep) fs.copyFileSync(file, path.join(SHOTS, `r7-${name}${VIEWSUFFIX}.png`));
  console.log("📸", file);
}
async function eventually(fn, timeout = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** A fresh signed-in user in its own browser context. */
async function person(name, ctxOpts = phone) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror(${name}): ${e.message}`));
  const res = await page.request.post(base + "/api/auth/join", { data: { name, pin: PIN } });
  if (!res.ok()) throw new Error(`join ${name}: ${res.status()}`);
  const id = (await res.json()).id;
  return { ctx, page, id, name, api: page.request };
}
const mk = (...ids) => ids.map((id) => ({ key: Math.random().toString(36).slice(2, 10), id }));
function plan(start, days, prefs = {}, notes = {}) {
  const addDay = (iso, k) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + k);
    return d.toISOString().slice(0, 10);
  };
  return {
    version: 3,
    startDate: start,
    endDate: addDay(start, days.length - 1),
    flexibility: "few_days",
    days: days.map(([day, night], i) => ({ id: `d${i}${Math.random().toString(36).slice(2, 6)}`, day, night, ...(notes[i] ? { note: notes[i] } : {}) })),
    preferences: prefs,
  };
}
const getPlan = async (u) => (await u.api.get(base + "/api/itinerary").then((r) => r.json()))?.data;
const put = (u, data, submit = false) => u.api.put(base + "/api/itinerary", { data: { data, submit } });
const ids = (list) => (list ?? []).map((x) => x.id);
const row = (page, i) => page.locator("ol > li").nth(i);
const sheet = (page) => page.getByRole("dialog").last();

// ═══ Ella day trip · Little Adam's Peak ════════════════════════════════
const ELLA = "ella-little-adams-peak";
step("Ella: sunrise on Day 3 — soft early-night note + late-party heads-up on Day 2 (no lock)");
const climber = await person(N.climber);
{
  const res = await put(
    climber,
    plan("2026-12-14", [
      [mk("colombo-tuk-tuk"), mk("galle-face-street-food")],
      [mk("madu-river-safari"), mk("mirissa-beach-bars")],
      [[], []],
      [mk("galle-fort"), []],
      [[], []],
      [[], []],
    ]),
  );
  await expect(res.ok(), "climber plan saved (14–19 Dec), Day 2 evening has a beach-bar crawl");
}
const cp = climber.page;
await cp.goto(base + "/trip?step=build");
await cp.waitForTimeout(1500);
await row(cp, 2).getByRole("button", { name: "Pick your daytime" }).click();
await cp.waitForTimeout(900);
await sheet(cp).getByRole("button", { name: /^Pick Ella day trip · Little Adam's Peak/ }).click();
await cp.waitForTimeout(1100);
await expect(cp.getByText("How do you want to do Ella?").isVisible(), "picking the Ella trip asks sunrise or easy morning");
await expect(sheet(cp).getByText(/Day 2's evening has/).isVisible(), "variant sheet: soft heads-up about Day 2's late night");
await expect(sheet(cp).getByText("What to bring").isVisible(), "variant sheet: what to bring");
await expect(sheet(cp).getByText(/A torch for the sunrise walk/).isVisible(), "…a torch for the sunrise");
await shot(cp, "ella-variant-sheet", { keep: true });
await cp.getByRole("button", { name: "Choose Sunrise at Little Adam's Peak" }).click();
await cp.waitForTimeout(700);
await expect(cp.getByText(/Heads-up: Day 2's evening has Mirissa beach-bar crawl/).isVisible(), "toast: gentle late-party heads-up (not a block)");
let d = await eventually(async () => {
  const x = await getPlan(climber);
  return x?.days[2].day[0]?.id === ELLA ? x : null;
});
await expect(d?.days[2].day[0]?.variant === "sunrise", "Day 3 daytime: Ella · sunrise saved");
await expect(ids(d?.days[1].night).includes("mirissa-beach-bars"), "Day 2 evening kept as is (no lock, nothing moved)");
await expect(row(cp, 1).getByText("Early night: leaving ~12:30am for Ella").isVisible(), "Day 2 evening: soft early-night note");
await expect(row(cp, 1).getByText(/Early start tonight — the van leaves ~12:30am for Ella, and Mirissa beach-bar crawl & fire shows usually runs late/).isVisible(), "Day 2: gentle late-party warning");
await expect(row(cp, 1).getByRole("button", { name: "Add another to evening" }).isVisible(), "Day 2 evening still editable");
await expect(row(cp, 2).getByText(/Full day · ~14 hrs door to door/).isVisible(), "Day 3 shows a full-day total");
await expect(row(cp, 2).getByText("Long day — Stay in or something light suggested").isVisible(), "Day 3 evening suggests Stay in or something light");
await expect(row(cp, 2).getByText("Ella day trip").first().isVisible(), "Day 3 card tag: Ella day trip");
await expect(row(cp, 2).getByText(/Road trip · Galle → Ella · ~3\.5–4 hrs/).isVisible(), "Day 3: road trip leg there with duration");
await expect(row(cp, 2).getByText("Leave Galle ~12:30am").isVisible(), "…and the departure time");
await expect(row(cp, 2).getByText(/Back to Galle · ~3\.5–4 hrs/).isVisible(), "Day 3: the drive back with duration");
await expect(cp.getByText(/Overnight drive/).count().then((c) => c === 0), "no overnight-drive item anywhere");
await row(cp, 1).scrollIntoViewIfNeeded();
await shot(cp, "ella-day2-early-night", { keep: true });
await row(cp, 2).scrollIntoViewIfNeeded();
await shot(cp, "ella-day3-sunrise", { keep: true });
await row(cp, 2).getByRole("button", { name: "+ Stay in" }).click();
await cp.waitForTimeout(1300);
d = await eventually(async () => {
  const x = await getPlan(climber);
  return ids(x?.days[2].night).includes("stay") ? x : null;
});
await expect(!!d, "one tap adds Stay in on the Ella evening");

step("Ella extras appear only alongside the trip");
await row(cp, 3).getByRole("button", { name: "Add another to daytime" }).click();
await cp.waitForTimeout(900);
await sheet(cp).getByLabel("Search activities").fill("Nine Arches");
await cp.waitForTimeout(400);
await expect(sheet(cp).getByRole("button", { name: /^Add Nine Arches Bridge/ }).count().then((c) => c === 0), "Day 4 (no Ella trip): no Nine Arches in the catalog");
await sheet(cp).getByLabel("Search activities").fill("Ella");
await cp.waitForTimeout(400);
await expect(sheet(cp).getByRole("button", { name: /^Add (Ravana Falls|Flying Ravana|98 Acres)/ }).count().then((c) => c === 0), "Day 4: no Ella extras at all");
await cp.keyboard.press("Escape");
await cp.waitForTimeout(500);
await row(cp, 2).getByRole("button", { name: "Add another to daytime" }).click();
await cp.waitForTimeout(900);
const extrasShown = await sheet(cp).getByRole("button", { name: /^Add (Nine Arches Bridge|98 Acres viewpoint|Flying Ravana zipline|Ravana Falls)/ }).count();
await expect(extrasShown === 4, `Day 3 (with the trip): all four Ella extras offered (${extrasShown})`);
await shot(cp, "ella-extras-catalog", { keep: true });
await sheet(cp).getByLabel("Search activities").fill("Nine Arches");
await cp.waitForTimeout(400);
await expect(sheet(cp).getByText(/Trains ~6:30/).count().then(() => true), "Nine Arches lists train times (detail)");
await sheet(cp).getByRole("button", { name: /^Add Nine Arches Bridge/ }).click();
await cp.waitForTimeout(1300);
d = await eventually(async () => {
  const x = await getPlan(climber);
  return ids(x?.days[2].day).includes("ella-nine-arches") ? x : null;
});
await expect(!!d, "Nine Arches added to Day 3 with the trip");
await expect(row(cp, 2).getByText("In Ella · with your day trip").first().isVisible(), "extra labelled 'In Ella · with your day trip'");
{
  // An Ella extra without the trip is dropped by the server.
  const cur = await getPlan(climber);
  cur.days[3].day = [...cur.days[3].day, ...mk("ella-ravana-falls")];
  await put(climber, cur);
  const x = await getPlan(climber);
  await expect(!ids(x?.days[3].day).includes("ella-ravana-falls"), "an Ella extra on a day without the trip isn't kept");
}

step("Ella: easy morning on Day 5 from the catalog, then switch variants on Day 3 and Day 5");
await cp.goto(base + "/trip?step=build");
await cp.waitForTimeout(1500);
await row(cp, 4).getByRole("button", { name: /or browse everything/ }).first().click();
await cp.waitForTimeout(900);
await sheet(cp).getByLabel("Search activities").fill("Ella");
await cp.waitForTimeout(400);
await sheet(cp).getByRole("button", { name: /^Add Ella day trip · Little Adam's Peak/ }).click();
await cp.waitForTimeout(1000);
await cp.getByRole("button", { name: "Choose Easy morning in Ella" }).click();
await cp.waitForTimeout(1500);
d = await eventually(async () => {
  const x = await getPlan(climber);
  return x?.days[4].day.some((i) => i.id === ELLA) ? x : null;
});
await expect(d?.days[4].day.find((i) => i.id === ELLA)?.variant === "calm", "Day 5: easy morning saved");
await expect(row(cp, 4).getByText("Back ~8pm — Stay in or a chill dinner suggested").isVisible(), "Day 5 evening: back ~8pm note");
await expect(row(cp, 4).getByText(/Full day · ~15 hrs/).isVisible(), "Day 5: full-day total");
await expect(row(cp, 3).getByText(/Early night/).count().then((c) => c === 0), "no early-night note before an easy morning");
await row(cp, 4).scrollIntoViewIfNeeded();
await shot(cp, "ella-day5-calm", { keep: true });
// Day 5 → sunrise
await row(cp, 4).getByRole("button", { name: /^Daytime: Ella day trip/ }).click();
await cp.waitForTimeout(800);
await sheet(cp).getByRole("button", { name: /Switch to Sunrise at Little Adam's Peak/ }).click();
await cp.waitForTimeout(900);
await cp.getByRole("button", { name: "Choose Sunrise at Little Adam's Peak" }).click();
await cp.waitForTimeout(1500);
d = await eventually(async () => {
  const x = await getPlan(climber);
  return x?.days[4].day.find((i) => i.id === ELLA)?.variant === "sunrise" ? x : null;
});
await expect(!!d, "Day 5 switched to sunrise");
await expect(row(cp, 3).getByText("Early night: leaving ~12:30am for Ella").isVisible(), "Day 4 evening now gets the early-night note");
// Day 3 → easy morning (keeps its Ella extra)
await row(cp, 2).getByRole("button", { name: /^Daytime: Ella day trip/ }).click();
await cp.waitForTimeout(800);
await sheet(cp).getByRole("button", { name: /Switch to Easy morning in Ella/ }).click();
await cp.waitForTimeout(900);
await cp.getByRole("button", { name: "Choose Easy morning in Ella" }).click();
await cp.waitForTimeout(1500);
d = await eventually(async () => {
  const x = await getPlan(climber);
  return x?.days[2].day.find((i) => i.id === ELLA)?.variant === "calm" ? x : null;
});
await expect(!!d && ids(d.days[2].day).includes("ella-nine-arches"), "Day 3 switched to easy morning, Nine Arches still with it");
await expect(row(cp, 1).getByText(/Early night/).count().then((c) => c === 0), "Day 2's early-night note is gone");
await expect(row(cp, 2).getByText("Back ~8pm — Stay in or a chill dinner suggested").isVisible(), "Day 3 evening: back ~8pm note");
await row(cp, 3).scrollIntoViewIfNeeded();
await shot(cp, "ella-day4-early-day5-sunrise", { keep: true });

step("Budget: shared van to Ella + extras");
await cp.getByRole("button", { name: "Open trip budget" }).first().click();
await cp.waitForTimeout(900);
await expect(sheet(cp).getByText("Shared van · Galle ⇄ Ella").first().isVisible(), "budget: shared van line for the Ella trip");
await expect(sheet(cp).getByText(/Nine Arches Bridge/).first().isVisible(), "budget: the Ella extra has a line");
await sheet(cp).getByText("Shared van · Galle ⇄ Ella").first().scrollIntoViewIfNeeded();
await shot(cp, "ella-budget", { keep: true });
await cp.keyboard.press("Escape");
await cp.waitForTimeout(400);

step("Migration: an old Adam's Peak plan (both variants) becomes the Ella trip");
const mig = await person(N.migrated);
{
  await put(mig, plan("2026-12-26", [[mk("colombo-tuk-tuk"), []], [[], mk("galle-fort-sunset-dinner")], [[], []], [mk("galle-fort"), []], [[], []], [[], []]]));
  // Write the pre-swap shape straight into the local store (the API would already convert it).
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  const r = dbj.itineraries.find((x) => x.participant_id === mig.id);
  r.data.days[2].day = [{ key: "apsun01", id: "adams-peak", variant: "sunrise" }];
  r.data.days[4].day = [{ key: "apmor01", id: "adams-peak", variant: "morning" }];
  // A stray stored "overnight drive" item (there never was one, but prove it can't survive).
  r.data.days[1].night = [...r.data.days[1].night, { key: "apdrv01", id: "adams-peak-overnight-drive" }];
  fs.writeFileSync(LOCAL_DB, JSON.stringify(dbj, null, 2));
}
const mp = mig.page;
await mp.goto(base + "/trip?step=build");
await mp.waitForTimeout(1800);
await expect(mp.getByText("We swapped Adam's Peak for Little Adam's Peak in Ella.").isVisible(), "one-time note shows");
await expect(mp.getByText(/Easier hike, same sunrise/).isVisible(), "…'Easier hike, same sunrise'");
await shot(mp, "ella-migration-note", { keep: true });
d = await eventually(async () => {
  const x = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8")).itineraries.find((y) => y.participant_id === mig.id)?.data;
  return x && !JSON.stringify(x).includes('"adams-peak') ? x : null;
}, 12000);
await expect(d?.days[2].day[0]?.id === ELLA && d.days[2].day[0].variant === "sunrise", "Sunrise summit → Little Adam's Peak sunrise, same day (saved)");
await expect(d?.days[4].day[0]?.id === ELLA && d.days[4].day[0].variant === "calm", "Calm morning climb → Easy morning in Ella, same day (saved)");
await expect(d && ids(d.days[1].night).join() === "galle-fort-sunset-dinner", "the overnight-drive item is gone, the dinner stays");
await expect(mp.getByText(/Overnight drive/).count().then((c) => c === 0), "no overnight-drive text on the page");
await expect(row(mp, 1).getByText("Early night: leaving ~12:30am for Ella").isVisible(), "migrated sunrise gives Day 2 the soft early-night note");
await mp.reload();
await mp.waitForTimeout(1800);
await expect(mp.getByText("We swapped Adam's Peak for Little Adam's Peak in Ella.").count().then((c) => c === 0), "the note is one-time (gone after reload)");

step("Map: day tabs reach Day 6, the map fits the Ella route, exports include it");
await cp.goto(base + "/trip?step=review");
await cp.waitForTimeout(2200);
const tabs = cp.getByRole("group", { name: "Highlight a day" });
await tabs.scrollIntoViewIfNeeded();
const allBox = await cp.getByRole("img", { name: /^Route map/ }).evaluate((el) => el.getAttribute("viewBox"));
await tabs.getByRole("button", { name: /^Day 6/ }).click();
await cp.waitForTimeout(900);
await expect(tabs.getByRole("button", { name: /^Day 6/ }).getAttribute("aria-pressed").then((v) => v === "true"), "Day 6 tab reachable and selectable");
await expect(
  tabs.getByRole("button", { name: /^Day 6/ }).evaluate((b) => {
    const r = b.getBoundingClientRect();
    const g = b.parentElement.getBoundingClientRect();
    return r.left >= g.left - 1 && r.right <= g.right + 1;
  }),
  "the active tab scrolls fully into view",
);
await cp.locator("section").filter({ has: cp.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-map-day6.png`) });
await tabs.getByRole("button", { name: /^Day 3/ }).click();
await cp.waitForTimeout(1400);
const dayBox = await cp.getByRole("img", { name: /^Route map/ }).evaluate((el) => el.getAttribute("viewBox"));
await expect(dayBox && dayBox !== allBox, "selecting a day fits the map to its route");
await expect(cp.getByText(/Day 3 · Galle base — 1\. Ella/).isVisible(), "Day 3's route lists the Ella trip");
await expect(
  cp.getByRole("img", { name: /^Route map/ }).evaluate((svg) => {
    const vb = svg.getAttribute("viewBox").split(" ").map(Number);
    const t = [...svg.querySelectorAll("text")].find((x) => x.textContent.trim() === "Ella");
    if (!t) return false;
    const x = Number(t.getAttribute("x"));
    const y = Number(t.getAttribute("y"));
    return x >= vb[0] && x <= vb[0] + vb[2] && y >= vb[1] && y <= vb[1] + vb[3];
  }),
  "the Ella label sits inside the fitted map",
);
const mapShot = path.join(outDir, `${String(++n).padStart(2, "0")}-map-day3-ella.png`);
await cp.locator("section").filter({ has: cp.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: mapShot });
fs.copyFileSync(mapShot, path.join(SHOTS, `r7-map-day3-ella${VIEWSUFFIX}.png`));
await tabs.getByRole("button", { name: /^All days/ }).click();
await cp.waitForTimeout(900);
const allShot = path.join(outDir, `${String(++n).padStart(2, "0")}-map-all-ella.png`);
await cp.locator("section").filter({ has: cp.getByRole("img", { name: /^Route map/ }) }).first().screenshot({ path: allShot });
fs.copyFileSync(allShot, path.join(SHOTS, `r7-map-all-ella${VIEWSUFFIX}.png`));
await expect(cp.getByText(/Road trip · Galle → Ella/).first().isVisible(), "review timeline shows the Ella road-trip leg");
await cp.getByRole("button", { name: /Share my trip/ }).click();
for (const label of ["Story", "Square"]) {
  const btn = cp.getByRole("button", { name: `Save ${label} image` });
  await btn.waitFor({ timeout: 20000 });
  await eventually(() => btn.isEnabled(), 20000);
  const [dl] = await Promise.all([cp.waitForEvent("download"), btn.click()]);
  const file = path.join(outDir, `share-${label.toLowerCase()}-ella${VIEWSUFFIX}.png`);
  await dl.saveAs(file);
  fs.copyFileSync(file, path.join(SHOTS, `r7-share-${label.toLowerCase()}-ella${VIEWSUFFIX}.png`));
  const b = fs.readFileSync(file);
  await expect(b.readUInt32BE(16) === 1080, `${label} export with the Ella trip`);
}
await cp.keyboard.press("Escape");
await cp.waitForTimeout(400);

step("Map tabs in the 5-day preview reach Day 5");
await cp.goto(base + "/trip?step=dates");
await cp.waitForTimeout(1000);
await cp.getByRole("button", { name: /5 days · 4 nights/ }).click();
await cp.waitForTimeout(600);
await cp.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: "Review" }).click();
await cp.waitForTimeout(1800);
const ptabs = cp.getByRole("group", { name: "Highlight a day" });
await ptabs.getByRole("button", { name: /^Day 5/ }).click();
await cp.waitForTimeout(600);
await expect(ptabs.getByRole("button", { name: /^Day 5/ }).getAttribute("aria-pressed").then((v) => v === "true"), "preview: the last day's tab is reachable");
await expect(ptabs.getByRole("button", { name: /^Day 6/ }).count().then((c) => c === 0), "preview: no Day 6 tab");

// ═══ Roles & console ═══════════════════════════════════════════════════
step("Roles: owner (break-glass) makes an admin; member and admin powers");
const own = await browser.newContext(phone);
const ownApi = (await own.newPage()).request;
await expect((await ownApi.post(base + "/api/admin/login", { data: { password: process.env.ADMIN_PASSWORD ?? "admin" } })).ok(), "owner's break-glass password opens an owner console");
const admin = await person(N.admin);
const admin2 = await person(N.admin2);
const member = await person(N.member);
const drafter = await person(N.drafter);
const peeker = await person(N.peeker);
const spare = await person(N.spare);
const olive = await person(N.owner);
// A local test owner (the real owner is Abdul on the live database — never touched here).
{
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  dbj.participants.find((p) => p.id === olive.id).role = "owner";
  fs.writeFileSync(LOCAL_DB, JSON.stringify(dbj, null, 2));
}
await expect((await ownApi.put(`${base}/api/admin/participants/${admin.id}/role`, { data: { role: "admin" } })).ok(), "owner makes Ada an admin");
await expect((await ownApi.put(`${base}/api/admin/participants/${admin2.id}/role`, { data: { role: "admin" } })).ok(), "owner makes Ben an admin");
await expect((await ownApi.put(`${base}/api/admin/participants/${olive.id}/role`, { data: { role: "member" } })).status() === 403, "nobody can demote the owner (not even the owner console)");
await expect((await ownApi.delete(`${base}/api/admin/participants/${olive.id}`)).status() === 403, "nobody can delete the owner");

// Plans: Mo submitted with nightlife + private bits; Dee a draft with a private note; Pip nothing.
await expect(
  (
    await put(
      member,
      plan("2026-12-26", [
        [mk("colombo-tuk-tuk"), mk("pub-golf-colombo")],
        [mk("madu-river-safari"), mk("galle-fort-sunset-dinner")],
        [mk("scuba-diving"), mk("secret-jungle-party")],
        [mk("mirissa-whale-watching"), mk("ropewalk-galle-fort")],
        [mk("galle-fort"), mk("stay")],
        [[], []],
      ], { dietary: ["vegetarian"], mustDo: "MO-PRIVATE-MUSTDO", notes: "MO-PRIVATE-NOTE-FOR-ORGANIZERS" }, { 2: "MO-DAY-NOTE" }),
      true,
    )
  ).ok(),
  "Mo submitted (with private answers and a day note)",
);
await expect(
  (
    await put(
      drafter,
      plan("2026-12-28", [
        [mk("lotus-tower-port-city"), mk("colombo-rooftop")],
        [mk("kosgoda-turtles"), mk("mirissa-seafood-bbq")],
        [mk("kanneliya-trek"), mk("stay")],
        [mk("hiriketiya-day"), mk("nye-galle-fort")],
        [[], mk("smoke-and-bitters")],
        [[], []],
      ], { budget: "400_700", hardNo: "DEE-PRIVATE-HARDNO", flyingFrom: "DEE-PRIVATE-CITY" }, { 1: "DEE-SECRET-DAY-NOTE" }),
    )
  ).ok(),
  "Dee saved a draft (private answers and a day note)",
);

step("A member gets 403 on every admin endpoint");
const adminEndpoints = [
  ["post", "/api/admin/lock", { locked: true }],
  ["post", "/api/admin/rules", { patch: { peek: false } }],
  ["get", "/api/admin/log"],
  ["get", "/api/admin/export?format=json"],
  ["delete", `/api/admin/participants/${spare.id}`],
  ["post", `/api/admin/participants/${spare.id}/pin`, { pin: "1111" }],
  ["put", `/api/admin/participants/${spare.id}/role`, { role: "admin" }],
  ["get", `/api/admin/participants/${drafter.id}/itinerary`],
  ["put", `/api/admin/participants/${drafter.id}/itinerary`, { data: {} }],
  ["post", "/api/admin/session", { pin: PIN }],
];
for (const [m, url, data] of adminEndpoints) {
  const r = await member.api[m](base + url, data ? { data } : undefined);
  await expect(r.status() === 403, `member → ${m.toUpperCase()} ${url.replace(/[0-9a-f-]{36}/, ":id")} = 403 (got ${r.status()})`);
}
const anon = await browser.newContext();
await expect((await anon.request.get(base + "/api/admin/log")).status() === 401, "signed out → 401");

step("Admin opens the console with their PIN");
const ap = admin.page;
await ap.goto(base + "/trip");
await ap.waitForTimeout(1200);
await expect(ap.getByRole("link", { name: /Organizer/ }).isVisible(), "admin sees the Organizer button");
await shot(ap, "admin-header", { keep: true });
await ap.getByRole("link", { name: /Organizer/ }).click();
await ap.waitForURL("**/admin");
await ap.waitForTimeout(800);
await expect(ap.getByText("Confirm your PIN").isVisible(), "the console asks to re-confirm the PIN");
await shot(ap, "console-pin", { keep: true });
await ap.locator("#console-pin").fill(PIN);
await ap.waitForTimeout(1800);
await expect(ap.getByText(/Organizer\s+console/).isVisible(), "PIN opens the console");
await shot(ap, "console-overview", { keep: true, full: true });
const consoleCookie = (await admin.ctx.cookies()).find((c) => c.name === "caravan_console");
await expect(consoleCookie && consoleCookie.expires - Date.now() / 1000 < 12.2 * 3600 && consoleCookie.expires - Date.now() / 1000 > 11.5 * 3600, "console session lasts ~12 hours");

step("Admin powers: everything except owner-only actions");
await expect((await admin.api.post(base + "/api/admin/lock", { data: { locked: false } })).ok(), "admin: lock/unlock");
await expect((await admin.api.get(base + "/api/admin/export?format=json")).ok(), "admin: export");
await expect((await admin.api.post(`${base}/api/admin/participants/${member.id}/pin`, { data: { pin: PIN } })).ok(), "admin: reset a member's PIN");
const view = await admin.api.get(`${base}/api/admin/participants/${member.id}/itinerary`).then((r) => r.json());
await expect(view.row?.data?.preferences?.mustDo === "MO-PRIVATE-MUSTDO", "admin: sees private answers");
await expect((await admin.api.delete(`${base}/api/admin/participants/${spare.id}`)).ok(), "admin: delete a member");
await expect((await admin.api.put(`${base}/api/admin/participants/${member.id}/role`, { data: { role: "admin" } })).status() === 403, "admin can't make admins (owner only)");
await expect((await admin.api.put(`${base}/api/admin/participants/${admin2.id}/role`, { data: { role: "member" } })).status() === 403, "admin can't remove an admin (owner only)");
await expect((await admin.api.delete(`${base}/api/admin/participants/${admin2.id}`)).status() === 403, "admin can't delete another admin");
await expect((await admin.api.post(`${base}/api/admin/participants/${admin2.id}/pin`, { data: { pin: "1111" } })).status() === 403, "admin can't reset an organizer's PIN");
await expect((await admin.api.delete(`${base}/api/admin/participants/${olive.id}`)).status() === 403, "admin can't delete the owner");

step("Admin edits Mo's plan in the day builder (works while locked; stamped; Mo sees a note)");
await admin.api.post(base + "/api/admin/lock", { data: { locked: true } });
await expect((await put(member, await getPlan(member))).status() === 423, "edits locked: Mo's own save is refused");
await ap.goto(`${base}/admin/edit/${member.id}?step=build`);
await ap.waitForTimeout(1600);
await expect(ap.getByText(new RegExp(`Editing ${N.member}'s plan as an organizer`)).isVisible(), "admin edit banner");
await row(ap, 5 - 1).getByRole("button", { name: "Add another to daytime" }).click();
await ap.waitForTimeout(900);
await sheet(ap).getByLabel("Search activities").fill("snorkel");
await ap.waitForTimeout(400);
await sheet(ap).getByRole("button", { name: /^Add Snorkel/ }).first().click();
await ap.waitForTimeout(2200);
await shot(ap, "admin-edit", { keep: true });
const moRow = await eventually(async () => {
  const r = await admin.api.get(`${base}/api/admin/participants/${member.id}/itinerary`).then((x) => x.json());
  return r.row?.stamp?.kind === "edit" && r.row.data.days[4].day.length >= 2 ? r.row : null;
});
await expect(moRow?.stamp?.by === N.admin && moRow.data.days[4].day.length >= 2, "saved while locked, stamped “Edited by Ada”");
await expect(moRow?.status === "submitted", "Mo's plan stays submitted");
await admin.api.post(base + "/api/admin/lock", { data: { locked: false } });
await member.page.goto(base + "/trip");
await member.page.waitForTimeout(1300);
await expect(member.page.getByRole("status", { name: "Organizer update" }).getByText(new RegExp(`${N.admin}`)).isVisible(), "Mo sees “Ada updated your plan on …”");
await shot(member.page, "member-edit-note", { keep: true });
await member.page.getByRole("button", { name: "Dismiss update" }).click();
await member.page.waitForTimeout(800);
await member.page.reload();
await member.page.waitForTimeout(1200);
await expect(member.page.getByRole("status", { name: "Organizer update" }).count().then((c) => c === 0), "the note goes once dismissed");

step("Scheduled auto-lock with a countdown");
const inTwoDays = new Date(Date.now() + 2 * 86400_000 + 3600_000).toISOString();
await expect((await admin.api.post(base + "/api/admin/rules", { data: { patch: { autoLockAt: inTwoDays } } })).ok(), "auto-lock scheduled in 2 days");
await member.page.goto(base + "/trip");
await member.page.waitForTimeout(1300);
await expect(member.page.getByRole("status", { name: "Edits close soon" }).getByText(/Edits close in 2 days/).isVisible(), "everyone sees the countdown");
await shot(member.page, "countdown", { keep: true });
await admin.api.post(base + "/api/admin/rules", { data: { patch: { autoLockAt: new Date(Date.now() - 60_000).toISOString() } } });
await expect((await put(member, await getPlan(member))).status() === 423, "after the auto-lock time, saves are refused server-side");
await member.page.goto(base + "/trip");
await member.page.waitForTimeout(1000);
await expect(member.page.getByText("Edits are closed — the final plan is coming!").isVisible(), "locked banner after auto-lock");
await admin.api.post(base + "/api/admin/rules", { data: { patch: { autoLockAt: null } } });
await expect((await put(member, await getPlan(member))).ok(), "clearing the auto-lock opens edits again");

step("Announcement banner");
await ap.goto(base + "/admin#announce");
await ap.waitForTimeout(1000);
await ap.getByLabel("Announcement text").fill("Flights: aim to land before noon on Day 1 ✈️");
await ap.getByRole("button", { name: "Save text" }).click();
await ap.waitForTimeout(800);
await ap.getByRole("switch", { name: "Show announcement" }).click();
await ap.waitForTimeout(1000);
await member.page.goto(base + "/trip");
await member.page.waitForTimeout(1200);
await expect(member.page.getByRole("status", { name: "Announcement" }).getByText(/land before noon/).isVisible(), "everyone sees the announcement");
await shot(member.page, "announcement", { keep: true });
await anon.newPage().then(async (p) => {
  await p.goto(base + "/");
  await p.waitForTimeout(1200);
  await expect(p.getByRole("status", { name: "Announcement" }).isVisible(), "the welcome page shows it too");
});

step("Hide an option someone picked");
await ap.goto(base + "/admin#content");
await ap.waitForTimeout(1000);
await ap.getByLabel("Search content").fill("Secret Jungle");
await ap.waitForTimeout(400);
await ap.getByRole("button", { name: /^Hide Secret Jungle Party/ }).click();
await ap.waitForTimeout(1200);
await expect(ap.getByRole("button", { name: /^Unhide Secret Jungle Party/ }).isVisible(), "hidden in the console");
await shot(ap, "console-content-hidden", { keep: true });
await member.page.goto(base + "/trip?step=build");
await member.page.waitForTimeout(1400);
await expect(row(member.page, 2).getByText("No longer available").isVisible(), "Mo's plan marks it “No longer available” (not deleted)");
await row(member.page, 2).scrollIntoViewIfNeeded();
await shot(member.page, "hidden-item", { keep: true });
const dp = await getPlan(drafter);
dp.days[2].night = mk("secret-jungle-party");
await put(drafter, dp);
await expect(getPlan(drafter).then((x) => !ids(x.days[2].night).includes("secret-jungle-party")), "new picks of a hidden option are refused server-side");
await expect(getPlan(member).then((x) => ids(x.days[2].night).includes("secret-jungle-party")), "Mo's existing pick is kept");

step("Changing the nights split: impact preview, then a safe migration");
await ap.goto(base + "/admin#rules");
await ap.waitForTimeout(1000);
await ap.getByRole("button", { name: "More Colombo nights" }).click();
await ap.getByRole("button", { name: /Review & apply · 7 days · 6 nights/ }).click();
await ap.waitForTimeout(1200);
await expect(ap.getByText(/plans will move over/).isVisible(), "impact preview before applying");
await expect(ap.getByText(/itineraries will need re-picks|itinerary needs re-picks/).isVisible(), "…with how many need re-picks");
await shot(ap, "console-impact", { keep: true });
await ap.getByRole("button", { name: "Apply and move the plans" }).click();
await ap.waitForTimeout(2000);
const moved = await getPlan(member);
await expect(moved.days.length === 7 && moved.endDate === "2027-01-01", "Mo's plan is now 7 days · 6 nights");
await expect(ids(moved.days[0].day)[0] === "colombo-tuk-tuk" && ids(moved.days[2].day)[0] === "madu-river-safari", "picks kept by role (Colombo, road trip, Galle)");
await member.page.goto(base + "/trip");
await member.page.waitForTimeout(1300);
await expect(member.page.getByRole("status", { name: "Organizer update" }).getByText(/changed the trip/).isVisible(), "Mo gets a one-time note about the change");
await shot(member.page, "rules-change-note", { keep: true });
const back = await admin.api.post(base + "/api/admin/rules", { data: { patch: { colomboNights: 1 }, confirm: true } });
await expect(back.ok(), "back to 1 Colombo night (confirmed)");
await expect(getPlan(member).then((x) => x.days.length === 6), "plans moved back to 6 days");

step("Activity log");
const log = await admin.api.get(base + "/api/admin/log").then((r) => r.json());
const has = (a, by) => log.some((e) => e.action === a && (!by || e.actor_name === by));
await expect(has("make_admin", "Organizer (password)"), "log: owner made an admin");
await expect(has("console_open", N.admin), "log: Ada opened the console");
await expect(has("reset_pin", N.admin) && has("delete_participant", N.admin), "log: PIN reset + delete");
await expect(has("edit_plan", N.admin), "log: Ada edited Mo's plan");
await expect(has("lock_edits", N.admin) && has("update_rules", N.admin), "log: lock + rules changes");

// ═══ Peek ═════════════════════════════════════════════════════════════
step("👀 Peek at a draft before submitting your own");
const pp = peeker.page;
await pp.goto(base + "/group");
await pp.waitForTimeout(1500);
const deeCard = pp.getByRole("list", { name: "Everyone" }).getByRole("listitem").filter({ hasText: N.drafter });
await expect(deeCard.getByText("Still cooking…").isVisible(), "drafts say “Still cooking…”");
await expect(deeCard.getByRole("link", { name: `Peek at ${N.drafter}'s plan` }).isVisible(), "a 👀 Peek button on their card");
await deeCard.scrollIntoViewIfNeeded();
await shot(pp, "peek-cards", { keep: true });
await deeCard.getByRole("link", { name: `Peek at ${N.drafter}'s plan` }).click();
await pp.waitForURL("**/group/peek/**");
await pp.waitForTimeout(2200);
await expect(pp.getByLabel("Status: In progress").isVisible(), "the full plan opens, marked “In progress”");
await expect(pp.getByRole("img", { name: /^Route map/ }).isVisible(), "…with the route map");
await expect(pp.getByRole("heading", { name: "Day by day" }).isVisible(), "…and the day-by-day timeline");
await expect(pp.getByText(/DEE-SECRET-DAY-NOTE|DEE-PRIVATE/).count().then((c) => c === 0), "no day notes or private answers on the page");
await expect(pp.getByRole("button", { name: /Pick this|Add to Day|Swap in/ }).count().then((c) => c === 0), "nothing to pick, copy or add");
await shot(pp, "peek-open", { keep: true });

step("The peek endpoint returns no private fields or notes");
const raw = await peeker.api.get(`${base}/api/peek/${drafter.id}`).then((r) => r.text());
const body = JSON.parse(raw);
await expect(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(["data", "name", "role", "status"]), "only name, role, status and the plan");
await expect(!/DEE-SECRET-DAY-NOTE|DEE-PRIVATE|"note"|budget|dietary|hardNo|flyingFrom|roommates/.test(raw), "no notes or private answers in the response");
await expect(body.status === "draft" && body.data.days.length === 6 && JSON.stringify(body.data.preferences) === "{}", "a draft, with its days and no answers");

step("Peek counter: unique peekers, never who");
await peeker.api.get(`${base}/api/peek/${drafter.id}`);
await member.api.get(`${base}/api/peek/${drafter.id}`);
await drafter.page.goto(base + "/trip?step=review");
await drafter.page.waitForTimeout(1500);
await expect(drafter.page.getByLabel("Peek counter").getByText("2 people peeked at your plan").isVisible(), "Dee sees “👀 2 people peeked at your plan” (Pip ×3, Mo ×1)");
await drafter.page.getByLabel("Peek counter").scrollIntoViewIfNeeded();
await shot(drafter.page, "peek-counter", { keep: true });
const log2 = await admin.api.get(base + "/api/admin/log").then((r) => r.json());
await expect(log2.filter((e) => e.action === "peek" && e.target_name === N.drafter).map((e) => e.actor_name).sort().join() === [N.member, N.peeker].sort().join(), "organizers see who peeked (once per person)");

step("Peek switched off by the rule");
await admin.api.post(base + "/api/admin/rules", { data: { patch: { peek: false } } });
await expect((await peeker.api.get(`${base}/api/peek/${drafter.id}`)).status() === 403, "peek endpoint refuses (403)");
await pp.goto(base + "/group");
await pp.waitForTimeout(1200);
await expect(pp.getByRole("link", { name: /^Peek at/ }).count().then((c) => c === 0), "no Peek buttons");
await admin.api.post(base + "/api/admin/rules", { data: { patch: { peek: true, announcement: { on: false, text: "" }, hidden: [] } } });

step("Organizer badge + privacy line");
await pp.goto(base + "/group");
await pp.waitForTimeout(1200);
await expect(pp.getByRole("list", { name: "Everyone" }).getByRole("listitem").filter({ hasText: N.admin }).getByText("Organizer").isVisible(), "Organizer badge on the group screen");
await member.page.goto(base + "/trip?step=prefs");
await member.page.waitForTimeout(1000);
await expect(member.page.getByText(new RegExp(`Only the organizers \\(.*${N.admin}.*\\) see these answers`)).isVisible(), "prefs privacy line names the organizers");

// ═══ Desktop ══════════════════════════════════════════════════════════
step("Desktop: console, peek, Ella map");
{
  const ctxD = await browser.newContext(desktop);
  await ctxD.addCookies(await admin.ctx.cookies());
  const pd = await ctxD.newPage();
  await pd.goto(base + "/admin#people");
  await pd.waitForTimeout(1400);
  await shot(pd, "desktop-console-people", { keep: true });
  await pd.goto(base + "/admin#activity");
  await pd.waitForTimeout(1200);
  await shot(pd, "desktop-console-activity", { keep: true });
  await ctxD.close();
  const ctxP = await browser.newContext(desktop);
  await ctxP.addCookies(await peeker.ctx.cookies());
  const pk = await ctxP.newPage();
  await pk.goto(`${base}/group/peek/${member.id}`);
  await pk.waitForTimeout(2000);
  await pk.mouse.move(1180, 420);
  await pk.waitForTimeout(500);
  await shot(pk, "desktop-peek", { keep: true });
  await ctxP.close();
  const ctxC = await browser.newContext(desktop);
  await ctxC.addCookies(await climber.ctx.cookies());
  const pc = await ctxC.newPage();
  await pc.goto(base + "/trip?step=review");
  await pc.waitForTimeout(2000);
  await pc.getByRole("group", { name: "Highlight a day" }).getByRole("button", { name: /^Day 3/ }).click();
  await pc.waitForTimeout(1400);
  await shot(pc, "desktop-map-ella", { keep: true });
  await ctxC.close();
}

// ═══ Cleanup ══════════════════════════════════════════════════════════
step("Cleanup: test users and rules (local store only; never Abdul or Aadil)");
{
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  const o = dbj.participants.find((p) => p.id === olive.id);
  if (o) o.role = "member"; // a test owner can't be deleted while it's the owner
  fs.writeFileSync(LOCAL_DB, JSON.stringify(dbj, null, 2));
}
await ownApi.post(base + "/api/admin/rules", { data: { patch: { peek: true, spectrum: true, halalButton: true, autoLockAt: null, announcement: { on: false, text: "" }, hidden: [], recheck: [], featured: [], colomboNights: 1, galleNights: 4 }, confirm: true } });
await ownApi.post(base + "/api/admin/lock", { data: { locked: false } });
const PROTECTED = /^(abdul|aadil)$/i;
const everyone = await ownApi.get(base + "/api/people").then((r) => r.json());
for (const p of everyone.filter((x) => Object.values(N).includes(x.name) && !PROTECTED.test(x.name))) {
  const r = await ownApi.delete(`${base}/api/admin/participants/${p.id}`);
  await expect(r.ok(), `deleted ${p.name}`);
}

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n- ${errors.join("\n- ")}` : "\nAll checks passed ✓");
process.exit(errors.length ? 1 : 0);
