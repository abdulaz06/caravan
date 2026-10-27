import { expect, type Page } from "@playwright/test";

/** Collects uncaught page errors and console errors; call the result to assert there were none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return () => expect(errors, errors.join("\n")).toEqual([]);
}

export const uid = () => Math.random().toString(36).slice(2, 6);

/** Start a trip from /new and return its path (/t/<slug>). */
export async function startTrip(page: Page, preset: "sri-lanka" | "georgia", owner = "Sam") {
  await page.goto(`/new?preset=${preset}`);
  await page.locator("#trip-name").fill(`E2E ${preset} ${uid()}`);
  await page.locator("#owner-name").fill(owner);
  await page.locator("#owner-pin").fill("4826");
  await page.getByRole("button", { name: /Start the trip/ }).click();
  const link = (await page.getByTestId("invite-link").textContent())!.trim();
  return new URL(link).pathname;
}

/** Place the date window and quick-fill every day. */
export async function quickPlan(page: Page, trip: string, day: RegExp) {
  await page.goto(`${trip}/trip`);
  await page.getByRole("button", { name: day }).first().click();
  await page.getByRole("button", { name: /Build days/ }).click();
  await page.getByRole("button", { name: /Quick fill/ }).click();
  await expect(page.getByText(/Filled!/)).toBeVisible();
}
