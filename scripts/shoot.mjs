// Dev helper: screenshot pages at phone (and optionally desktop) size.
// Usage: node scripts/shoot.mjs <outDir> <path> [path...]   (env: BASE, DESKTOP=1, FULL=1)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext(
  process.env.DESKTOP
    ? { viewport: { width: 1440, height: 900 } }
    : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
);
const page = await ctx.newPage();
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (process.env.FULL) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
  }
  const name = (p.replace(/[^a-z0-9]+/gi, "_") || "home").replace(/^_|_$/g, "") || "home";
  const file = path.join(outDir, `${name}${process.env.DESKTOP ? "-desktop" : ""}.png`);
  await page.screenshot({ path: file, fullPage: !!process.env.FULL });
  console.log(file);
}
await browser.close();
