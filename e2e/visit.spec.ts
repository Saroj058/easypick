import { expect, test } from "@playwright/test";

const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true });

// The Visit page is one film (see e2e/visit-3d.spec.ts for the film itself). These tests cover
// what doesn't need WebGL: the first screen's HTML (the headline, the status, the two ways to
// visit), and In person with no film (?gl=off): the directions over a still.
// ?now= pins the clock (test switch). The area in the status is whatever an earlier admin test saved.
const at = (iso: string) => encodeURIComponent(iso);
const panel = (page: import("@playwright/test").Page) => page.locator("[data-panel=open]");
const film = (page: import("@playwright/test").Page) => page.locator("[data-film]");

test("visit page: coming soon until opening day, with the opening list @phone", async ({ page }, info) => {
  await page.goto("/visit?gl=off");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visit Easypick");
  await expect(page.locator("[data-status-line]")).toContainText(/OPENING/);
  await expect(page.locator("[data-status]")).toContainText("OPENING SOON");
  await expect(page.getByText("Join the opening list")).toBeVisible();
  await page.screenshot(shot(`visit-${info.project.name}-soon`));
  // In person, before opening day: the area only, and the planned hours.
  await expect(film(page)).toHaveAttribute("data-fallback", "nowebgl");
  await page.getByRole("link", { name: "In person" }).click();
  await expect(panel(page).getByText("Exact address coming soon")).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Planned hours" })).toBeVisible();
  await expect(panel(page).getByRole("link", { name: "Open in Google Maps" })).toHaveCount(0);
});

test("visit page preview: one screen with the two ways to visit; the receipt is in In person; never indexed @phone", async ({ page }, info) => {
  await page.goto(`/visit?preview=open&gl=off&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(page.getByText(/Preview: how this page looks/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("[data-status-line]")).toHaveText(/^OPEN · TILL 8 PM · [A-Z]+$/);
  // What's on the first screen: the hour in Kathmandu, the status, one headline, two choices.
  await expect(page.locator("[data-ktm-clock]").first()).toHaveText("12:00");
  await expect(page.locator("[data-status]")).toContainText("OPEN TILL 8 PM");
  await expect(page.getByText("One planet.")).toBeVisible();
  const ways = page.getByRole("navigation", { name: "Ways to visit" });
  await expect(ways.getByRole("link")).toHaveCount(2);
  await expect(ways.getByRole("link", { name: "Virtual tour" })).toHaveAttribute("href", "/visit/tour#enter");
  await expect(ways.getByRole("link", { name: "In person" })).toHaveAttribute("href", "#find-us");
  // Nothing else on the page: no sections, no footer, no tab bar.
  await expect(page.locator("main h2")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Quick links" })).toHaveCount(0);
  await page.screenshot(shot(`visit-${info.project.name}-open`));

  await expect(film(page)).toHaveAttribute("data-fallback", "nowebgl");
  await ways.getByRole("link", { name: "In person" }).click();
  const p = panel(page);
  await expect(p.getByText("QUEUE", { exact: true })).toBeVisible();
  await expect(p.getByText(/01\s+Jhamsikhel Chowk/)).toBeVisible();
  await expect(p.getByText(/^EASYPICK · OPEN TILL 8 PM/)).toBeVisible();
  // How the store works, and the week's hours, are in the panel.
  await expect(p.locator("[data-inside]").getByText("Pay it.")).toBeAttached();
  await expect(p.locator("[data-hours] tr")).toHaveCount(7);
  await expect(p.locator("[data-hours] tr").first()).toContainText(/Today.*11 AM – 8 PM/);
  await page.screenshot(shot(`visit-${info.project.name}-in-person-plain`));
});

test("visit page: the status and the still follow the clock in Kathmandu", async ({ page }) => {
  await page.goto(`/visit?preview=open&gl=off&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(page.locator("[data-status]")).toContainText("OPEN TILL 8 PM");
  await expect(page.locator("img[data-poster]")).toHaveAttribute("src", /earth-day/);
  await page.goto(`/visit?preview=open&gl=off&now=${at("2026-10-07T21:00+05:45")}`);
  await expect(page.locator("[data-status]")).toContainText("CLOSED NOW");
  await expect(page.locator("[data-status-line]")).toHaveText(/^CLOSED · OPENS 11 AM TOMORROW · [A-Z]+$/);
  await expect(page.locator("[data-ktm-clock]").first()).toHaveText("21:00");
  await expect(page.locator("img[data-poster]")).toHaveAttribute("src", /earth-night/);
  // The test switches are read.
  await page.goto(`/visit?preview=open&motion=fast&gl=off`);
  await expect(film(page)).toHaveAttribute("data-motion", "fast");
  await expect(film(page)).toHaveAttribute("data-fallback", "nowebgl");
});

test("visit page works with JavaScript off @phone", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(page.locator("[data-status-line]")).toHaveText(/^OPEN · TILL 8 PM · [A-Z]+$/);
  await expect(page.locator("[data-action=tour]")).toHaveAttribute("href", "/visit/tour#enter");
  // With no film, In person leads to the essentials in words: the address, today's hours, Google Maps.
  await page.locator("[data-action=in-person]").click();
  await expect(page).toHaveURL(/#find-us$/);
  const words = page.locator("#find-us");
  await expect(words.getByText(/Today: 11 AM – 8 PM/)).toBeVisible();
  await expect(words.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
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

  // The week's hours are in the In person panel.
  await page.goto("/visit?gl=off#find-us");
  await expect(panel(page).getByRole("row", { name: /Closed for testing/ })).toContainText("Closed");
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
