import { expect, test } from "@playwright/test";
import { quickPlan, startTrip, uid, watchErrors } from "./helpers";

test("start a trip, plan it, submit, and a friend joins by invite", async ({ page, browser }) => {
  const done = watchErrors(page);
  const trip = await startTrip(page, "sri-lanka");
  await expect(page.getByText(/is live/)).toBeVisible();

  await quickPlan(page, trip, /^Mon 28 Dec/);
  await page.goto(`${trip}/trip?step=review`);
  await page.getByRole("button", { name: /Submit my trip/ }).first().click();
  await expect(page.getByText(/in with the crew/)).toBeVisible();

  // A friend opens the invite link in their own browser.
  const friendCtx = await browser.newContext();
  const friend = await friendCtx.newPage();
  await friend.goto(trip);
  await expect(friend.getByRole("link", { name: /Join the trip/ })).toBeVisible();
  await friend.goto(`${trip}/join`);
  await friend.getByLabel("What should we call you?").fill(`Friend ${uid()}`);
  await friend.locator("#pin").fill("1357");
  await friend.getByRole("button", { name: /Let.s go/ }).click();
  await friend.waitForURL(/\/trip/);
  await friend.goto(`${trip}/group`);
  await expect(friend.getByText(/friends have submitted/)).toBeVisible();
  await friendCtx.close();
  done();
});

test("a Georgia trip is nine days in its own theme", async ({ page }) => {
  const done = watchErrors(page);
  const trip = await startTrip(page, "georgia", "Ana");
  await quickPlan(page, trip, /^Fri 25 Dec/);
  await page.goto(`${trip}/trip?step=review`);
  await expect(page.getByText(/Ana.s/).first()).toBeVisible();
  await expect(page.getByText(/9 days · 8 nights/).first()).toBeAttached();
  // The preset's theme is in force: Georgia's primary colour, not Caravan's default.
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary-900").trim());
  expect(primary.toLowerCase()).toBe("#0f2236");
  done();
});

test("a broken invite link gets a friendly 404", async ({ page }) => {
  await page.goto("/t/not-a-real-trip");
  await expect(page.getByText(/goes nowhere/)).toBeVisible();
});
