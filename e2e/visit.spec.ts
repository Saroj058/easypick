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


test("the owner adds a start point with its route, and saving other details keeps it", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill("e2e-owner");
    await page.getByLabel("Password", { exact: true }).fill("e2e-owner-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    if (await page.waitForURL(/\/admin$/, { timeout: 15_000 }).then(() => true, () => false)) break;
  }
  await page.goto("/admin/store");
  // A made-up pin and route in Jhamsikhel (sample data, not the store).
  await page.getByLabel("Map pin latitude").fill("27.6781");
  await page.getByLabel("Map pin longitude").fill("85.3052");
  await page.getByRole("button", { name: "Add a start point" }).click();
  await page.getByLabel("Start point 1", { exact: true }).fill("Test Chowk");
  // A route that ends away from the pin is refused before saving, in plain words.
  const route = page.getByLabel("Route to the store");
  await route.fill(["27.6800, 85.3022", "27.6800, 85.3032"].join("\n"));
  await expect(page.getByText(/m from the store pin/)).toBeVisible();
  await route.fill(["27.6781, 85.3022", "27.6781, 85.3032", "27.6781, 85.3042", "27.6781, 85.3052"].join("\n"));
  await expect(page.getByRole("img", { name: /Route preview, \d+ metres/ })).toBeVisible();
  await page.getByLabel("Receipt steps").fill(["Test Chowk, 0", "Black shutter, 4"].join("\n"));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Saved. The Visit page/)).toBeVisible();

  // It's there after a reload, ending exactly on the pin.
  await page.reload();
  await expect(page.getByLabel("Start point 1", { exact: true })).toHaveValue("Test Chowk");
  await expect(page.getByLabel("Route to the store")).toHaveValue(/27\.6781, 85\.3052$/);
  // Saving something else keeps it.
  await page.getByLabel("Notice").fill("Start point test");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Saved. The Visit page/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Start point 1", { exact: true })).toHaveValue("Test Chowk");
  await page.screenshot({ path: "test-results/shots/visit-1b-desktop-admin-start-points.png", fullPage: true });

  // Put things back for the other tests.
  await page.getByRole("button", { name: "Remove start point 1" }).click();
  await page.getByLabel("Notice").fill("");
  await page.getByLabel("Map pin latitude").fill("");
  await page.getByLabel("Map pin longitude").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Saved. The Visit page/)).toBeVisible();
});
