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

test("home: the rail filters in place, and Designer Fits @phone", async ({ page }) => {
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
  await expect(rail.getByRole("status")).toContainText(/size XL/);
  // The shop opens with the same filter; Clear puts the rail back.
  await expect(rail.getByRole("link", { name: "See these in the shop" })).toHaveAttribute("href", "/shop?size=XL");
  await rail.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(rail.getByRole("button", { name: "XL", exact: true })).toHaveAttribute("aria-pressed", "false");
  // A tab narrows it to one kind of piece.
  const tab = rail.getByRole("group", { name: "Show" }).getByRole("button").nth(1);
  await tab.click();
  await expect(tab).toHaveAttribute("aria-pressed", "true");
  await expect(rail.locator("#rail-grid > li:not([hidden])").first()).toBeVisible();

  const fits = page.getByRole("region", { name: "Designer Fits" });
  await fits.scrollIntoViewIfNeeded();
  // An occasion, then one of the fits inside it.
  const occasions = fits.getByRole("radiogroup").first().getByRole("radio");
  await occasions.nth(1).click();
  await expect(occasions.nth(1)).toHaveAttribute("aria-checked", "true");
  const inside = fits.getByRole("radiogroup", { name: /fits$/ }).getByRole("radio");
  if ((await inside.count()) > 1) {
    await inside.nth(1).click();
    await expect(inside.nth(1)).toHaveAttribute("aria-checked", "true");
  }
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

test("guests can use the bag; the phone code is asked for only at checkout", async ({ page }) => {
  await page.goto("/product/everyday-hoodie");
  await pickInStockSize(page);
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page).toHaveURL(/\/product\/everyday-hoodie/); // no login wall
  await expect(page.getByText(/Everyday Hoodie.*added to bag/)).toBeAttached(); // the page confirms it, where they are

  await page.goto("/bag");
  await expect(page.getByText("Everyday Hoodie").first()).toBeVisible();
  await expect(page.getByText(/code at checkout/)).toBeVisible();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?reason=bag&next=(%2F|\/)checkout/);
  await expect(page.getByRole("heading", { name: "Confirm your number." })).toBeVisible();

  // Still there after the detour (and after a reload).
  await page.goto("/bag");
  await expect(page.getByText("Everyday Hoodie").first()).toBeVisible();
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
  await page.goto("/shop");
  // Shop · Fits · Gift · Bag · Account (docs/BLUEPRINT.md, section 05).
  const tabs = page.getByRole("navigation", { name: "Quick links" });
  await expect(tabs.getByRole("link")).toHaveText(["Shop", "Fits", "Gift", /Bag/, "Account"]);
  await expect(tabs.getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Fits" }).click();
  await page.waitForURL(/\/fits$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Designer Fits" })).toBeVisible();

  await expect(async () => {
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
  }).toPass();
  const menu = page.getByRole("dialog");
  for (const group of ["Shop", "Fits", "Gift", "The Vault", "Visit"]) await expect(menu.getByText(group, { exact: true }).first()).toBeVisible();
  await menu.getByRole("link", { name: "Track an order" }).click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("drop alerts: sign up by email, then stop with the link @phone", async ({ page }) => {
  await page.goto("/alerts");
  const email = `e2e-${Date.now()}@example.com`;
  await expect(async () => {
    await page.getByRole("radio", { name: "Email" }).click();
    await expect(page.getByLabel("Email address")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const main = page.locator("#main"); // the footer has its own one-line sign-up
  await page.getByLabel("Email address").fill(email);
  await main.getByRole("button", { name: "Notify me" }).click();
  await expect(page.getByText("Tick the box so we're allowed to message you.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(email); // a mistake keeps what was typed
  await main.getByRole("checkbox").check();
  await main.getByRole("button", { name: "Notify me" }).click();
  await expect(page.getByText(/You're in\. One email to e•••@example\.com on drop day/)).toBeVisible();

  // A stop link that matches nothing says so and changes nothing.
  await page.goto("/alerts/stop?t=not-a-real-link");
  await page.getByRole("button", { name: "Stop the messages" }).click();
  await expect(page.getByText(/doesn't match a sign-up/)).toBeVisible();
});

test("drop pages: the run, what's left, and the drops list @phone", async ({ page, request }) => {
  await page.goto("/drops");
  await expect(page.getByRole("heading", { name: "Out now" })).toBeVisible();
  await page.getByRole("link", { name: /Drop 01/ }).first().click();
  await expect(page).toHaveURL(/\/drop\/01$/);
  await expect(page.getByRole("heading", { level: 1, name: "Drop 01" })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ left/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Share this drop" })).toBeVisible();

  const story = await request.get("/drop/01/story");
  expect(story.status()).toBe(200);
  expect(story.headers()["content-type"]).toContain("image/png");
});

test("the heart saves a piece (it never adds to the bag or asks for a login)", async ({ page }) => {
  await page.goto("/shop");
  const heart = page.getByRole("button", { name: "Save Everyday Hoodie" });
  await expect(async () => {
    await heart.scrollIntoViewIfNeeded();
    await heart.hover();
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true", { timeout: 1500 });
  }).toPass();
  await expect(page).toHaveURL(/\/shop$/); // not sent to log in
  await page.goto("/saved");
  await expect(page.getByRole("link", { name: /Everyday Hoodie/ }).first()).toBeVisible();
});

test("Buy now remembers a guest's number on this phone, and forgets it when asked", async ({ page }) => {
  const phone = randomPhone();
  await page.goto("/product/everyday-hoodie");
  await pickInStockSize(page);
  await page.getByRole("link", { name: /Buy now/ }).first().click();
  await expect(page).toHaveURL(/\/buy\/everyday-hoodie/);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  await page.waitForURL(/esewa|\/order\//, { timeout: 30_000, waitUntil: "commit" });

  await page.goto("/product/everyday-hoodie");
  await pickInStockSize(page);
  await page.getByRole("link", { name: /Buy now/ }).first().click();
  await expect(page.getByLabel("Mobile number")).toHaveValue(phone);
  await page.getByRole("button", { name: "Forget my details" }).click();
  await expect(page.getByRole("button", { name: "Forget my details" })).toHaveCount(0);
});

test("footer: one-line drop alert sign-up takes an email or a WhatsApp number", async ({ page }) => {
  await page.goto("/track");
  const footer = page.getByRole("contentinfo");
  await expect(async () => {
    await footer.getByLabel("Drop alerts").fill("not-a-number");
    await footer.getByRole("button", { name: "Notify me" }).click();
    await expect(footer.getByRole("alert")).toContainText(/10-digit/, { timeout: 2000 });
  }).toPass();
  await footer.getByLabel("Drop alerts").fill(`foot-${Date.now()}@example.com`);
  await footer.getByRole("button", { name: "Notify me" }).click();
  await expect(footer.getByText(/You're in\. One email to f•••@example\.com/)).toBeVisible();
});
