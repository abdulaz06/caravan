import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("landing page links to everything", async ({ page }) => {
  const done = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Plan the trip/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start a trip/ }).first()).toHaveAttribute("href", "/new");
  await expect(page.getByRole("link", { name: /Try a demo trip/ })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: "Watch the story", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read the case study/ }).first()).toHaveAttribute("href", "/case-study");
  done();
});

test("case study tells the story", async ({ page }) => {
  const done = watchErrors(page);
  await page.goto("/case-study");
  await expect(page.getByRole("heading", { name: /without the group chat/ })).toBeVisible();
  await expect(page.getByText("friends joined")).toBeVisible();
  await expect(page.getByRole("img", { name: /Architecture/ })).toBeVisible();
  await expect(page.getByText("NYE beach party on the south coast")).toBeVisible();
  await expect(page.getByRole("button", { name: /Play: Watch the 1-minute demo/ })).toBeVisible();
  // Shared links show the case study's own preview, not the site's.
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toContain("/case-study/opengraph-image");
  done();
});

test("past trip and its story", async ({ page }) => {
  const done = watchErrors(page);
  await page.goto("/past/georgia-2025");
  await expect(page.getByRole("heading", { name: "Georgia, in the snow" })).toBeVisible();
  await expect(page.getByText(/25 Dec 2025 – 2 Jan 2026/).first()).toBeVisible();
  await page.getByRole("link", { name: /Watch the trip/ }).click();
  await page.waitForURL(/\/story$/);
  const first = page.getByRole("region", { name: /slide 1 of 15/ });
  await expect(first).toBeVisible();
  await first.click({ position: { x: 250, y: 400 } });
  await expect(page.getByRole("region", { name: /slide 2 of 15/ })).toBeVisible();
  await expect(page.getByText("Arrival night")).toBeVisible();
  for (let i = 0; i < 14; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Japan?")).toBeVisible();
  await expect(page.getByRole("link", { name: /Plan the next one/ })).toBeVisible();
  done();
});
