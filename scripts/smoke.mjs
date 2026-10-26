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

await page.goto(base);
await shot("welcome");
await page.goto(`${base}/join`);
await page.getByLabel("What should we call you?").fill(name);
await page.locator("#pin").fill("4826");
await page.getByRole("button", { name: /Let's go/ }).click();
await page.waitForURL("**/trip**");
await shot("dates-empty");
// Tap a date in the second visible month.
await page.getByRole("button", { name: /^Mon 28 Dec/ }).first().click();
await page.waitForTimeout(500);
await shot("dates-placed");
await page.getByRole("button", { name: /Build days/ }).click();
await page.waitForTimeout(800);
await shot("build-empty");
await page.getByRole("button", { name: /Quick fill/ }).click();
await page.waitForTimeout(800);
await shot("build-filled", true);
await page.goto(`${base}/trip?step=review`);
await page.waitForTimeout(1500);
await shot("review", true);
console.log(errors.length ? `\n✗ ${errors.length} error(s):\n${errors.join("\n")}` : "\n✓ no page errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
