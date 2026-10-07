import { expect, test, type Page } from "@playwright/test";

// The Visit page's night store (docs/VISIT_PAGE_PLAN.md, Phase 2b): the 3D store draws over the
// poster, its lights follow the store's state, and the two buttons each give a small preview.
// Runs in the 3D projects (software WebGL): see WEBGL_SPECS in playwright.config.ts.

const at = (iso: string) => encodeURIComponent(iso);
const stage = (page: Page) => page.locator("[data-stage]");

/** Console errors and blocked requests, to prove the page is clean. */
function collect(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return () => errors.filter((e) => !/Download the React DevTools|favicon/.test(e));
}

test("night store: the 3D store takes over from the poster, lit for each state", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  const states: [string, string][] = [
    ["open", `/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`],
    ["closed", `/visit?preview=open&now=${at("2026-10-07T22:00+05:45")}`],
    ["soon", "/visit"],
  ];
  for (const [lights, url] of states) {
    await page.goto(url);
    await expect(stage(page)).toHaveAttribute("data-lights", lights);
    await expect(page.locator("[data-hero-canvas] canvas")).toBeVisible({ timeout: 60_000 });
    await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
    await expect(stage(page)).toHaveAttribute("data-fallback", "none");
    await page.screenshot({ path: `test-results/shots/visit-2b-${info.project.name}-${lights}.png` });
  }
  expect(errors()).toEqual([]);
});

test("night store: pointing at Find us drops the pin above the roof @phone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/visit?preview=open&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  const pin = page.locator("[data-pin] > span");
  await expect(pin).toHaveCSS("opacity", "0");
  await page.getByRole("link", { name: "Find us" }).focus();
  await expect(pin).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Step inside" }).focus();
  await expect(pin).toHaveCSS("opacity", "0");
});

test("night store: no WebGL or the lite switch keeps the poster; reduced motion keeps the store still", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.goto("/visit?preview=open&gl=off");
  await expect(stage(page)).toHaveAttribute("data-fallback", "nowebgl");
  await expect(page.locator("[data-hero-canvas] canvas")).toHaveCount(0);
  await expect(page.locator("[data-hero-poster]")).toBeVisible();
  await page.goto("/visit?preview=open&lite=1");
  await expect(stage(page)).toHaveAttribute("data-fallback", "lite");
  await expect(page.locator("[data-hero-canvas] canvas")).toHaveCount(0);

  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const calm = await ctx.newPage();
  await calm.goto("/visit?preview=open");
  await expect(stage(calm)).toHaveAttribute("data-fallback", "reduced");
  await expect(stage(calm)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await ctx.close();
});
