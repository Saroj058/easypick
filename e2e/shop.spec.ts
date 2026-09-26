import { expect, test, type Page } from "@playwright/test";

import { randomPhone } from "./helpers";

test("home, shop and a product page load @phone", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Easypick/);
  await page.goto("/shop");
  await page.locator('a[href="/product/everyday-hoodie"]').first().click();
  await page.waitForURL(/\/product\/everyday-hoodie/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Free pickup at the store/)).toBeVisible();
});

test("Buy now needs no account and goes to payment", async ({ page }) => {
  await page.goto("/product/everyday-hoodie");
  await pickInStockSize(page);
  await page.getByRole("link", { name: /Buy now/ }).first().click();
  await expect(page).toHaveURL(/\/buy\/everyday-hoodie/);
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  await expect(page.locator("#co-error")).toContainText(/10-digit/);
  await expect(page.locator("#phone")).toBeFocused();
  await page.getByLabel("Mobile number").fill(randomPhone());
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  // eSewa's sandbox form, or our order page when the sandbox can't be reached from here.
  await page.waitForURL(/esewa|\/order\//, { timeout: 30_000 });
});

test("Add to bag asks for a login and offers Buy now instead", async ({ page }) => {
  await page.goto("/product/everyday-hoodie");
  await pickInStockSize(page);
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page).toHaveURL(/\/login\?reason=bag/);
  await page.getByRole("link", { name: /now, no account/ }).click();
  await expect(page).toHaveURL(/\/buy\/everyday-hoodie\?sku=/);
});

test("track an order page rejects wrong details", async ({ page }) => {
  await page.goto("/track");
  await page.getByLabel(/Order number/i).fill("EP-9999999");
  await page.getByLabel("Mobile number").fill(randomPhone());
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.locator("#main").getByRole("alert")).toContainText(/\w/);
});

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

/** Waits for the live stock check (earlier runs' orders use up stock), then picks a size that's really available. */
async function pickInStockSize(page: Page) {
  await expect(page.getByText("Checking stock…")).toHaveCount(0, { timeout: 20_000 });
  await page.locator('label:has(input[name="size"]:not([disabled]))').first().click();
}
