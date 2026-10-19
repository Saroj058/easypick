import { expect, test, type Page } from "@playwright/test";

/** Sign in as the owner. Checks by opening /admin, since the redirect after signing in can lag on a cold dev server. */
async function ownerSignIn(page: Page) {
  await expect(async () => {
    await page.goto("/admin");
    if (/\/admin$/.test(page.url())) return;
    await page.getByLabel("Username").fill("e2e-owner");
    await page.getByLabel("Password", { exact: true }).fill("e2e-owner-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForTimeout(1500);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 });
  }).toPass({ timeout: 90_000 });
}

test.describe.configure({ mode: "serial" });

test("staff sign in, see orders and reports, and sign out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Username").fill("e2e-owner");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page.getByText(/don't match/)).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill("e2e-owner-password");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const [link, text] of [
    ["Orders", "To pack"],
    ["Stock count", "count sheet"],
    ["Reports", "Day by day"],
    ["Staff", "Add someone"],
  ]) {
    await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByText(text).first()).toBeVisible();
  }

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the admin isn't reachable without signing in", async ({ request }) => {
  // No staff cookie: the proxy sends it to the login page before the route runs.
  const res = await request.get("/admin/reports/csv", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("/admin/login");
  // A cookie that isn't a valid login still gets refused by the route itself.
  const forged = await request.get("/admin/reports/csv", { maxRedirects: 0, headers: { cookie: "ep_admin=forged.1.x" } });
  expect(forged.status()).toBe(403);
  const live = await request.get("/admin/live");
  expect(live.status()).toBe(401);
});

