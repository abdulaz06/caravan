import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("pick a demo, plan as a guest, and the console is read-only", async ({ page, browser, request }) => {
  const done = watchErrors(page);
  await page.goto("/demo");
  await expect(page.getByRole("link", { name: /Sri Lanka demo/ })).toBeVisible();
  await page.getByRole("link", { name: /Georgia demo/ }).click();
  await page.waitForURL(/\/t\/demo-georgia$/);
  await expect(page.getByText(/friends have joined/)).toBeVisible();

  await page.getByRole("button", { name: /Try it as a guest/ }).click();
  await page.waitForURL(/\/trip/);
  await expect(page.getByRole("heading", { name: /When are/ })).toBeVisible();

  // Anyone can look around the console, read-only.
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto("/t/demo-georgia/admin");
  await expect(visitor.getByText(/Demo console · read-only/)).toBeVisible();
  await ctx.close();
  expect((await request.post("/api/t/demo-georgia/admin/lock", { data: { locked: true } })).status()).toBe(403);
  expect((await request.get("/api/t/demo-georgia/admin/export?format=json")).status()).toBe(200);
  // No real accounts on the demo.
  expect((await request.post("/api/t/demo-georgia/auth/join", { data: { name: "Someone", pin: "1234" } })).status()).toBe(403);
  done();
});
