import { expect, test } from "@playwright/test";

const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

test("visit page: coming soon until opening day, with the opening list @phone", async ({ page }, info) => {
  await page.goto("/visit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Opening/i);
  await expect(page.getByText("Join the opening list")).toBeVisible();
  await expect(page.getByText("Exact address coming soon")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Planned hours/i })).toBeVisible();
  await page.screenshot(shot(`visit-soon-${info.project.name}`));
});

test("visit page preview: shutter up, route receipt, never indexed @phone", async ({ page }, info) => {
  await page.goto("/visit?preview=open");
  await expect(page.getByText(/Preview: how this page looks/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("QUEUE")).toBeVisible();
  await expect(page.getByText("01  Jhamsikhel Chowk")).toBeVisible();
  // Open, closed or drop day depends on the clock; the receipt's status line always shows.
  await expect(page.getByText(/^EASYPICK · (OPEN NOW|CLOSED NOW|DROP DAY)/)).toBeVisible();
  await page.waitForTimeout(2500); // let the shutter roll and the receipt print
  await page.screenshot(shot(`visit-open-${info.project.name}`));
});

test("the owner sets a special day in admin and the Visit page shows it", async ({ page }) => {
  // A fresh test database creates the owner on the first attempt, so a second try may be needed.
  for (let i = 0; i < 3; i++) {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill("e2e-owner");
    await page.getByLabel("Password", { exact: true }).fill("e2e-owner-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    if (await page.waitForURL(/\/admin$/, { timeout: 15_000 }).then(() => true, () => false)) break;
  }
  await page.goto("/admin/store");
  await page.getByRole("button", { name: "Add a special day" }).click();
  const tomorrow = new Date(Date.now() + 86_400_000 + 5.75 * 3_600_000).toISOString().slice(0, 10);
  await page.getByLabel("Date").last().fill(tomorrow);
  await page.getByLabel("Note").last().fill("Closed for testing");
  await page.getByLabel("Step 1", { exact: true }).fill("Jhamsikhel Chowk");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Saved. The Visit page/)).toBeVisible();

  await page.goto("/visit");
  await expect(page.getByRole("row", { name: /Closed for testing/ })).toContainText("Closed");
});
