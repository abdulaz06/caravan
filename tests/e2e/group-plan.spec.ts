import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { watchErrors } from "./helpers";
import { editTrip, storeFileFor } from "./store";

/** A preset's main meals (the "meal" tag). */
const meals = (id: string) =>
  new Set((JSON.parse(fs.readFileSync(`presets/${id}/preset.json`, "utf8")).activities as { id: string; tags: string[] }[]).filter((a) => a.tags.includes("meal")).map((a) => a.id));

async function generateOnDemo(page: Page, id: string, mode: RegExp) {
  await page.goto(`/demo/${id}`);
  await page.goto(`/t/demo-${id}/admin#plan`);
  await page.getByRole("radio", { name: mode }).click();
  await page.getByRole("button", { name: "Generate the plan" }).click();
  await expect(page.getByText(/free for all of it/).first()).toBeVisible();
}

test("on the demo, Everyone gets a say lifts the lowest share and differs from Majority rules", async ({ page }) => {
  const done = watchErrors(page);
  await generateOnDemo(page, "sri-lanka", /^Everyone gets a say/);
  await expect(page.getByText(/Versus Majority rules, the lowest share went from/)).toBeVisible();
  await expect(page.getByText(/^For /).first()).toBeVisible(); // who a pick was added to lift
  await page.getByRole("button", { name: /Compare modes/ }).click();
  const majority = page.getByRole("button", { name: /^Majority rules\s*Lowest/ });
  await expect(majority).toContainText(/slots differ/);
  await expect(page.getByText(/Every mode makes the same plan here/)).toHaveCount(0);
  // The labels are uppercase on screen (innerText follows the CSS).
  const lowest = async (name: RegExp) => Number((await page.getByRole("button", { name }).innerText()).match(/Lowest\s*(\d+)%/i)![1]);
  expect(await lowest(/^Everyone gets a say\s*Lowest/)).toBeGreaterThan(await lowest(/^Majority rules\s*Lowest/));
  done();
});

test("organizers see the length trade-off, use another length, and go back to auto", async ({ page }) => {
  const done = watchErrors(page);
  await generateOnDemo(page, "sri-lanka", /^Majority rules/);
  const table = page.getByRole("list", { name: "Trip length trade-off" });
  await expect(table).toContainText(/can do it all/);
  await expect(table).toContainText(/best balance/);
  await table.getByRole("button", { name: "Use 6 days" }).click();
  await expect(page.getByText(/Chosen by the organizers/)).toBeVisible();
  await expect(table.getByText("Chosen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Back to auto/ }).click();
  await expect(page.getByText(/The best balance of days and full attendance/)).toBeVisible();
  // Any window can be pinned too.
  await expect(page.getByLabel(/Or pin any \d+-day window from/)).toBeVisible();
  done();
});

test("the split threshold is an organizer knob", async ({ page }) => {
  const done = watchErrors(page);
  await generateOnDemo(page, "georgia", /^Everyone gets a say/);
  await expect(page.getByText("Split suggestion").first()).toBeVisible();
  await page.getByRole("button", { name: /Knobs/ }).click();
  await expect(page.getByRole("slider", { name: "Popularity it may give up" })).toBeVisible();
  await page.getByRole("slider", { name: "Split threshold" }).fill("0.75");
  await expect(page.getByText(/at least 75% of the people there/)).toBeVisible();
  await page.getByRole("button", { name: /Regenerate with these/ }).click();
  await expect(page.getByText("Split suggestion")).toHaveCount(0);
  done();
});

test("no slot in any demo plan has two main meals, in any mode", async ({ request }) => {
  for (const id of ["sri-lanka", "georgia"]) {
    await request.get(`/demo/${id}`);
    const meal = meals(id);
    expect(meal.size).toBeGreaterThan(5);
    for (const mode of ["together", "majority", "custom"]) {
      const r = await request.post(`/api/t/demo-${id}/admin/plan`, { data: { action: "generate", settings: { mode } } });
      expect(r.status()).toBe(200);
      const { plan } = (await r.json()) as { plan: { slots: { key: string; items: { id: string }[] }[] } };
      for (const s of plan.slots) expect(s.items.filter((i) => meal.has(i.id)).length, `${id} · ${mode} · ${s.key}`).toBeLessThanOrEqual(1);
    }
  }
});

test("the demo loads straight away when its seed is stale, and rebuilds behind the scenes", async ({ page, request }) => {
  const done = watchErrors(page);
  await request.get("/demo/sri-lanka");
  const seed = () => {
    try {
      const trips = JSON.parse(fs.readFileSync(storeFileFor("demo-sri-lanka"), "utf8")).trips as { slug: string; rules: { demoSeed?: number } }[];
      return trips.find((t) => t.slug === "demo-sri-lanka")?.rules.demoSeed ?? 0;
    } catch {
      return -1; // caught the file mid-write: look again
    }
  };
  const current = seed();
  // As if a new deploy had bumped the seed: this demo is now out of date.
  editTrip("demo-sri-lanka", (t) => {
    t.rules = { demoSeed: 1 };
  });
  const t0 = Date.now();
  const r = await request.get("/demo/sri-lanka", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers().location).toMatch(/\/t\/demo-sri-lanka$/);
  expect(Date.now() - t0).toBeLessThan(2500);
  await page.goto("/t/demo-sri-lanka");
  await expect(page.getByText(/friends have joined/)).toBeVisible();
  // The fresh copy takes its place under the same slug.
  await expect.poll(seed, { timeout: 60_000 }).toBe(current);
  await page.reload();
  await expect(page.getByText(/friends have joined/)).toBeVisible();
  done();
});