test("the owner puts a piece in The Vault and it shows on the home page", async ({ page }) => {
  await ownerSignIn(page);

  await page.goto("/admin/products/coach-jacket");
  const vault = page.getByRole("group", { name: "The Vault" });
  await vault.getByLabel("Show in The Vault").check();
  await vault.getByLabel(/Brand/).fill("");
  await vault.getByLabel(/Tag it/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Add the brand before tagging it Original.")).toBeVisible();

  await vault.getByLabel(/Brand/).fill("Easypick Studio");
  await vault.getByLabel(/Piece number/).fill("7");
  await vault.getByLabel("Of how many").fill("20");
  await vault.getByLabel(/Its story/).fill("Cut from the last roll of the Drop 01 nylon.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/");
  const section = page.getByRole("region", { name: "The Vault" });
  await expect(section).toBeVisible();
  await expect(section.getByText("07 / 20")).toBeVisible();
  await expect(section.getByRole("link", { name: /Easypick Studio/ }).first()).toBeVisible();
  // "Show all" under the brand opens the Vault page for that brand.
  await section.getByRole("navigation", { name: "Vault brands" }).getByRole("link", { name: /Easypick Studio.*Show all/ }).click();
  await page.waitForURL(/\/vault\?brand=Easypick/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Easypick Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Coach Jacket/ }).first()).toBeVisible();

  await page.goto("/product/coach-jacket");
  await expect(page.getByText("Cut from the last roll of the Drop 01 nylon.")).toBeVisible();
  // A Vault piece goes in the bag only for a signed-in customer: a guest sees Buy now alone.
  await expect(page.getByRole("link", { name: "Buy now" }).or(page.getByRole("button", { name: "Pick a size" })).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to bag" })).toHaveCount(0);

  // Put it back so other tests see the usual catalogue.
  await page.goto("/admin/products/coach-jacket");
  await vault.getByLabel("Show in The Vault").uncheck();
  await vault.getByLabel(/Tag it/).uncheck();
  await vault.getByLabel(/Brand/).fill("");
  await vault.getByLabel(/Piece number/).fill("");
  await vault.getByLabel("Of how many").fill("");
  await vault.getByLabel(/Its story/).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("the owner sets a Designer Fits look and the Fits page uses it", async ({ page }) => {
  await ownerSignIn(page);

  await page.goto("/admin/looks");
  const party = page.getByRole("group", { name: "Party · Night out" });
  const pick = async (label: string, slug: string) => {
    const select = party.getByLabel(label);
    const value = await select.locator(`option[value^="${slug}~"]`).first().getAttribute("value");
    await select.selectOption(value!);
  };
  await pick("Piece 1", "everyday-hoodie");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Party · Night out: pick at least two pieces")).toBeVisible();

  await pick("Piece 2", "relaxed-straight-jean");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\. The Fits page shows these looks/)).toBeVisible();

  await page.goto("/fits");
  const fits = page.getByRole("region", { name: "Designer Fits" });
  await expect(fits.getByRole("radio", { name: "Party", exact: true })).toBeVisible();
  await expect(fits.getByRole("radio", { name: "Night out" })).toHaveAttribute("aria-checked", "true");
  await expect(fits.getByText(/Designer's pick/)).toBeVisible();
  await expect(fits.getByText("Everyday Hoodie").filter({ visible: true }).first()).toBeVisible(); // the phone layout holds a hidden copy
  await expect(fits.getByText("Relaxed Straight Jean").filter({ visible: true }).first()).toBeVisible(); // the phone layout holds a hidden copy

  // Back to automatic.
  await page.goto("/admin/looks");
  await party.getByLabel("Piece 1").selectOption("");
  await party.getByLabel("Piece 2").selectOption("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\./)).toBeVisible();
});

test("the owner edits the home page and the announcement from the admin, and the site follows", async ({ page }) => {
  await ownerSignIn(page);

  // A home page headline.
  await page.goto("/admin/home");
  const track = page.getByRole("region", { name: "Track an order" });
  await track.getByLabel("Headline").fill("Find your order.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The home page shows it now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find your order." })).toBeVisible();

  // The announcement, then closing it.
  await page.goto("/admin/site");
  const box = page.getByRole("region", { name: "Announcement" });
  await box.getByText("Show the announcement").click();
  await expect(box.getByLabel("Show the announcement")).toBeChecked();
  await box.getByLabel("Message").fill("Dashain hours: open till 9");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. Every page shows it now.")).toBeVisible();
  await page.goto("/shop");
  await expect(page.getByText("Dashain hours: open till 9")).toBeVisible();
  await page.getByRole("button", { name: "Close the announcement" }).click();
  await expect(page.getByText("Dashain hours: open till 9")).toHaveCount(0);

  // Put both back.
  await page.goto("/admin/site");
  await page.getByRole("region", { name: "Announcement" }).getByText("Show the announcement").click();
  await expect(page.getByRole("region", { name: "Announcement" }).getByLabel("Show the announcement")).not.toBeChecked();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. Every page shows it now.")).toBeVisible();
  await page.goto("/admin/home");
  await page.getByRole("region", { name: "Track an order" }).getByLabel("Headline").fill("Track an order.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The home page shows it now.")).toBeVisible();
});

