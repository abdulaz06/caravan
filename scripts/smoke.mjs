// Quick smoke run + screenshots of the main trip flow at phone size.
// Usage: node scripts/smoke.mjs [outDir]   (server: npm run dev:local → http://localhost:3100)
//   env: BASE, VIEW (e.g. 375x667), NAME
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("smoke runs against a local server only");
const outDir = process.argv[2] ?? "screenshots/smoke";
fs.mkdirSync(outDir, { recursive: true });
const [vw, vh] = (process.env.VIEW ?? "390x844").split("x").map(Number);
const name = process.env.NAME ?? `Smoke ${Date.now().toString(36).slice(-4)}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
let n = 0;
const shot = async (label, full = false) => {
  await page.waitForTimeout(700);
  const file = path.join(outDir, `${String(++n).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log("📸", file);
};

// Caravan's front page, then start a trip (you become its owner).
await page.goto(base);
await shot("landing");
await page.goto(`${base}/new?preset=sri-lanka`);
await page.locator("#trip-name").fill(`Smoke trip ${Date.now().toString(36).slice(-4)}`);
await page.locator("#owner-name").fill(name);
await page.locator("#owner-pin").fill("4826");
await page.getByRole("button", { name: /Start the trip/ }).click();
const invite = (await page.getByTestId("invite-link").textContent()).trim();
const trip = new URL(invite).pathname; // /t/<slug>
await shot("trip-ready");
await page.getByRole("button", { name: /Build my version/ }).click();
await page.waitForURL("**/trip**");
await shot("dates-empty");
// Free dates: tap the first day, then the last.
await page.getByRole("button", { name: /^Mon 28 Dec/ }).first().click();
await page.waitForTimeout(400);
await shot("dates-first-day");
await page.getByRole("button", { name: /^Sat 2 Jan/ }).first().click();
await page.waitForTimeout(500);
await shot("dates-placed");
await page.getByRole("button", { name: /Build days/ }).click();
await page.waitForTimeout(800);
await shot("build-empty");
await page.getByRole("button", { name: /Quick fill/ }).click();
await page.waitForTimeout(800);
await shot("build-filled", true);
await page.goto(`${base}${trip}/trip?step=review`);
await page.waitForTimeout(1500);
await shot("review", true);

// A friend opens the invite link and joins.
const friendCtx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const friend = await friendCtx.newPage();
friend.on("pageerror", (e) => errors.push(`friend pageerror: ${e.message}`));
await friend.goto(`${base}${trip}`);
await friend.waitForTimeout(700);
await friend.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-invite-welcome.png`) });
await friend.goto(`${base}${trip}/join`);
await friend.getByLabel("What should we call you?").fill("Friend");
await friend.locator("#pin").fill("1357");
await friend.getByRole("button", { name: /Let's go/ }).click();
await friend.waitForURL("**/trip**");
await page.goto(`${base}${trip}/group`);
await shot("group", true);
console.log(errors.length ? `\n✗ ${errors.length} error(s):\n${errors.join("\n")}` : "\n✓ no page errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
