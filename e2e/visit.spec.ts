import { expect, test } from "@playwright/test";

const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

// The Visit page hero (docs/VISIT_PAGE_PLAN.md): "Come in.", one status line, Step inside and
// Find us. The receipt lives in the Find us section. ?now= pins the clock (test switch).
// The area at the end of the status line is whatever an earlier admin test saved, so it isn't pinned.
const at = (iso: string) => encodeURIComponent(iso);

test("visit page: coming soon until opening day, with the opening list @phone", async ({ page }, info) => {
  await page.goto("/visit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Come in.");
  await expect(page.locator("[data-status-line]")).toContainText(/OPENING/);
  await expect(page.locator("[data-stage]")).toHaveAttribute("data-lights", "soon");
  await expect(page.getByText("Join the opening list")).toBeVisible();
  await expect(page.locator("#find-us").getByText("Exact address coming soon")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Planned hours/i })).toBeVisible();
  await page.screenshot(shot(`visit-2a-${info.project.name}-soon`));
});

test("visit page preview: status, the two ways in, the route receipt, never indexed @phone", async ({ page }, info) => {
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(page.getByText(/Preview: how this page looks/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("[data-status-line]")).toHaveText(/^OPEN · TILL 8 PM · [A-Z]+$/);
  await expect(page.getByRole("link", { name: "Step inside" })).toHaveAttribute("href", "/visit/tour");
  await expect(page.getByRole("link", { name: "Find us" })).toHaveAttribute("href", "#find-us");
  const findUs = page.locator("#find-us");
  await expect(findUs.getByText("QUEUE")).toBeVisible();
  await expect(findUs.getByText("01  Jhamsikhel Chowk")).toBeVisible();
  await expect(findUs.getByText(/^OPEN · TILL 8 PM/)).toBeVisible();
  await page.screenshot(shot(`visit-2a-${info.project.name}-open`));
});

test("visit page: the lights follow the clock", async ({ page }) => {
  const lights = page.locator("[data-stage]");
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(lights).toHaveAttribute("data-lights", "open");
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T21:00+05:45")}`);
  await expect(lights).toHaveAttribute("data-lights", "closed");
  await expect(page.locator("[data-status-line]")).toHaveText(/^CLOSED · OPENS 11 AM TOMORROW · [A-Z]+$/);
  await page.goto("/visit");
  await expect(lights).toHaveAttribute("data-lights", "soon");
  // Switches for the later phases are read too.
  await page.goto(`/visit?preview=open&motion=fast&gl=off`);
  await expect(lights).toHaveAttribute("data-motion", "fast");
  await expect(lights).toHaveAttribute("data-fallback", "nowebgl");
});

test("visit page works with JavaScript off @phone", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(page.locator("[data-status-line]")).toHaveText(/^OPEN · TILL 8 PM · [A-Z]+$/);
  await expect(page.getByRole("link", { name: "Step inside" })).toHaveAttribute("href", "/visit/tour");
  await page.getByRole("link", { name: "Find us" }).click();
  await expect(page).toHaveURL(/#find-us$/);
  await expect(page.locator("#find-us").getByText("QUEUE")).toBeInViewport();
  await ctx.close();
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
  // Six days out: still in the week of hours the page shows, and clear of the dates other tests pin the clock to
  // (a closure "tomorrow" changed their status line on the days around those dates).
  const soonDay = new Date(Date.now() + 6 * 86_400_000 + 5.75 * 3_600_000).toISOString().slice(0, 10);
  await page.getByLabel("Date").last().fill(soonDay);
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
