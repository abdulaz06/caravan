// End-to-end checks for round 9: 🔥 popular picks, roommate picks, the full
// read-only peek and the Halal mode clean-up (incl. the banned-word sweep).
// Runs against the local-store server only (LANKS_LOCAL_STORE=1).
// Usage: node --env-file=.env.local scripts/round9.mjs <outDir>
//   env: BASE (default http://localhost:3100), CHROME_PATH, VIEW (e.g. 375x667), ADMIN_PASSWORD
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "screenshots/round9";
const base = process.env.BASE ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("round9 tests run against a local server only");
const exe = process.env.CHROME_PATH;
const stamp = Date.now().toString(36).slice(-4);
const PIN = "4826";
const LOCAL_DB = path.join(process.cwd(), ".data", "dev-db.json");
const SHOTS = path.join(process.cwd(), "screenshots");
const VIEWSUFFIX = process.env.VIEW ? `-${process.env.VIEW}` : "";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

// The Halal word list lives in one place (shared with the app's startup check).
const WORDS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/content/halal-banned-words.json"), "utf8"));
const forms = (w) => (w.endsWith("y") ? `${w.slice(0, -1)}(?:y|ies|ying)` : w === "club" ? "club(?:s|bing|bers?)?" : `${w}(?:s|es)?`);
const BANNED = new RegExp(`\\b(?:${WORDS.map(forms).join("|")})\\b`, "gi");
const banned = (text) => [...new Set((text.match(BANNED) ?? []).map((m) => m.toLowerCase()))];

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const [vw, vh] = (process.env.VIEW ?? "390x844").split("x").map(Number);
const TZ = { timezoneId: "Pacific/Auckland" };
const phone = { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, ...TZ };
const desktop = { viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...TZ };
let n = 0;
const errors = [];

