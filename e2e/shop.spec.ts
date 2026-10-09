import { expect, test, type Page } from "@playwright/test";

import { randomPhone } from "./helpers";

test("home, shop and a product page load @phone", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Easypick/);
  await page.goto("/shop");
  await page.locator('a[href="/product/everyday-hoodie"]').first().click();
  await page.waitForURL(/\/product\/everyday-hoodie/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The price is on the hang tag, so the panel doesn't repeat it or the delivery lines.
  await expect(page.getByText(/No DM needed/)).toHaveCount(0);
  await expect(page.getByText(/Gift cards accepted/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save/ }).first()).toBeVisible();
});

test("home: the rail (cover-flow rows, size asked once, buy or bag, search), then Designer Fits @phone", async ({ page }) => {
  await page.goto("/");
  const rail = page.getByRole("region", { name: "The rail" });
  // Laid out in sections; each is a cover-flow with one piece at the centre and its details underneath.
  const first = rail.locator("section").first();
  const flow = first.getByRole("region", { name: "Tops" });
  await expect(flow.getByRole("group").first()).toBeVisible();
  const centre = first.getByRole("heading", { level: 4 });
  const before = await centre.innerText();
  await expect(async () => {
    await flow.getByRole("button", { name: "Next" }).click();
    await expect(centre).not.toHaveText(before, { timeout: 1500 });
  }).toPass();
  // Bring the hoodie to the centre.
  for (let i = 0; i < 12 && (await centre.innerText()) !== "Everyday Hoodie"; i++) {
    const was = await centre.innerText();
    await flow.getByRole("button", { name: "Next" }).click();
    await expect(centre).not.toHaveText(was);
  }
  await expect(centre).toHaveText("Everyday Hoodie");

  // The size is asked once; after that it is picked for the piece and the question folds away.
  const ask = rail.getByRole("group", { name: "Your size" });
  await ask.getByRole("button", { name: "M", exact: true }).click();
  await expect(rail.getByRole("button", { name: "My size is M. Change it" })).toBeVisible();
  await expect(first.getByText(/In your size/)).toBeVisible();
  // Buy now opens the payment form in a pop-up, on this page...
  await first.getByRole("button", { name: "Buy now" }).click();
  const pay = page.getByRole("dialog");
  await expect(pay.getByText(/Everyday Hoodie · .* · M · Rs/)).toBeVisible();
  await expect(pay.getByLabel("Mobile number")).toBeVisible();
  await expect(pay.getByRole("button", { name: /^Pay Rs/ })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(pay).toHaveCount(0);
  // ...and the bag button adds it without leaving, then the bag's total shows.
  await first.getByRole("button", { name: /^Add Everyday Hoodie/ }).click();
  await expect(first.getByRole("button", { name: "Everyday Hoodie is in your bag" })).toBeVisible();
  await expect(rail.getByRole("link", { name: /View bag/ })).toContainText("1 piece");
  // Undo takes it back out; adding again puts it back.
  await rail.getByRole("button", { name: /^Undo/ }).click();
  await expect(first.getByRole("button", { name: /^Add Everyday Hoodie/ })).toBeEnabled();
  await first.getByRole("button", { name: /^Add Everyday Hoodie/ }).click();
  await expect(rail.getByRole("link", { name: /View bag/ })).toContainText("1 piece");
  await expect(page).toHaveURL(/\/$/); // no login wall, no leaving the page
  // The measurements in cm for the size chosen.
  await first.getByRole("button", { name: "Measurements in cm" }).click();
  await expect(first.getByText(/Size M · cm/)).toBeVisible();

  // Search narrows the rail as you type, forgiving of spelling.
  await rail.getByRole("button", { name: "Search the rail" }).click(); // the round button opens into a field
  await rail.getByRole("textbox", { name: "Search the rail" }).fill("hudi");
  await expect(rail.getByRole("status").first()).toContainText(/of \d+ match "hudi"/);
  await expect(rail.getByRole("heading", { level: 4, name: "Everyday Hoodie" })).toBeVisible();
  await rail.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(rail.getByRole("textbox", { name: "Search the rail" })).toHaveValue("");
  // The cross folds the field back into the round button.
  await rail.getByRole("button", { name: "Close search" }).click();
  await expect(rail.getByRole("button", { name: "Search the rail" })).toBeVisible();

  // Budget and order sit behind Filter.
  await rail.getByRole("button", { name: "Filter" }).click();
  const budget = rail.getByRole("group", { name: "Budget" }).getByRole("button").first();
  await budget.click();
  await expect(rail.getByRole("status").first()).toContainText(/of \d+ under Rs/);
  await rail.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(budget).toHaveAttribute("aria-pressed", "false");
  await expect(rail.getByRole("link", { name: "Shop all" }).last()).toHaveAttribute("href", "/shop?size=M");
  // Each section's Show all opens everything of that kind in the shop.
  await expect(rail.getByRole("link", { name: /^Show all/ }).first()).toHaveAttribute("href", /\/shop\?category=tees,hoodies.*size=M/);

  // The size can be forgotten again.
  await rail.getByRole("button", { name: "My size is M. Change it" }).click();
  await rail.getByRole("button", { name: "Forget my size" }).click();
  await expect(ask.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "false");
  // With no size chosen, the measurements pop out as one card with every size side by side; tapping one picks it.
  await first.getByRole("button", { name: "Measurements in cm" }).click();
  const chart = first.getByRole("group", { name: "All sizes in cm" });
  await expect(chart).toBeVisible();
  await expect(chart.getByText("Chest").first()).toBeVisible();
  await chart.getByRole("button", { name: /^Size L:/ }).click();
  await expect(chart).toHaveCount(0);
  await expect(first.getByText(/Size L · cm/)).toBeVisible();

  // On the home page Designer Fits is a pointer: an occasion opens /fits on that occasion.
  const teaser = page.getByRole("region", { name: "Designer Fits" });
  await teaser.scrollIntoViewIfNeeded();
  await teaser.getByRole("list", { name: "Occasions" }).getByRole("link").nth(1).click();
  await page.waitForURL(/\/fits#/, { timeout: 60_000 });
  const fits = page.getByRole("region", { name: "Designer Fits" });
  // An occasion, then one of the fits inside it.
  // (Only the occasions themselves: on a wide screen the chosen one's fits are listed under it.)
  const occasions = fits.getByRole("radiogroup", { name: "Designer Fits" }).locator(':scope > [role="radio"]');
  await expect(occasions.nth(1)).toHaveAttribute("aria-checked", "true"); // the one picked on the home page
  await occasions.nth(2).click();
  await expect(occasions.nth(2)).toHaveAttribute("aria-checked", "true");
  const inside = fits.getByRole("radiogroup", { name: /fits$/ }).getByRole("radio");
  if ((await inside.count()) > 1) {
    await inside.nth(1).click();
    await expect(inside.nth(1)).toHaveAttribute("aria-checked", "true");
  }
  await expect(fits.getByRole("button", { name: /Add the fit · Rs/ })).toBeEnabled();
  // Quick buy takes the whole fit to the checkout in a pop-up, no account needed.
  await fits.getByRole("button", { name: /^Quick buy the fit · Rs/ }).click();
  const buyFit = page.getByRole("dialog", { name: "Buy the fit" });
  await expect(buyFit.getByRole("button", { name: /^Pay Rs/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(buyFit).toHaveCount(0);
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
  await page.goto("/shop");
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

test("shop: search narrows the pieces, keeps the other filters, and Filter opens its panel @phone", async ({ page }) => {
  await page.goto("/shop?category=hoodies");
  const all = Number((await page.locator("p[aria-live=polite]").first().innerText()).match(/[0-9]+/)![0]);
  // The same round search button as the Rail: it opens into a field and searches as they type.
  await expect(async () => {
    await page.getByRole("button", { name: "Search the shop" }).click();
    await expect(page.getByRole("textbox", { name: "Search the shop" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Search the shop" }).fill("zzzz-no-such-piece");
  // The search is in the address (it can be shared), and the category stays on.
  await expect(page).toHaveURL(/q=zzzz-no-such-piece/);
  await expect(page).toHaveURL(/category=hoodies/);
  await expect(page.getByText(/Nothing matches “zzzz-no-such-piece”/)).toBeVisible();
  await page.getByRole("button", { name: "Close search" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page.locator("p[aria-live=polite]").first()).toContainText(`${all} piece`);
  // Filter: the same choices as before, in a panel under the bar.
  await page.locator("summary[aria-label='Filter and sort']").click();
  await expect(page.getByText("Colour", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Price: low to high" })).toBeVisible();
});

test("the rail: sizing from measurements is for logged-in customers; a guest is asked to log in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const rail = page.locator("section[aria-labelledby=rail-title]");
  await rail.scrollIntoViewIfNeeded();
  // On a cold dev server the first click can land before the page is interactive: retry it.
  await expect(async () => {
    await rail.getByRole("button", { name: "Pick from my measurements" }).click();
    await expect(rail.getByRole("dialog", { name: "Log in to use your size" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  const nudge = rail.getByRole("dialog", { name: "Log in to use your size" });
  await expect(nudge).toContainText("Log in and save your size to use it.");
  await expect(nudge.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  // No size is marked as "picked from your measurements" for a guest, and the letters still work by hand.
  await expect(rail.locator("[data-fit]")).toHaveCount(0);
  await nudge.getByRole("button", { name: "Not now" }).click();
  await expect(nudge).toHaveCount(0);
  await page.screenshot({ path: "test-results/shots/rail-fit-nudge.png" });
});
