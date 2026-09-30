import { expect, test } from "@playwright/test";

import { randomPhone } from "./helpers";

// Screenshots for a visual check land in test-results/ (not committed).
const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

test("gift page: piece or card, curated rows and filters @phone", async ({ page }, info) => {
  await page.goto("/gift");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Gift it/i);
  // The card tile tells the truth: from Rs 1,000, by email and SMS.
  await expect(page.getByRole("link", { name: /Send a gift card/i })).toContainText(/From Rs 1,000/);
  await expect(page.getByRole("heading", { name: /No size to guess/i })).toBeVisible();
  await page.screenshot(shot(`gift-${info.project.name}`));

  await page.getByRole("link", { name: "Under Rs 1,500" }).click();
  await expect(page).toHaveURL(/max=1500/);
  await expect(page.getByRole("link", { name: "Under Rs 1,500" })).toHaveAttribute("aria-current", "page");
});

test("send a piece: three steps, their name before the note, checks before payment @phone", async ({ page }, info) => {
  await page.goto("/gift/everyday-hoodie");
  await expect(page.getByRole("heading", { name: "The piece" })).toBeVisible();
  // On a cold dev server the first click can land before the form is interactive: retry it.
  await expect(async () => {
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 2: the name is asked here, so the card preview can name them.
    await expect(page.getByRole("heading", { name: "Your note" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#g-hint")).toContainText(/Add their name/);
  await expect(page.locator("#g-rname")).toBeFocused();
  await page.locator("#g-rname").fill("Sita Rai");
  await expect(page.getByRole("figure", { name: /Preview of the gift card/ })).toContainText("For Sita Rai");
  // The price shows unless they tick the box, which sits next to the preview.
  await expect(page.getByRole("figure", { name: /Preview of the gift card/ })).toContainText(/gift receipt shows Rs/);
  await page.getByText("Hide the price from them").click();
  await expect(page.getByRole("figure", { name: /Preview of the gift card/ })).toContainText(/no price inside/);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: an email typo is caught, and the buyer's phone is checked before eSewa.
  await expect(page.getByRole("heading", { name: "Send and pay" })).toBeVisible();
  await page.locator("#g-remail").fill("sita@gmial.com");
  await page.getByRole("button", { name: "sita@gmail.com" }).click();
  await expect(page.locator("#g-remail")).toHaveValue("sita@gmail.com");
  await page.locator("#g-bphone").fill("123");
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  await expect(page.locator("#g-hint")).toContainText(/Add your own mobile number/);
  await expect(page.locator("#g-bphone")).toBeFocused();
  await page.screenshot(shot(`gift-send-${info.project.name}`));

  await page.locator("#g-bphone").fill(randomPhone());
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  // Reaching payment is enough: eSewa's sandbox page can be slow to finish loading.
  await page.waitForURL(/esewa|\/pay\/|\/order\//, { timeout: 30_000, waitUntil: "commit" });
});

test("gift card: amount shown large, checks on leaving a field @phone", async ({ page }, info) => {
  await page.goto("/gift-cards");
  await page.getByRole("radio", { name: "Rs 5,000" }).click();
  await expect(page.getByRole("button", { name: /Pay Rs 5,000|Buy gift card · Rs 5,000/ }).first()).toBeVisible();
  await page.locator("#gc-remail").fill("not-an-email");
  await page.locator("#gc-rphone").click();
  await expect(page.locator("#gc-remail-hint")).toContainText(/Check the email/);
  await page.screenshot(shot(`gift-cards-${info.project.name}`));
});