const N = {
  s1: `Sol ${stamp}`,
  s2: `Tam ${stamp}`,
  s3: `Uma ${stamp}`,
  s4: `Vic ${stamp}`,
  s5: `Wes ${stamp}`,
  pia: `Pia ${stamp}`,
  bo: `Bo ${stamp}`,
  cy: `Cy ${stamp}`,
  dee: `Dee ${stamp}`,
  eve: `Eve ${stamp}`,
  hal: `Hal ${stamp}`,
  z1: `zz-test-a${stamp}`,
  z2: `zz-test-b${stamp}`,
  z3: `zz-test-c${stamp}`,
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
  if (opts.keep) fs.copyFileSync(file, path.join(SHOTS, `r9-${name}${VIEWSUFFIX}.png`));
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
async function person(name, ctxOpts = phone) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror(${name}): ${e.message}`));
  const res = await page.request.post(base + "/api/auth/join", { data: { name, pin: PIN } });
  if (!res.ok()) throw new Error(`join ${name}: ${res.status()}`);
  return { ctx, page, id: (await res.json()).id, name, api: page.request };
}
const mk = (...ids) => ids.map((id) => ({ key: Math.random().toString(36).slice(2, 10), id }));
function plan(start, days, prefs = {}, notes = {}) {
  const add = (iso, k) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + k);
    return d.toISOString().slice(0, 10);
  };
  return {
    version: 3,
    startDate: start,
    endDate: add(start, days.length - 1),
    flexibility: "few_days",
    days: days.map(([day, night], i) => ({ id: `d${i}${Math.random().toString(36).slice(2, 6)}`, day, night, ...(notes[i] ? { note: notes[i] } : {}) })),
    preferences: prefs,
  };
}
const getPlan = async (u) => (await u.api.get(base + "/api/itinerary").then((r) => r.json()))?.data;
const put = (u, data, submit = false) => u.api.put(base + "/api/itinerary", { data: { data, submit } });
const row = (page, i) => page.locator("ol > li").nth(i);
const sheet = (page) => page.getByRole("dialog").last();
/** A plain 6-day Galle-side plan: [day3, day4, day5] daytimes and [night3] evening. */
const simple = (d3 = [], d4 = [], d5 = [], n3 = [], extra = {}) =>
  plan("2026-12-14", [[[], []], [[], []], [mk(...d3), mk(...n3)], [mk(...d4), []], [mk(...d5), []], [[], []]], extra);

// Owner console (break-glass password = owner level)
const own = await browser.newContext(desktop);
const ownPage = await own.newPage();
const ownApi = ownPage.request;
if (!(await ownApi.post(base + "/api/admin/login", { data: { password: process.env.ADMIN_PASSWORD } })).ok()) throw new Error("owner login failed");
await ownApi.post(base + "/api/admin/rules", { data: { patch: { popularBadges: true, peek: true, browse: "after_submit", halalButton: true, hidden: [] } } });

// ═══ Seed ═══════════════════════════════════════════════════════════════
step("Seed: five real pickers, three zz-test users, and the cast");
const [s1, s2, s3, s4, s5, z1, z2, z3] = await Promise.all([N.s1, N.s2, N.s3, N.s4, N.s5, N.z1, N.z2, N.z3].map((x) => person(x)));
await put(s1, simple(["galle-fort"], ["mirissa-whale-watching"], ["unawatuna-jungle-beach"], ["galle-fort-sunset-dinner"]), true);
await put(s2, simple(["galle-fort"], ["mirissa-whale-watching"], ["unawatuna-jungle-beach"], ["galle-fort-sunset-dinner"]), true);
await put(s3, simple(["galle-fort"], ["mirissa-whale-watching"], [], ["galle-fort-sunset-dinner"]), true);
await put(s4, simple(["galle-fort"], [], [], ["galle-fort-sunset-dinner"]), true);
await put(s5, simple(["galle-fort"]), true);
// Test users pile onto Unawatuna (and Galle Fort) — none of it may count.
for (const z of [z1, z2, z3]) await put(z, simple(["galle-fort"], [], ["unawatuna-jungle-beach"]), true);

const pia = await person(N.pia);
const bo = await person(N.bo);
const cy = await person(N.cy);
const dee = await person(N.dee);
const eve = await person(N.eve);
const hal = await person(N.hal);
const one = (d1, n1) => plan("2026-12-14", [[mk(...d1), mk(...n1)], [[], []], [[], []], [[], []], [[], []], [[], []]]);
await put(pia, one(["colombo-tuk-tuk"], ["galle-face-street-food"]), false);
await put(bo, { ...one(["negombo-lagoon"], []), preferences: { roommates: [{ id: pia.id, name: N.pia }] } }, true);
await put(cy, one(["lotus-tower-port-city"], []), true);
await put(
  dee,
  plan("2026-12-14", [[[], []], [[], []], [mk("kottawa-rainforest"), []], [[], mk("mirissa-seafood-bbq")], [[], []], [[], []]], { mustDo: "DEE-PRIVATE" }, { 2: "DEE-SECRET-NOTE" }),
  false,
);
// Hal: nightlife on every evening (NYE on Day 5), plus day picks whose own words mention bars.
const halPlan = plan(
  "2026-12-27",
  [
    [mk("colombo-tuk-tuk"), mk("pub-golf-colombo", "casino-night", "playdium-bowling")],
    [mk("madu-river-safari"), mk("ropewalk-galle-fort", "mirissa-beach-bars")],
    [mk("hiriketiya-day"), mk("doctors-house-madiha", "smoke-and-bitters")],
    [mk("ahangama-cafes-yoga"), mk("lamana-ahangama", "mono-speakeasy")],
    [mk("mirissa-beach-hop"), mk("nye-mirissa-beach-party", "weligama-sundowners")],
    [[], []],
  ],
  { mustDo: "a bar crawl and a pub night", interests: ["nightlife", "beaches"] },
  { 2: "Pub after the beach!" },
);
await expect((await put(hal, halPlan)).ok(), "Hal's nightlife-heavy plan saved");
const halSaved = await getPlan(hal);
await expect(halSaved?.days[0].night.length === 3 && halSaved.days[4].night.length === 2, "…with every pick kept");

// ═══ Popular ════════════════════════════════════════════════════════════
step("🔥 Popular: counts per person, a threshold, test users and stays left out");
await new Promise((r) => setTimeout(r, 6000)); // the server's popular cache (5 s locally)
const pop = await pia.api.get(base + "/api/popular").then((r) => r.json());
console.log("    popular:", JSON.stringify(pop.counts), "threshold", pop.threshold);
await expect(pop.on && pop.threshold === 3, "threshold 3 (min 3, or 20% of the 10 real pickers)");
await expect(
  JSON.stringify(pop.counts) === JSON.stringify({ "galle-fort": 5, "mirissa-whale-watching": 3, "galle-fort-sunset-dinner": 4 }) ||
    (pop.counts["galle-fort"] === 5 && pop.counts["mirissa-whale-watching"] === 3 && pop.counts["galle-fort-sunset-dinner"] === 4 && Object.keys(pop.counts).length === 3),
  "exactly Galle Fort (5), whales (3) and the Galle Fort sunset dinner (4)",
);
await expect(!("unawatuna-jungle-beach" in pop.counts), "Unawatuna (2 real picks + 3 test users) isn't popular");
await expect((await eve.api.get(base + "/api/popular").then((r) => r.status())) === 200 && (await (await browser.newContext()).request.get(base + "/api/popular")).status() === 401, "signed-in only");

const pp = pia.page;
await pp.goto(base + "/trip?step=build");
await pp.waitForTimeout(1600);
await row(pp, 2).getByRole("button", { name: "Pick your daytime" }).click();
await pp.waitForTimeout(1000);
const fortTile = sheet(pp).getByRole("button", { name: /^Pick Galle Fort: ramparts/ });
await expect(fortTile.getByLabel("Popular: 5 people picked this").isVisible(), "matchup card: “Popular · 5 picked” on Galle Fort");
await expect(sheet(pp).getByLabel("Popular: 3 people picked this").count().then((c) => c >= 1), "matchup card: whale watching shows 3 picked");
await expect(sheet(pp).getByRole("button", { name: /^Pick Unawatuna/ }).getByLabel(/^Popular/).count().then((c) => c === 0), "no badge under the threshold (Unawatuna)");
await fortTile.scrollIntoViewIfNeeded();
await shot(pp, "popular-matchup", { keep: true });
await pp.keyboard.press("Escape");
await pp.waitForTimeout(500);

await row(pp, 2).getByRole("button", { name: /or browse everything/ }).first().click();
await pp.waitForTimeout(900);
const cats = sheet(pp).getByRole("group", { name: "Categories" });
await expect(cats.getByRole("button", { name: /Popular/ }).isVisible(), "catalog: a “🔥 Popular” filter");
await expect(sheet(pp).getByLabel("Popular: 5 people picked this").first().isVisible(), "catalog row: Galle Fort badge");
await cats.getByRole("button", { name: /Popular/ }).click();
await pp.waitForTimeout(600);
const adds = await sheet(pp).getByRole("button", { name: /^Add / }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log("    popular filter:", adds.join(" | "));
await expect(adds.length === 2 && /Galle Fort/.test(adds[0]) && /whale/i.test(adds[1]), "Popular filter: only the popular daytime picks, most picked first");
await shot(pp, "popular-catalog", { keep: true });
await sheet(pp).getByRole("button", { name: /^More about Galle Fort/ }).click();
await pp.waitForTimeout(900);
await expect(sheet(pp).getByLabel("Popular: 5 people picked this").isVisible(), "detail sheet: the badge");
await shot(pp, "popular-detail", { keep: true });
await pp.keyboard.press("Escape");
await pp.waitForTimeout(400);
await pp.keyboard.press("Escape");
await pp.waitForTimeout(400);

// ═══ Roommates ══════════════════════════════════════════════════════════
step("Roommates: pick and rank up to 3 (crew + a typed name), privately");
await pp.goto(base + "/trip?step=prefs");
await pp.waitForTimeout(1500);
await expect(pp.getByText("Top choices to share a room with 😄").isVisible(), "the card is there");
await expect(pp.getByText("Just for fun · not binding").isVisible(), "…labelled just for fun, not binding");
await expect(pp.getByText(/Only the organizers (\(.*\) )?see these answers, roommate picks included/).isVisible(), "privacy line mentions roommate picks");
const crew = pp.getByRole("group", { name: "The crew" });
const crewNames = await crew.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
await expect(crewNames.some((x) => x.includes(N.bo)) && crewNames.some((x) => x.includes(N.hal)), "the crew lists people who started a plan");
await expect(!crewNames.some((x) => x.includes(N.pia) || x.includes(N.eve) || /zz-test/i.test(x)), "…not yourself, not people without a plan, never test users");
await pp.getByLabel("Search the crew").fill(N.bo.split(" ")[0]);
await crew.getByRole("button", { name: `Pick ${N.bo} as a roommate` }).click();
await pp.getByLabel("Search the crew").fill("");
await crew.getByRole("button", { name: `Pick ${N.cy} as a roommate` }).click();
await pp.getByLabel("Someone not on the list? Type their name").fill("Sam Newbie");
await pp.getByRole("button", { name: "Add", exact: true }).click();
await pp.waitForTimeout(400);
await pp.getByRole("button", { name: "Move Sam Newbie up" }).click();
await expect(pp.getByText("That's your top 3 — remove one to swap someone in.").isVisible(), "full at three");
let rm = await eventually(async () => {
  const x = await getPlan(pia);
  return x?.preferences?.roommates?.length === 3 ? x.preferences.roommates : null;
});
await expect(JSON.stringify(rm) === JSON.stringify([{ id: bo.id, name: N.bo }, { name: "Sam Newbie" }, { id: cy.id, name: N.cy }]), "saved in order: Bo, Sam Newbie (typed), Cy");
await pp.getByLabel("Your roommate picks").scrollIntoViewIfNeeded();
await shot(pp, "roommates-prefs", { keep: true });

step("Roommates: older app versions can't wipe them; clearing works");
{
  const cur = await getPlan(pia);
  const { roommates, ...rest } = cur.preferences;
  await put(pia, { ...cur, preferences: rest }); // an older client: no roommates key at all
  await expect(JSON.stringify((await getPlan(pia)).preferences.roommates) === JSON.stringify(roommates), "a save without the field keeps them");
  await put(pia, { ...cur, preferences: { ...rest, roommates: [] } });
  await expect(((await getPlan(pia)).preferences.roommates ?? []).length === 0, "an empty list clears them");
  await put(pia, { ...cur, preferences: { ...rest, roommates: [{ id: pia.id, name: N.pia }, ...roommates, { name: "Extra" }] } }, true);
  rm = (await getPlan(pia)).preferences.roommates;
  await expect(JSON.stringify(rm) === JSON.stringify(roommates), "yourself is dropped, three max (and Pia submits)");
  await put(pia, { ...cur, preferences: { ...rest, mustDo: "PIA-PRIVATE", roommates } }, true);
}

step("Roommates stay private: browse, peek and the group screen");
const cp = cy.page;
await cp.goto(`${base}/group/${pia.id}`);
await cp.waitForTimeout(1500);
const browseHtml = await cp.content();
await expect(cp.getByText(N.pia).first().isVisible(), "Cy can browse Pia's submitted plan");
await expect(!/Sam Newbie|roommates|PIA-PRIVATE/.test(browseHtml), "…but the page carries no roommate picks or private answers");
await cp.goto(`${base}/group`);
await cp.waitForTimeout(1500);
await expect(!/Sam Newbie|roommates/.test(await cp.content()), "group screen: no roommate picks");
await expect(cp.getByText(/zz-test/i).count().then((c) => c === 0), "group screen: no test users");
await expect(cp.getByLabel("Popular: 5 people picked this").first().isVisible(), "group overview: 🔥 on the most picked");
await cp.getByRole("heading", { name: "Most picked" }).scrollIntoViewIfNeeded();
await shot(cp, "popular-group", { keep: true });
const peekRaw = await eve.api.get(`${base}/api/peek/${pia.id}`).then((r) => r.text());
await expect(!/Sam Newbie|roommates|PIA-PRIVATE/.test(peekRaw), "peek endpoint: no roommate picks or private answers");

step("Console: roommate matches (mutual + who picked whom) and exports");
await ownPage.goto(base + "/admin#roommates");
await ownPage.waitForTimeout(1500);
const mutual = ownPage.getByRole("list", { name: "Mutual matches" });
await expect(mutual.getByText(new RegExp(`(${N.pia} 🤝 ${N.bo}|${N.bo} 🤝 ${N.pia})`)).isVisible(), "mutual: Pia 🤝 Bo");
await expect(mutual.getByText("Both #1").isVisible(), "…both put each other first");
const who = ownPage.getByRole("list", { name: "Who picked whom" });
await expect(who.getByRole("listitem").filter({ hasText: N.pia }).getByText("Sam Newbie").isVisible(), "who picked whom: Pia → Sam Newbie");
await expect(who.getByRole("listitem").filter({ hasText: N.pia }).getByText("· not joined").isVisible(), "…marked not joined");
await shot(ownPage, "console-roommates", { keep: true });
const exp = await ownApi.get(base + "/api/admin/export?format=json").then((r) => r.json());
await expect(exp.roommates?.mutual?.some((m) => [m.a.name, m.b.name].sort().join() === [N.pia, N.bo].sort().join()), "JSON export: roommates.mutual has Pia ↔ Bo");
await expect(exp.participants.find((p) => p.name === N.pia)?.roommates?.map((r) => r.name).join() === `${N.bo},Sam Newbie,${N.cy}`, "JSON export: Pia's ranked picks");
await expect(!exp.participants.some((p) => /zz-test/i.test(p.name)), "exports leave test users out");
const csv = await ownApi.get(base + "/api/admin/export?format=csv").then((r) => r.text());
await expect(csv.split("\n")[0].includes("roommate_1,roommate_2,roommate_3,mutual_roommates") && csv.includes("Sam Newbie"), "CSV export: roommate columns");

step("Popular badges toggle (console)");
await ownApi.post(base + "/api/admin/rules", { data: { patch: { popularBadges: false } } });
await pp.goto(base + "/trip?step=build");
await pp.waitForTimeout(1500);
await row(pp, 3).getByRole("button", { name: "Pick your daytime" }).click();
await pp.waitForTimeout(900);
await expect(sheet(pp).getByLabel(/^Popular:/).count().then((c) => c === 0), "toggle off: no badges on matchups");
await pp.keyboard.press("Escape");
await row(pp, 3).getByRole("button", { name: /or browse everything/ }).first().click();
await pp.waitForTimeout(800);
await expect(sheet(pp).getByRole("group", { name: "Categories" }).getByRole("button", { name: /Popular/ }).count().then((c) => c === 0), "…and no Popular filter");
await pp.keyboard.press("Escape");
await expect((await pia.api.get(base + "/api/popular").then((r) => r.json())).on === false, "…and the endpoint says off");
await ownApi.post(base + "/api/admin/rules", { data: { patch: { popularBadges: true } } });

// ═══ Peek ═══════════════════════════════════════════════════════════════
step("👀 Peek shows the full read-only plan, drafts too");
const ep = eve.page;
await ep.goto(base + "/group");
await ep.waitForTimeout(1500);
const deeCard = ep.getByRole("list", { name: "Everyone" }).getByRole("listitem").filter({ hasText: N.dee });
await deeCard.getByRole("link", { name: `Peek at ${N.dee}'s plan` }).click();
await ep.waitForURL("**/group/peek/**");
await ep.waitForTimeout(2000);
await expect(ep.getByLabel("Status: In progress").isVisible(), "“In progress” on a draft");
await expect(ep.getByRole("img", { name: /^Route map/ }).isVisible(), "the route map");
await expect(ep.getByRole("button", { name: /^Daytime: Kottawa/ }).isVisible(), "the day-by-day timeline with their picks");
await expect(!/DEE-SECRET-NOTE|DEE-PRIVATE|roommates/.test(await ep.content()), "no day notes or private answers anywhere on the page");
await shot(ep, "peek-full", { keep: true });
await ep.getByRole("heading", { name: "Day by day" }).scrollIntoViewIfNeeded();
await shot(ep, "peek-days", { keep: true });
await ep.getByRole("button", { name: /^Daytime: Kottawa/ }).click();
await ep.waitForTimeout(800);
await expect(sheet(ep).getByRole("button", { name: /Pick this|Add to Day|Swap in/ }).count().then((c) => c === 0), "details open read-only — nothing to pick, copy or add");
await ep.keyboard.press("Escape");
const peekBody = await eve.api.get(`${base}/api/peek/${dee.id}`).then((r) => r.json());
await expect(JSON.stringify(Object.keys(peekBody).sort()) === JSON.stringify(["data", "name", "role", "status"]), "the endpoint returns name, role, status and the plan only");
await expect(peekBody.data.days.every((d) => !("note" in d)) && JSON.stringify(peekBody.data.preferences) === "{}", "…no notes, no answers");
await dee.page.goto(base + "/trip?step=review");
await dee.page.waitForTimeout(1500);
await expect(dee.page.getByLabel("Peek counter").getByText("1 person peeked at your plan").isVisible(), "Dee still sees the anonymous counter");

// ═══ Halal ══════════════════════════════════════════════════════════════
/** Every bit of text a screen shows: visible text, SVG labels, aria-labels, titles and alt text. */
const screenText = (page) =>
  page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const attrs = [...document.querySelectorAll("[aria-label],[title],img[alt]")]
      .filter((e) => vis(e) || e.closest("svg"))
      .flatMap((e) => [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("alt")])
      .filter(Boolean);
    const svg = [...document.querySelectorAll("svg text, svg title")].map((t) => t.textContent);
    return [document.body.innerText, ...svg, ...attrs].join("\n");
  });
