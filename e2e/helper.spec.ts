import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const HELPER = { username: "e2e-helper", password: "e2e-helper-pass-1" };

async function signIn(page: Page, path: string, username: string, password: string) {
  await page.goto(path);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
}

test("the owner adds a helper", async ({ page }) => {
  await signIn(page, "/admin/login", "e2e-owner", "e2e-owner-password");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/staff");
  if (await page.getByText(HELPER.username, { exact: true }).count()) return; // from an earlier run
  await page.getByLabel("Username").fill(HELPER.username);
  await page.getByLabel("Starting password").fill(HELPER.password);
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText(`Added ${HELPER.username}`)).toBeVisible();
});

test("a helper works in the helper portal, not the admin @phone", async ({ page }) => {
  await signIn(page, "/helper/login", HELPER.username, HELPER.password);
  await expect(page).toHaveURL(/\/helper$/);
  await expect(page.getByRole("heading", { name: /To pack/ })).toBeVisible();

  // The admin sends helpers back to their portal.
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/helper$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/helper$/);

  // Find
  await page.getByRole("navigation", { name: "Helper sections" }).getByRole("link", { name: "Find" }).last().click();
  await page.getByLabel(/Order number, phone/).fill("9812000000");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText(/orders? for/)).toBeVisible();

  // Stock: add one piece, see it in the history.
  await page.goto("/helper/stock");
  await page.getByLabel("Piece name or SKU").fill("cap");
  await page.getByRole("button", { name: "Find" }).click();
  await page.locator('a[href="/helper/stock/six-panel-cap"]').click();
  await page.locator('input[name^="adj:"]').first().fill("1");
  await page.getByRole("button", { name: "Update stock" }).click();
  await expect(page.getByText("Stock updated")).toBeVisible();
  await expect(page.getByRole("cell", { name: HELPER.username }).first()).toBeAttached();

  // Me → sign out lands on the helper login.
  await page.goto("/helper/me");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/helper\/login/);
});

test("the portal needs a login", async ({ page }) => {
  await page.goto("/helper");
  await expect(page).toHaveURL(/\/helper\/login/);
});
