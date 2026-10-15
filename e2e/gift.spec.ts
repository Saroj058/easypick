import { expect, test } from "@playwright/test";

import { randomPhone } from "./helpers";

// Screenshots for a visual check land in test-results/ (not committed).
const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

test("gift page: a piece or a card, check a balance, then pieces with plain-link filters @phone", async ({ page }, info) => {
  // The pop-up fetches the piece; on a cold dev server that route compiles first.
  test.slow();
  await page.goto("/gift");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/You know them\.\s*We handle the rest\./);
  // The opening offers the two things to do, a piece or a card, with equal weight.
  const start = page.getByRole("navigation", { name: "Start a gift" });
  await expect(start.getByRole("link", { name: "Send a piece" })).toHaveAttribute("href", "#pieces");
  await expect(start.getByRole("link", { name: "Send a gift card" })).toHaveAttribute("href", "#buy");
  // In the opening too: someone already holding a gift card types its code here, without leaving the page.
  const balance = page.getByRole("region", { name: "Got a gift card?" });
  await expect(balance.getByLabel("Gift card code")).toHaveAttribute("placeholder", "EP-XXXX-XXXX");
  await expect(balance.getByRole("button", { name: "Check" })).toBeVisible();
  // It sits in the hero, under the two tiles, and stays small.
  const tiles = (await start.boundingBox())!;
  const box = (await balance.boundingBox())!;
  expect(box.y).toBeGreaterThan(tiles.y + tiles.height - 1);
  expect(box.height).toBeLessThan(160);
  // Nothing pushes the page wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
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
  await expect(page.getByRole("heading", { name: /No size to guess/i })).toHaveCount(0);
  // Pick, the robot: nothing over him until he's asked. Then one question at a time, by buttons.
  const pick = page.getByRole("region", { name: "Pick, your gift helper" });
  await expect(pick.getByRole("group", { name: "Quick answers" })).toHaveCount(0);
  // The box appears once his walking line is tapped.
  await expect(pick.getByRole("textbox", { name: "Ask Pick" })).toHaveCount(0);
  await pick.getByRole("button", { name: /Ask me anything about clothes/ }).click();
  await pick.getByRole("textbox", { name: "Ask Pick" }).fill("a gift for a friend");
  await pick.getByRole("button", { name: "Send", exact: true }).click();
  await expect(pick).toContainText("What's the occasion?", { timeout: 30_000 });
  const quick = pick.getByRole("group", { name: "Quick answers" });
  for (const answer of ["Birthday", /^Streetwear/, "No limit", "I don't know it"]) {
    await quick.getByRole("button", { name: answer }).click();
  }
  await expect(pick.getByRole("list", { name: "Pick's suggestions" }).getByRole("listitem").first()).toBeVisible();
  await expect(pick).toContainText("Here's what I'd pick");
  await page.screenshot(shot(`gift-${info.project.name}`));

  // The pieces: one strip, narrowed in the page by budget, kind and search.
  const budget = page.getByRole("group", { name: "Budget", exact: true });
  await budget.getByRole("button", { name: "Under Rs 2,000" }).click();
  await expect(budget.getByRole("button", { name: "Under Rs 2,000" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#pieces p.index").getByText(/^Under Rs 2,000/)).toBeVisible();
  const kind = page.getByRole("group", { name: "Kind of piece" });
  await kind.getByRole("button", { name: /^One size/ }).click();
  await expect(kind.getByRole("button", { name: /^One size/ })).toHaveAttribute("aria-pressed", "true");
  // The chosen kind's name, large, over the strip, with its own search.
  await expect(page.getByRole("heading", { name: /^One size/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search one-size pieces" })).toBeVisible();
  const strip = page.getByRole("region", { name: /^Gifts:/ });
  await expect(strip).toBeVisible();
  // The centre piece is sent as a gift from a pop-up on this page; there is no Buy now here.
  await expect(page.locator("#pieces").getByRole("button", { name: "Buy now" })).toHaveCount(0);
  await page.getByRole("button", { name: "Send it as a gift" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Send as a gift" })).toBeVisible();
  await expect(sheet.getByText(/Getting the piece ready/)).toHaveCount(0, { timeout: 60_000 });
  await expect(sheet.getByRole("button", { name: "Continue" })).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("textbox", { name: "Search the gifts" }).fill("hoodie");
  await expect(page.getByRole("region", { name: /^Gifts:/ }).getByRole("button", { name: /Hoodie/ }).first()).toBeAttached();
  await expect(page).toHaveURL(/\/gift(#.*)?$/);
  // No "for her" on a menswear store.
  await expect(page.getByRole("link", { name: /for her/i })).toHaveCount(0);
});

test("Pick: a few words, an answer beside him, real suggestions; Send this opens the gift form; resume, restart, close @phone", async ({ page }) => {
  test.slow();
  await page.goto("/gift");
  const pick = page.getByRole("region", { name: "Pick, your gift helper" });
  // No chat window: one bubble with his latest answer.
  await expect(pick.getByRole("log")).toHaveCount(0);
  // The box appears once his walking line is tapped.
  await expect(pick.getByRole("textbox", { name: "Ask Pick" })).toHaveCount(0);
  await pick.getByRole("button", { name: /Ask me anything about clothes/ }).click();
  await pick.getByRole("textbox", { name: "Ask Pick" }).fill("birthday gift for my brother under 3000, he likes oversized, don't know his size");
  await pick.getByRole("button", { name: "Send", exact: true }).click();
  await expect(pick.getByLabel("You said")).toContainText("birthday gift for my brother");
  const cards = pick.getByRole("list", { name: "Pick's suggestions" }).getByRole("listitem");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeLessThanOrEqual(3);
  // Only pieces inside the budget.
  for (const price of await cards.locator("span.font-mono").allTextContents()) {
    expect(Number(price.replace(/Rs|,/g, "").trim())).toBeLessThanOrEqual(3000);
  }
  // Send this: the same send-as-gift form, in a pop-up.
  await cards.first().getByRole("button", { name: "Send this" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 60_000 });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(pick).toContainText("Great pick");
  // Still there after a reload in this tab.
  await page.reload();
  await expect(page.getByRole("region", { name: "Pick, your gift helper" })).toContainText("Great pick");
  // Start again; then close the answer and Pick goes back to roaming.
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.getByRole("region", { name: "Pick, your gift helper" })).toContainText("Fresh start");
  await page.getByRole("button", { name: "Close Pick's answer" }).click();
  await expect(page.getByRole("region", { name: "Pick, your gift helper" }).getByText("Fresh start")).toHaveCount(0);
});

test("a piece opened from the Gift page only sends: no Buy now, no bag @phone", async ({ page }) => {
  await page.goto("/product/everyday-hoodie?from=gift");
  const send = page.getByRole("button", { name: "Send it as a gift" });
  await expect(send).toBeVisible();
  await expect(page.getByRole("button", { name: /^Buy now/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pick a size|Add to bag/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Try in store/ })).toHaveCount(0);
  // Opened any other way, it sells as usual.
  await page.goto("/product/everyday-hoodie");
  await expect(page.getByRole("button", { name: "Pick a size" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it as a gift" })).toHaveCount(0);
  // Send as gift opens the form over the page, not a new page.
  await page.getByRole("button", { name: "Send as gift" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 60_000 });
  expect(page.url()).toMatch(/\/product\/everyday-hoodie$/);
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

test("gift bag: pieces from the gift strip, sent together as one gift; add to bag from a shop card @phone", async ({ page }) => {
  test.slow();
  // Shop card: the bag button adds the piece (a size first, when it isn't known).
  await page.goto("/shop");
  await page.getByRole("button", { name: /^Add .* to bag$/ }).first().click();
  const sizes = page.getByRole("group", { name: /^Size for/ });
  if (await sizes.count()) await sizes.getByRole("button").first().click();
  await expect(page.getByText(/Added .* to your bag\./)).toBeVisible();
  // Gift page: the centre card's gift button fills the gift bag.
  await page.goto("/gift");
  await page.getByRole("button", { name: /to the gift bag$/ }).click();
  const g = page.getByRole("group", { name: /^Size for/ });
  if (await g.count()) await g.getByRole("button").first().click();
  await expect(page.getByText(/to your gift bag\./)).toBeVisible();
  await page.getByRole("link", { name: /^Gift bag · 1 piece/ }).click();
  // The Bag page opens on the gift bag; sent together in the usual form.
  await expect(page.getByRole("tab", { name: /Gift bag/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Send as one gift" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "The pieces" })).toBeVisible({ timeout: 60_000 });
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Your gift bag is empty.")).toBeVisible();
});
