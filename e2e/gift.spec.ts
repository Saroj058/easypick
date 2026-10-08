import { expect, test } from "@playwright/test";

import { randomPhone } from "./helpers";

// Screenshots for a visual check land in test-results/ (not committed).
const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

test("gift page: a piece or a card, check a balance, then pieces with plain-link filters @phone", async ({ page }, info) => {
  await page.goto("/gift");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/You know them\.\s*We handle the rest\./);
  // The opening offers the two things to do, a piece or a card, with equal weight.
  const start = page.getByRole("navigation", { name: "Start a gift" });
  await expect(start.getByRole("link", { name: "Send a piece" })).toHaveAttribute("href", "#pieces");
  await expect(start.getByRole("link", { name: "Send a gift card" })).toHaveAttribute("href", "#buy");
  // Right below: someone already holding a gift card types its code here, without leaving the page.
  const balance = page.getByRole("region", { name: "Got a gift card?" });
  await expect(balance.getByLabel("Gift card code")).toHaveAttribute("placeholder", "EP-XXXX-XXXX");
  await expect(balance.getByRole("button", { name: "Check" })).toBeVisible();
  // It is one thin strip, not a block.
  expect((await balance.boundingBox())!.height).toBeLessThan(info.project.name === "phone" ? 150 : 80);
  await expect(page.getByText("Three ways to gift")).toHaveCount(0);
  // The gift cards are shown as cards to pick from, not as a price.
  const cards = page.getByRole("region", { name: "Gift cards." });
  await expect(cards.getByRole("button", { name: /^Gift card, Rs/ })).toHaveCount(9);
  // All nine are in view together: a grid, not a row to swipe through.
  expect(await cards.getByRole("list").last().evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  // The section is the gift cards' home: who it's for at the top, the facts, every card, and any other amount.
  await expect(cards.getByRole("radiogroup", { name: "Who is the card for" }).getByRole("radio")).toHaveCount(2);
  await expect(cards).toContainText("Valid for 12 months");
  await expect(cards.getByRole("button", { name: /Your amount/ })).toBeVisible();
  await expect(page.getByText(/from Rs 1,000/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /No size to guess/i })).toBeVisible();
  await page.screenshot(shot(`gift-${info.project.name}`));

  const chips = page.getByRole("navigation", { name: "Budget", exact: true });
  await chips.getByRole("link", { name: "Under Rs 2,000" }).click();
  await expect(page).toHaveURL(/max=2000/);
  await expect(chips.getByRole("link", { name: "Under Rs 2,000" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: "Under Rs 2,000." })).toBeVisible();
  // With a filter on, the curated rows step aside; the kind of piece narrows it further.
  await expect(page.getByRole("heading", { name: /No size to guess/i })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Kind of piece" }).getByRole("link", { name: "One size" }).click();
  await expect(page).toHaveURL(/cat=one/);
  // No "for her" on a menswear store.
  await expect(page.getByRole("link", { name: /for her/i })).toHaveCount(0);
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
  await expect(page.locator("#g-rname")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#g-rname").fill("Sita Rai");
  // The row of note ideas scrolls by itself: the page never becomes wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Stuck for words: one tap writes the note, and it shows on the tag.
  await page.getByRole("group", { name: "Note ideas" }).getByRole("button", { name: "Just because" }).click();
  await expect(page.locator("#g-message")).toHaveValue("No occasion. It just looked like you.");
  await expect(page.getByRole("figure", { name: /Preview of the gift card/ })).toContainText("It just looked like you.");
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

test("gift card: chosen on the Gift page, filled in a sheet over it; no separate page @phone", async ({ page }, info) => {
  // The old address lands on the Gift page.
  await page.goto("/gift-cards");
  await expect(page).toHaveURL(/\/gift$/);
  // "For myself" at the top carries into the form; choosing a card opens the form over the page, on that card.
  const cards = page.getByRole("region", { name: "Gift cards." });
  await expect(async () => {
    await cards.getByRole("radio", { name: "For myself" }).click();
    await expect(cards.getByRole("radio", { name: "For myself" })).toHaveAttribute("aria-checked", "true", { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await cards.getByRole("button", { name: "Gift card, Rs 2,000" }).click();
  const mine = page.getByRole("dialog", { name: "A gift card for you" });
  // The form doesn't ask again what was already chosen: no amounts, no someone-or-myself switch.
  await expect(mine.getByRole("heading", { name: "1. Your details" })).toBeVisible();
  await expect(mine.getByLabel("Your email")).toBeVisible();
  await expect(mine.getByRole("radio")).toHaveCount(0);
  await expect(mine.getByText("Choose an amount")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(mine).toHaveCount(0);
  await cards.getByRole("radio", { name: "For someone" }).click();

  // A chosen card opens on that card, with its own printed picture.
  await cards.getByRole("button", { name: "Gift card, Rs 50,000" }).click();
  const sheet = page.getByRole("dialog", { name: "Send a gift card" });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/gift$/);
  const preview = page.getByRole("complementary", { name: "Preview" });
  await expect(preview.getByRole("img", { name: "Easypick gift card, Rs 50,000" }).locator("img")).toHaveAttribute("src", /front-50000/);
  await expect(preview).toContainText("valid for 12 months from purchase");
  await expect(sheet.getByRole("heading", { name: "1. Who it's for" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Pay Rs 50,000|Buy gift card · Rs 50,000/ }).first()).toBeVisible();
  await preview.getByRole("button", { name: "See the back" }).click();
  await expect(preview.getByRole("img", { name: "The back of an Easypick gift card" })).toBeVisible();
  // Tapping the card itself turns it over as well.
  await preview.locator("[data-card-flip]").click();
  await expect(preview.locator("[data-flipped]")).toHaveAttribute("data-flipped", "false");
  await preview.locator("[data-card-flip]").click();
  await expect(preview.locator("[data-flipped]")).toHaveAttribute("data-flipped", "true");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // "Your amount" asks only for the amount: up to Rs 1,00,000, on the plain black card.
  await cards.getByRole("button", { name: /Your amount/ }).click();
  await expect(sheet.getByRole("heading", { name: "1. Your amount" })).toBeVisible();
  await page.locator("#gc-custom").fill("100100");
  await expect(page.locator("#gc-custom-hint")).toContainText("from Rs 1,000 to Rs 1,00,000");
  await page.locator("#gc-custom").fill("100000");
  await expect(preview.getByRole("img", { name: "Easypick gift card, Rs 1,00,000" }).locator("img")).toHaveAttribute("src", /back/);
  await page.locator("#gc-custom").fill("5000");
  await expect(page.getByRole("button", { name: /Pay Rs 5,000|Buy gift card · Rs 5,000/ }).first()).toBeVisible();
  await page.locator("#gc-remail").fill("not-an-email");
  await page.locator("#gc-rphone").click();
  await expect(page.locator("#gc-remail-hint")).toContainText(/Check the email/);
  await page.screenshot(shot(`gift-cards-${info.project.name}`));
});