const drawnText = (page) =>
  page.evaluate(() => {
    const out = [];
    let buf = "";
    for (const s of window.__drawn ?? []) {
      if (s.length === 1) buf += s;
      else {
        if (buf) out.push(buf);
        buf = "";
        out.push(s);
      }
    }
    if (buf) out.push(buf);
    return out.join("\n");
  });
const recordCanvas = () => {
  window.__drawn = [];
  const fill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) {
    window.__drawn.push(String(t));
    return fill.call(this, t, ...rest);
  };
};
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

async function halalSweep(page, label, opts = {}) {
  const found = new Map();
  const note = (where, text) => {
    for (const w of banned(text)) found.set(`${w} @ ${where}`, true);
  };
  note("review", await screenText(page));
  // every item's detail sheet
  const items = page.getByRole("button", { name: /^(Daytime|Evening): / });
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const it = items.nth(i);
    if (!(await it.isEnabled())) continue;
    const name = await it.getAttribute("aria-label");
    await it.scrollIntoViewIfNeeded();
    await it.click();
    await page.waitForTimeout(450);
    note(`detail “${name}”`, await sheet(page).innerText());
    if (opts.shotDetail && i === 3) await shot(page, `${label}-detail`, { keep: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  // budget
  if (opts.budgetSheet) {
    await page.getByRole("button", { name: /Trip budget · per person/ }).click();
    await page.waitForTimeout(700);
    note("budget", await sheet(page).innerText());
    await shot(page, `${label}-budget`, { keep: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // both share images, drawn on a canvas
  await page.evaluate(() => (window.__drawn = []));
  await page.getByRole("button", { name: /Share my trip/ }).click();
  const files = {};
  for (const f of ["Story", "Square"]) {
    const btn = page.getByRole("button", { name: `Save ${f} image` });
    await btn.waitFor({ timeout: 20000 });
    await eventually(() => btn.isEnabled(), 20000);
    const [dl] = await Promise.all([page.waitForEvent("download"), btn.click()]);
    files[f] = path.join(outDir, `share-${f.toLowerCase()}-${label}${VIEWSUFFIX}.png`);
    await dl.saveAs(files[f]);
    fs.copyFileSync(files[f], path.join(SHOTS, `r9-share-${f.toLowerCase()}-${label}${VIEWSUFFIX}.png`));
  }
  const drawn = await drawnText(page);
  note("share images", drawn);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return { found: [...found.keys()], drawn, files };
}

step("Halal mode: no vibe scale, a Trip highlights card, nothing about nightlife anywhere");
await hal.ctx.addInitScript(recordCanvas);
const hp = hal.page;
const rowBefore = JSON.stringify(await hal.api.get(base + "/api/itinerary").then((x) => x.json()));
const fileRow = () => {
  const dbj = JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  return JSON.stringify(dbj.itineraries.find((x) => x.participant_id === hal.id));
};
const fileBefore = fileRow();
await hp.goto(base + "/trip?step=review");
await hp.waitForTimeout(1800);
await expect(hp.getByText("Pub Golf: tee off at Bellagio").first().isVisible(), "normal mode: the nightlife picks show");
await expect(hp.getByText("Nightlife", { exact: true }).first().isVisible(), "normal mode: the Nature ↔ Nightlife meter");
await hp.getByRole("switch", { name: "Halal mode" }).click();
await hp.waitForTimeout(900);
await expect(hp.getByText("Halal mode: preview only, your real plan is untouched.").isVisible(), "the banner");
await expect(hp.getByLabel("Trip highlights").isVisible(), "a Trip highlights card in the meter's place");
const tiles = await hp.getByLabel("Trip highlights").getByRole("listitem").allInnerTexts();
console.log("    highlights:", tiles.map((t) => t.replace(/\s+/g, " ")).join(" · "));
await expect(tiles.length >= 3, "…with at least three highlights");
await expect(hp.getByText(/^(Nature|Nightlife|Halal ↔ Haram|Haram)$/).filter({ visible: true }).count().then((c) => c === 0), "no Nature ↔ Nightlife or Halal ↔ Haram scale");
await expect(hp.getByRole("switch", { name: "Halal mode" }).isVisible(), "the switch stays (to turn it off)");
await expect(hp.getByText("Ahangama: yoga, cafés & a beach afternoon").first().isVisible(), "Halal wording for picks that mention bars");
await expect(hp.getByText("Pub after the beach!").count().then((c) => c === 0), "their own day notes are left out");
await hp.getByLabel("Trip highlights").scrollIntoViewIfNeeded();
await shot(hp, "halal-highlights", { keep: true });
await shot(hp, "halal-review-full", { full: true, keep: true });
const sweep = await halalSweep(hp, "halal", { budgetSheet: true, shotDetail: true });
console.log("    banned words found:", sweep.found.length ? sweep.found.join("; ") : "none");
await expect(sweep.found.length === 0, "banned-word sweep: review, every detail sheet, the budget and both exports are clean");
await expect(/TRIP HIGHLIGHTS/.test(sweep.drawn) && !/YOUR VIBE|NATURE|Halal/i.test(sweep.drawn), "exports: highlights instead of the vibe meter, and no sign of Halal mode");
await expect(JSON.stringify(pngSize(sweep.files.Story)) === "[1080,1920]" && JSON.stringify(pngSize(sweep.files.Square)) === "[1080,1080]", "both exports at full size");
await expect(JSON.stringify(await hal.api.get(base + "/api/itinerary").then((x) => x.json())) === rowBefore, "saved plan unchanged (API)");
await expect(fileRow() === fileBefore, "saved plan byte-identical (stored row)");

step("Halal mode on desktop: poster copy, side budget, exports");
{
  const ctxD = await browser.newContext(desktop);
  await ctxD.addCookies(await hal.ctx.cookies());
  await ctxD.addInitScript(recordCanvas);
  const pd = await ctxD.newPage();
  pd.on("pageerror", (e) => errors.push(`pageerror(desktop hal): ${e.message}`));
  await pd.goto(base + "/trip?step=review");
  await pd.waitForTimeout(1800);
  await expect(pd.getByText("beach parties").isVisible(), "desktop poster: normal copy before");
  await pd.getByRole("switch", { name: "Halal mode" }).click();
  await pd.waitForTimeout(900);
  await expect(pd.getByText("golden sunsets").isVisible() && !(await pd.getByText("beach parties").isVisible()), "desktop poster: Halal-safe copy");
  await shot(pd, "desktop-halal", { keep: true });
  const d = await halalSweep(pd, "halal-desktop");
  console.log("    desktop banned words found:", d.found.length ? d.found.join("; ") : "none");
  await expect(d.found.length === 0, "desktop sweep (incl. the budget side panel) is clean");
  await ctxD.close();
}
await expect(fileRow() === fileBefore, "still byte-identical after the desktop run");

step("Halal mode off again: everything back");
await hp.getByRole("button", { name: "Turn Halal mode off" }).click();
await hp.waitForTimeout(700);
await expect(hp.getByText("Nightlife", { exact: true }).first().isVisible(), "the meter is back");
await expect(hp.getByText("Pub after the beach!").isVisible(), "…and their notes");

step("Desktop: popular catalog, console roommates, peek");
{
  const ctxD = await browser.newContext(desktop);
  await ctxD.addCookies(await pia.ctx.cookies());
  const pd = await ctxD.newPage();
  await pd.goto(base + "/trip?step=build");
  await pd.waitForTimeout(1500);
  await row(pd, 2).getByRole("button", { name: "Pick your daytime" }).click();
  await pd.waitForTimeout(900);
  await shot(pd, "desktop-popular-matchup", { keep: true });
  await ctxD.close();
  await ownPage.goto(base + "/admin#roommates");
  await ownPage.waitForTimeout(1200);
  await shot(ownPage, "desktop-console-roommates", { keep: true });
  const ctxE = await browser.newContext(desktop);
  await ctxE.addCookies(await eve.ctx.cookies());
  const pe = await ctxE.newPage();
  await pe.goto(`${base}/group/peek/${dee.id}`);
  await pe.waitForTimeout(1800);
  await shot(pe, "desktop-peek", { keep: true });
  await ctxE.close();
}

// ═══ Cleanup ════════════════════════════════════════════════════════════
step("Cleanup: test users (local store only; never Abdul or Aadil)");
await ownApi.post(base + "/api/admin/rules", { data: { patch: { popularBadges: true } } });
const PROTECTED = /^(abdul|aadil)$/i;
const everyone = await ownApi.get(base + "/api/people").then((r) => r.json());
for (const p of everyone.filter((x) => Object.values(N).includes(x.name) && !PROTECTED.test(x.name))) {
  const r = await ownApi.delete(`${base}/api/admin/participants/${p.id}`);
  await expect(r.ok(), `deleted ${p.name}`);
}
await ownApi.post(base + "/api/admin/logout");

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n- ${errors.join("\n- ")}` : "\nAll checks passed ✓");
process.exit(errors.length ? 1 : 0);
