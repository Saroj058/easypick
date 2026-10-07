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

// ---------- Phase 3b: the Find us map ----------

test("find us: the map opens from the hero on our own tiles, with credit, and Back returns to the store @phone", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  const refused: string[] = [];
  page.on("console", (m) => /Refused|Content Security Policy/i.test(m.text()) && refused.push(m.text()));
  const mapRequests: string[] = [];
  page.on("request", (r) => /maplibre|pmtiles|\/map\//.test(r.url()) && mapRequests.push(r.url()));

  await page.goto(`/visit?preview=open&tiles=fixture&now=${at("2026-10-07T12:00+05:45")}`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  // Nothing of the map is loaded until it's asked for.
  expect(mapRequests).toEqual([]);

  await page.getByRole("link", { name: "Find us" }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "map");
  await expect(page).toHaveURL(/#find-us$/);
  await expect(stage(page)).toHaveAttribute("data-map-state", "ready", { timeout: 60_000 });
  // One WebGL context at a time: the 3D store's canvas has gone.
  await expect(page.locator("[data-hero-canvas] canvas")).toHaveCount(0);
  const map = page.getByRole("region", { name: /^Map: route from .+ to Easypick$/ });
  await expect(map.locator("canvas")).toBeVisible();
  await expect(map.locator("[data-map-pin]")).toBeVisible();
  await expect(map.getByText(/© OpenStreetMap/)).toBeVisible();
  await expect(map.getByText(/Protomaps/)).toBeVisible();
  // Test runs never fetch the real map file.
  expect(mapRequests.some((u) => u.includes("supabase"))).toBe(false);
  expect(mapRequests.some((u) => u.endsWith("/map/fixture.pmtiles"))).toBe(true);
  await page.screenshot({ path: `test-results/shots/visit-3b-${info.project.name}-map.png` });

  await page.getByRole("button", { name: /The store/ }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  await expect(page).not.toHaveURL(/#find-us$/);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  expect(refused).toEqual([]);
  expect(errors()).toEqual([]);
});

test("find us: /visit#find-us opens straight on the map; without WebGL it is the section on the page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/visit?preview=open&tiles=fixture#find-us");
  await expect(stage(page)).toHaveAttribute("data-stage", "map");
  await expect(stage(page)).toHaveAttribute("data-map-state", "ready", { timeout: 60_000 });
  await page.keyboard.press("Escape");
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");

  await page.goto("/visit?preview=open&gl=off");
  await page.getByRole("link", { name: "Find us" }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  await expect(page.locator("#find-us").getByText("QUEUE")).toBeInViewport();
});
