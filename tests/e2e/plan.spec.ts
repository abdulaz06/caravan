import { expect, test, type Page } from "@playwright/test";
import { quickPlan, startTrip, watchErrors } from "./helpers";
import { bannedIn } from "../../src/engine/family-words";
import { seedCrew } from "./store";

async function openPlanTab(page: Page, trip: string) {
  await page.goto(`${trip}/admin#plan`);
  const pin = page.locator("#console-pin");
  if (await pin.isVisible().catch(() => false)) {
    await pin.fill("4826");
    await page.getByRole("button", { name: /Open the console/ }).click().catch(() => undefined);
  }
  await expect(page.getByRole("heading", { name: "The group plan" })).toBeVisible();
}

test("organizers make the group plan; travellers see it, RSVP and share it", async ({ page }) => {
  test.slow();
  const done = watchErrors(page);
  // The owner is "Maya", so the demo crew joins her trip with her as its owner.
  const trip = await startTrip(page, "sri-lanka", "Maya");
  await quickPlan(page, trip, /^Sun 27 Dec/, /^Sat 2 Jan/);
  // In-app, so the quick fill is saved (a reload could beat the autosave).
  await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: /Submit my trip/ }).first().click();
  await expect(page.getByText(/in with the crew/)).toBeVisible();
  seedCrew(trip.split("/").pop()!);

  // Choose how the group decides, then generate.
  await openPlanTab(page, trip);
  await expect(page.getByText("How should the group decide?")).toBeVisible();
  await page.getByRole("radio", { name: /^Everyone gets a say/ }).click();
  await page.getByRole("button", { name: "Generate the plan" }).click();
  await expect(page.getByText(/free for all of it/).first()).toBeVisible();
  await expect(page.getByText(/picked this/).first()).toBeVisible();

  // Compare modes side by side.
  await page.getByRole("button", { name: /Compare modes/ }).click();
  await expect(page.getByText("Same picks, same dates, same locks")).toBeVisible();

  // Lock the first pick; swap another for a ranked alternative.
  await page.getByRole("button", { name: /^Lock / }).first().click();
  await expect(page.getByRole("button", { name: /^Unlock / }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Swap / }).nth(2).click();
  await page.getByRole("dialog").getByRole("button").filter({ hasText: /picked it/ }).first().click();
  await expect(page.getByText("Locked by the organizers").nth(1)).toBeVisible();

  // Accept a split if the group has one.
  const split = page.getByRole("button", { name: "Split up" }).first();
  if (await split.isVisible().catch(() => false)) {
    await split.click();
    await expect(page.getByText("Splitting up for this one").first()).toBeVisible();
  }

  // Regenerate: the locks stay.
  await page.getByRole("button", { name: /Regenerate/ }).click();
  await expect(page.getByText("Locked by the organizers")).toHaveCount(2);

  // Publish.
  await page.getByRole("button", { name: /^Publish$/ }).first().click();
  await expect(page.getByText(/is the plan everyone sees/)).toBeVisible();

  // The traveller side: the plan, how it was decided, their own picks, RSVPs.
  await page.goto(`${trip}/trip`);
  await expect(page.getByText(/The plan is here/)).toBeVisible();
  await page.goto(`${trip}/plan`);
  await expect(page.getByText(/Planned with: Everyone gets a say/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Your picks" })).toContainText(/of your picks are in|every one/);
  const answer = page.getByRole("group", { name: /Your answer for/ }).first();
  const count = answer.getByLabel("Headcount");
  const before = Number((await count.textContent())!.match(/(\d+) in/)![1]);
  await answer.getByRole("button", { name: "I'm in" }).click();
  await expect(count).toHaveText(new RegExp(`^${before + 1} in`));
  // Organizers see names on the headcounts.
  await expect(page.getByText(/In: .*Maya/).first()).toBeVisible();

  // Share images and the print view.
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("img", { name: /Story image/ })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await page.goto(`${trip}/plan/print`);
  await expect(page.getByRole("heading", { name: /Sri Lanka, together/ })).toBeVisible();
  await expect(page.getByText(/Budget estimate/)).toBeVisible();

  // Family-friendly view of the plan.
  await page.goto(`${trip}/plan`);
  await page.getByRole("switch", { name: "Family-friendly mode" }).click();
  await expect(page.getByText(/a view only/)).toBeVisible();
  expect(bannedIn(await page.locator("main").innerText())).toEqual([]);
  done();
});

test("the demo console makes plans as a preview — nothing is saved", async ({ page, request }) => {
  const done = watchErrors(page);
  await page.goto("/demo/georgia");
  await page.goto("/t/demo-georgia/admin#plan");
  await expect(page.getByText(/nothing here is saved or published/)).toBeVisible();
  await page.getByRole("radio", { name: /^Majority rules/ }).click();
  await page.getByRole("button", { name: "Generate the plan" }).click();
  await expect(page.getByText(/free for all of it/).first()).toBeVisible();
  await expect(page.getByText("Saving and publishing are switched off in the demo.")).toBeVisible();
  // The published plan is still the crew's version 1, and a reload asks again.
  await page.reload();
  await expect(page.getByText("How should the group decide?")).toBeVisible();
  const r = await request.post("/api/t/demo-georgia/admin/plan", { data: { action: "save", settings: { mode: "majority" } } });
  expect(r.status()).toBe(403);
  const state = await (await request.get("/api/t/demo-georgia/admin/plan")).json();
  expect(state.versions).toHaveLength(1);
  done();
});
