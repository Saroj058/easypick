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

  await page.goto("/product/coach-jacket");
  await expect(page.getByText("Cut from the last roll of the Drop 01 nylon.")).toBeVisible();

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

test("the owner sets a Wear it to… look and the home page uses it", async ({ page }) => {
  await ownerSignIn(page);

  await page.goto("/admin/looks");
  const party = page.getByRole("group", { name: "Party" });
  const pick = async (label: string, slug: string) => {
    const select = party.getByLabel(label);
    const value = await select.locator(`option[value^="${slug}~"]`).first().getAttribute("value");
    await select.selectOption(value!);
  };
  await pick("Piece 1", "everyday-hoodie");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Party: pick at least two pieces")).toBeVisible();

  await pick("Piece 2", "relaxed-straight-jean");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\. The home page shows these looks/)).toBeVisible();

  await page.goto("/");
  const fits = page.getByRole("region", { name: "Wear it to…" });
  await expect(fits.getByRole("radio", { name: "Party" })).toBeVisible();
  await expect(fits.getByText("Everyday Hoodie").first()).toBeVisible();
  await expect(fits.getByText("Relaxed Straight Jean").first()).toBeVisible();

  // Back to automatic.
  await page.goto("/admin/looks");
  await party.getByLabel("Piece 1").selectOption("");
  await party.getByLabel("Piece 2").selectOption("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\./)).toBeVisible();
});
