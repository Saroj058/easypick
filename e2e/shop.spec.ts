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

test("home: the rail, My size and Wear it to… @phone", async ({ page }) => {
  await page.goto("/");
  const rail = page.getByRole("region", { name: "The rail" });
  await expect(rail.locator("#rail-grid > li:not([hidden])").first()).toBeVisible();
  // My size keeps only pieces in stock in that size (one-size pieces stay).
  await expect(async () => {
    await rail.getByRole("button", { name: "XL", exact: true }).click();
    await expect(rail.getByRole("button", { name: "XL", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  const sizes = await rail.locator("#rail-grid > li:not([hidden])").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.sizes ?? ""));
  expect(sizes.every((s) => s.split(" ").some((x) => x === "XL" || x === "ONE"))).toBe(true);
  await rail.getByRole("button", { name: "XL", exact: true }).click();

  const fits = page.getByRole("region", { name: "Wear it to…" });
  await fits.scrollIntoViewIfNeeded();
  await fits.getByRole("radio", { name: /Casual/ }).click();
  await expect(fits.getByRole("radio", { name: /Casual/ })).toHaveAttribute("aria-checked", "true");
  await expect(fits.getByRole("button", { name: /Add the fit · Rs/ })).toBeEnabled();
  await fits.getByRole("link", { name: "Build your own fit" }).click();
  await page.waitForURL(/\/fit\?.*(top|bottom)=/, { timeout: 60_000 }); // the first visit compiles /fit in dev
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
  await page.waitForURL(/esewa|\/order\//, { timeout: 30_000, waitUntil: "commit" });
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

test("track an order from the home page @phone", async ({ page }) => {
  await page.goto("/");
  const track = page.getByRole("region", { name: "Track an order." });
  await track.scrollIntoViewIfNeeded();
  await track.getByLabel("Order number").fill("EP-9999999");
  await track.getByLabel("Mobile number").fill(randomPhone());
  await track.getByRole("button", { name: "Track order" }).click();
  await expect(track.getByRole("alert")).toContainText(/\w/);
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

test("phone menu and tab bar @phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Quick links" });
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(async () => {
    await tabs.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByText("Help me choose")).toBeVisible();
  await menu.getByRole("link", { name: "Track an order" }).click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
