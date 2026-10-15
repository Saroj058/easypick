import { expect, test, type Page } from "@playwright/test";

import { randomPhone } from "./helpers";

test("home, shop and a product page load @phone", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Easypick/);
  // The shop is strips, as on the rails: the piece in front links to its page.
  await page.goto("/shop?category=hoodies");
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForURL(/\/product\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The price is on the hang tag, so the panel doesn't repeat it or the delivery lines.
  await expect(page.getByText(/No DM needed/)).toHaveCount(0);
  await expect(page.getByText(/Gift cards accepted/)).toHaveCount(0);
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
  // ...and the bag on the card in front (only that one has it) adds it in the size now known, without leaving.
  await expect(first.getByRole("button", { name: /^Add .* to bag$/ })).toHaveCount(1);
  await first.getByRole("button", { name: "Add Everyday Hoodie to bag" }).click();
  await expect(page.getByText(/Added Everyday Hoodie \(.*, M\) to your bag\./)).toBeVisible();
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

test("shop: strips like the rails, one bag on the card in front, no heart (owner, 15 Oct 2026)", async ({ page }) => {
  // Everything: a strip for each kind, each with "Only …" to see just that kind.
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 2, name: /^Hoodies/ })).toBeVisible();
  await page.getByRole("link", { name: /^Only hoodies/ }).click();
  await expect(page).toHaveURL(/category=hoodies/);
  // One kind: one strip under its big name, with one bag button (on the card in front).
  await expect(page.getByRole("heading", { level: 2, name: /^Hoodies/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add .* to bag$/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Save / })).toHaveCount(0);
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

test("account dashboard: greeting, calm summaries, Edit opens the form; Pick on the shop @phone", async ({ page }) => {
  test.slow();
  const phone = `98${String(Date.now()).slice(-8)}`;
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: /^Send code/ }).click();
  const dev = page.getByText(/your code is/);
  await expect(dev).toBeVisible({ timeout: 30_000 });
  await page.locator("#login-code").pressSequentially((await dev.locator("span.font-mono").innerText()).trim(), { delay: 40 });
  await page.waitForURL(/welcome|account/, { timeout: 30_000 });
  if (page.url().includes("welcome")) {
    await page.getByLabel("Your name").fill("Dash Test");
    await page.getByRole("button", { name: "Continue" }).click();
    // The welcome page's own address has "account" in it (next=/account): wait for the page itself.
    await page.waitForURL((u) => u.pathname === "/account");
  }
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Namaste, Dash." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByText("No orders yet.")).toBeVisible();
  // Saved details as one line each; the form only opens on Edit.
  const details = page.getByRole("region", { name: "My details" });
  await expect(details).toContainText("Dash Test");
  await expect(details.getByLabel("Your name")).toBeHidden();
  await details.getByText("Edit", { exact: true }).click();
  await expect(details.getByLabel("Your name")).toBeVisible();
  // Gift card codes never show in full; sign out sits at the bottom.
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();

  // Pick on the shop: for themselves first.
  await page.goto("/shop");
  const pick = page.getByRole("region", { name: "Pick, your shopping helper" });
  // The box appears once his walking line is tapped.
  await expect(pick.getByRole("textbox", { name: "Ask Pick" })).toHaveCount(0);
  await pick.getByRole("button", { name: /Ask me anything about clothes/ }).click();
  await pick.getByRole("textbox", { name: "Ask Pick" }).fill("something for me under 2000, oversized, size M");
  await pick.getByRole("button", { name: "Send", exact: true }).click();
  await expect(pick.getByRole("list", { name: "Pick's suggestions" }).getByRole("link", { name: "View" }).first()).toBeVisible({ timeout: 30_000 });
});
