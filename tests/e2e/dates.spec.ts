import { expect, test, type Page } from "@playwright/test";
import { pickRange, startTrip, watchErrors } from "./helpers";
import { editTrip } from "./store";

const lengthLabel = (page: Page) => page.getByTestId("trip-length");

async function openConsole(page: Page, trip: string, tab: string) {
  await page.goto(`${trip}/admin`);
  const pin = page.locator("#console-pin");
  if (await pin.isVisible().catch(() => false)) {
    await pin.fill("4826");
    await page.getByRole("button", { name: /Open the console/ }).click().catch(() => undefined);
  }
  await page.getByRole("button", { name: tab, exact: true }).click();
}

test("free dates: a day trip, a short trip without Galle, two weeks, and picks that re-flow", async ({ page }) => {
  const done = watchErrors(page);
  const trip = await startTrip(page, "sri-lanka");
  await page.goto(`${trip}/trip`);
  await expect(page.getByText("Most groups do 5–7 days")).toBeVisible();

  // One day: land and fly home the same day.
  await pickRange(page, /^Sun 27 Dec/, /^Sun 27 Dec/);
  await expect(lengthLabel(page)).toHaveText("1 day · no nights");
  await expect(page.getByText(/Too short for Galle; this trip stays in Colombo/)).toBeVisible();
  await page.getByRole("button", { name: /Build days/ }).click();
  await expect(page.getByText(/fly home tonight/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: /Evening, day 1/ })).toHaveCount(0);

  // Three days: still too short for Galle.
  await page.goto(`${trip}/trip?step=dates`);
  await pickRange(page, /^Sun 27 Dec/, /^Tue 29 Dec/);
  await expect(lengthLabel(page)).toHaveText("3 days · 2 nights");
  await expect(page.getByText(/Too short for Galle/)).toBeVisible();

  // A week, quick-filled.
  await pickRange(page, /^Sun 27 Dec/, /^Sat 2 Jan/);
  await expect(lengthLabel(page)).toHaveText("7 days · 6 nights");
  await expect(page.getByText(/Too short for Galle/)).toHaveCount(0);
  await page.getByRole("button", { name: /Build days/ }).click();
  await page.getByRole("button", { name: /Quick fill/ }).click();
  await expect(page.getByText(/Filled!/)).toBeVisible();

  // Shorter dates clear what no longer fits, said once, with Undo.
  await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: /Dates/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "One day shorter" }).click();
  await expect(lengthLabel(page)).toHaveText("3 days · 2 nights");
  const note = page.getByRole("status", { name: "Your dates changed" });
  await expect(note).toContainText(/New dates, same plan/);
  await note.getByRole("button", { name: "Undo" }).click();
  await expect(lengthLabel(page)).toHaveText("7 days · 6 nights");

  // Two weeks is the longest.
  await pickRange(page, /^Sun 20 Dec/, /^Sat 2 Jan/);
  await expect(lengthLabel(page)).toHaveText("14 days · 13 nights");
  await expect(page.getByRole("button", { name: "One day longer" })).toBeDisabled();
  done();
});

test("the fixed trip length rule turns the calendar into a window, with a preview", async ({ page }) => {
  const done = watchErrors(page);
  const trip = await startTrip(page, "sri-lanka");
  await openConsole(page, trip, "Trip rules");
  await page.getByRole("switch", { name: "Fixed trip length" }).click();
  await expect(page.getByText(/New: 6 days · 5 nights/)).toBeVisible();
  await page.getByRole("button", { name: /Review & apply/ }).click();
  await expect(page.getByText("Trip rules updated")).toBeVisible();
  // The shorter preview is on by default for a fixed length.
  await expect(page.getByRole("switch", { name: "Preview available" })).toHaveAttribute("aria-checked", "true");

  await page.goto(`${trip}/trip`);
  await expect(page.getByText("The trip ✓")).toBeVisible();
  await page.getByRole("button", { name: /^Mon 28 Dec/ }).first().click();
  await expect(page.getByText(/Mon 28 Dec → Sat 2 Jan/)).toBeVisible();
  await page.getByRole("button", { name: /Preview/ }).click();
  await expect(page.getByText(/Previewing 5 days · 4 nights/).first()).toBeVisible();

  // And back to free dates.
  await openConsole(page, trip, "Trip rules");
  await page.getByRole("switch", { name: "Fixed trip length" }).click();
  await page.getByRole("button", { name: /Review & apply/ }).click();
  await expect(page.getByText(/Trip rules updated|Applied/)).toBeVisible();
  await page.goto(`${trip}/trip?step=dates`);
  await expect(page.getByText("Most groups do 5–7 days")).toBeVisible();
  done();
});

test("an old trip (rules from before free dates) keeps working, with its plan", async ({ page }) => {
  const done = watchErrors(page);
  const trip = await startTrip(page, "sri-lanka");
  await page.goto(`${trip}/trip`);
  await pickRange(page, /^Mon 28 Dec/, /^Sat 2 Jan/);
  await page.getByRole("button", { name: /Build days/ }).click();
  await page.getByRole("button", { name: /Quick fill/ }).click();
  await expect(page.getByText(/Filled!/)).toBeVisible();
  // Wait until the autosave has the picks on the server.
  await expect
    .poll(async () => {
      const row = await (await page.request.get(`/api/t/${trip.split("/").pop()}/itinerary`)).json();
      return row?.data?.days?.reduce((n: number, d: { day: unknown[]; night: unknown[] }) => n + d.day.length + d.night.length, 0) ?? 0;
    })
    .toBeGreaterThan(0);
  // Rules as the original app stored them: a fixed 6-day shape, no free-date fields at all.
  editTrip(trip.split("/").pop()!, (t) => {
    t.rules = { nights: { colombo: 1, galle: 4 }, requireFullTrip: true, previewEnabled: true, window: { start: "2026-12-01", end: "2027-01-31" }, browse: "after_submit" };
  });
  await page.goto(`${trip}/trip?step=dates`);
  await expect(lengthLabel(page)).toHaveText("6 days · 5 nights");
  await expect(page.getByText(/Mon 28 Dec → Sat 2 Jan/)).toBeVisible();
  await page.goto(`${trip}/trip?step=review`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Submit my trip/ }).first().click();
  await expect(page.getByText(/in with the crew/)).toBeVisible();
  done();
});

test("the group heatmap reads everyone's own dates", async ({ page }) => {
  const done = watchErrors(page);
  await page.goto("/demo/sri-lanka");
  await page.getByRole("button", { name: /Try it as a guest/ }).click();
  await page.waitForURL(/\/trip/);
  await page.goto("/t/demo-sri-lanka/group");
  await expect(page.getByText(/Sweet spot: 27 Dec – 2 Jan/)).toBeVisible();
  await expect(page.getByText(/free for all 7 days \(the typical trip length\)/)).toBeVisible();
  await expect(page.getByText(/plans run 5–11 days, typically 7/)).toBeVisible();
  done();
});
