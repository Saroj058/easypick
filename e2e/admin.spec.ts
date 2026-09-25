import { expect, test } from "@playwright/test";

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

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the admin isn't reachable without signing in", async ({ request }) => {
  const res = await request.get("/admin/reports/csv", { maxRedirects: 0 });
  expect(res.status()).toBe(403);
  const live = await request.get("/admin/live");
  expect(live.status()).toBe(401);
});