test("the owner edits a piece after it was made: sizes, a colour, measurements, its place, then deletes the copy", async ({ page }) => {
  await ownerSignIn(page);
  await page.goto("/admin/products/tapered-jogger");
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.waitForURL(/added=copy/, { timeout: 60_000 });
  const copy = new URL(page.url()).pathname;

  await page.getByRole("navigation", { name: "Product sections" }).getByRole("link", { name: "Colours & sizes" }).click();
  await page.waitForURL(/tab=variants/);
  await page.getByRole("button", { name: "+ XXL" }).click();
  await expect(page.getByText(/Added \d+ sizes? with no stock yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove size XXL" })).toBeVisible();

  const colourName = page.getByLabel(/name$/).first();
  const was = await colourName.inputValue();
  await colourName.fill(`${was} Two`);
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText(`Renamed to ${was} Two.`)).toBeVisible();

  await page.getByLabel("M Length in cm").fill("101");
  await page.getByRole("button", { name: "Save measurements" }).click();
  await expect(page.getByText(/Measurements saved/)).toBeVisible();

  await page.goto(`${copy}?tab=more`);
  await page.getByRole("button", { name: "Move to the top" }).click();
  await page.getByLabel(/Type .delete. to confirm/).fill("delete");
  await page.getByRole("button", { name: /^Delete / }).click();
  await page.waitForURL(/\/admin\/products$/, { timeout: 60_000 });
  const res = await page.goto(copy);
  expect(res?.status()).toBe(404);
});

test("the owner renames and hides a category, and the shop follows", async ({ page }) => {
  await ownerSignIn(page);
  await page.goto("/admin/categories?tab=edit");
  await page.getByLabel("hoodies name").fill("Hoodies & zips");
  const shorts = page.getByRole("listitem").filter({ has: page.getByLabel("shorts name") });
  await shorts.getByText("Shown").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The shop, drops and rail show it now.")).toBeVisible();

  await page.goto("/shop");
  const kinds = page.getByRole("group", { name: "Category" });
  await expect(kinds.getByRole("link", { name: /Hoodies & zips/ })).toBeVisible();

  // Put them back.
  await page.goto("/admin/categories?tab=edit");
  await page.getByLabel("hoodies name").fill("Hoodies");
  await page.getByRole("listitem").filter({ has: page.getByLabel("shorts name") }).getByText("Shown").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The shop, drops and rail show it now.")).toBeVisible();
});

test("the owner sets the Vault's colours and words, sees what's hard to read, and the Vault follows", async ({ page }) => {
  await ownerSignIn(page);
  await page.goto("/admin/vault");
  const blue = page.getByRole("region", { name: "The Vault's own blue" });
  // Retried until the page has loaded enough to take the change.
  await expect(async () => {
    await blue.getByLabel("The Vault panel colour").fill("#010101");
    await blue.getByLabel("The Vault panel colour").fill("#000000");
    await expect(blue.getByRole("list", { name: "The Vault readability" })).toContainText(/White on panel\s*21:1/, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await blue.getByLabel("The Vault quiet text colour").fill("#000000");
  await expect(blue.getByRole("list", { name: "The Vault readability" }).getByText(/1:1 · hard to read/)).toBeVisible();
  await blue.getByRole("button", { name: "Back to the first blue" }).click();
  await expect(blue.getByText(/hard to read/)).toHaveCount(0);

  // A new brand gets its own world, ready to fill in.
  await page.getByLabel("Add a brand").fill("Stussy");
  await page.getByRole("button", { name: "Add brand" }).click();
  await expect(page.getByRole("tab", { name: /Stussy/, selected: true })).toBeVisible();
  await page.getByLabel("Where it began").fill("Laguna Beach · 1980");
  await expect(page.getByLabel("Stussy preview").getByText("Stussy").first()).toBeVisible();

  await page.getByLabel("Opening line").fill("Kept cold. One of each, checked by hand.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The Vault shows it now.")).toBeVisible();

  await page.goto("/vault");
  await expect(page.getByText("Kept cold. One of each, checked by hand.")).toBeVisible();

  // Put it back.
  await page.goto("/admin/vault");
  await page.getByRole("tab", { name: /Stussy/ }).click();
  await page.getByRole("button", { name: "Remove Stussy's colours" }).click();
  await page.getByLabel("Opening line").fill("Original brands, one of each. Checked by hand, never restocked, gone when it's gone.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. The Vault shows it now.")).toBeVisible();
});

test("the owner opens a drop from its card, takes a piece out, saves, and picks it back from photos", async ({ page }) => {
  await ownerSignIn(page);
  await page.goto("/admin/drops");
  await page.locator(`a[href^="/admin/drops?edit="]`).first().click();
  await expect(page.getByRole("link", { name: "All drops" })).toBeVisible();
  const tray = page.getByRole("list", { name: "Chosen pieces" });
  const first = tray.getByRole("button").first();
  const name = (await first.getAttribute("aria-label"))!.replace(/^Take | out$/g, "");
  // Retried until the page has loaded enough to take the tap.
  await expect(async () => {
    await page.getByRole("button", { name: `Take ${name} out` }).click({ timeout: 1000 });
    await expect(page.getByRole("button", { name: `Take ${name} out` })).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save drop" }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Take ${name} out` })).toHaveCount(0);

  // Pick it back from the photos.
  await page.getByPlaceholder("Search pieces").fill(name);
  const card = page.locator("button[aria-pressed]").filter({ hasText: name }).filter({ hasText: " left" }).first();
  await expect(async () => {
    await card.click({ timeout: 1000 });
    await expect(card).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save drop" }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Take ${name} out` })).toBeVisible();
});
