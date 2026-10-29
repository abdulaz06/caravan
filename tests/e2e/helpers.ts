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

/**
 * Open the organizer console on a tab (by its hash, e.g. "rules" or "plan"),
 * confirming the PIN if asked. The 4th digit submits by itself — clicking the
 * button too races it (the button becomes "Checking…", then goes away).
 */
export async function openConsole(page: Page, trip: string, tab: string, pinCode = "4826") {
  await page.goto(`${trip}/admin#${tab}`);
  const pin = page.locator("#console-pin");
  const console_ = page.getByRole("heading", { name: /Organizer console/ });
  await expect(pin.or(console_)).toBeVisible();
  if (await pin.isVisible()) await pin.fill(pinCode);
  await expect(console_).toBeVisible();
}

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

/** Tap the first and last day on the calendar (free dates). */
export async function pickRange(page: Page, first: RegExp, last: RegExp) {
  await page.getByRole("button", { name: first }).first().click();
  await expect(page.getByText(/Now tap the day you fly home/)).toBeVisible();
  await page.getByRole("button", { name: last }).first().click();
}

/** Pick dates (a fixed window: one tap) and quick-fill every day. */
export async function quickPlan(page: Page, trip: string, day: RegExp, lastDay?: RegExp) {
  await page.goto(`${trip}/trip`);
  if (lastDay) await pickRange(page, day, lastDay);
  else await page.getByRole("button", { name: day }).first().click();
  await page.getByRole("button", { name: /Build days/ }).click();
  await page.getByRole("button", { name: /Quick fill/ }).click();
  await expect(page.getByText(/Filled!/)).toBeVisible();
}
