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
  await page.getByRole("link", { name: "In person" }).focus();
  await expect(pin).toHaveCSS("opacity", "1");
  await page.locator("[data-hero-action=inside]").focus();
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

// ---------- Phases 3b and 4: the Find us map and its sequence ----------
// ?motion=fast runs every duration at a tenth; ?tiles=fixture keeps the real map file out of tests.

const OPEN = `preview=open&tiles=fixture&now=${at("2026-10-07T12:00+05:45")}`;
const mapRegion = (page: Page) => page.getByRole("region", { name: /^Map: / });
const panel = (page: Page) => page.locator("[data-panel]");

test("find us: the map opens from the hero on our own tiles, plays to the end, and Back returns to the store @phone", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  const refused: string[] = [];
  page.on("console", (m) => /Refused|Content Security Policy/i.test(m.text()) && refused.push(m.text()));
  const mapRequests: string[] = [];
  page.on("request", (r) => /maplibre|pmtiles|\/map\//.test(r.url()) && mapRequests.push(r.url()));

  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  // Nothing of the map is loaded until it's asked for.
  expect(mapRequests).toEqual([]);

  await page.getByRole("link", { name: "In person" }).click();
  await expect(page).toHaveURL(/#find-us$/);
  // A first visit gets the full sequence: the globe, Nepal, the valley, the route.
  await expect(stage(page)).toHaveAttribute("data-entry", "first");
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  await expect(stage(page)).toHaveAttribute("data-stage", "map");
  // The far view's land is our own small file.
  expect(mapRequests.some((u) => u.endsWith("/map/land.json"))).toBe(true);
  // Once it's over the caption has gone and the map keeps to the valley.
  await expect(stage(page)).not.toHaveAttribute("data-place", /.+/);
  // One WebGL context at a time: the 3D store's canvas has gone.
  await expect(page.locator("[data-hero-canvas] canvas")).toHaveCount(0);
  await expect(mapRegion(page).locator("canvas")).toBeVisible();
  await expect(mapRegion(page).locator("[data-map-pin]")).toBeVisible();
  await expect(mapRegion(page).getByText(/© OpenStreetMap/)).toBeVisible();
  await expect(mapRegion(page).getByText(/Protomaps/)).toBeVisible();
  // The panel is in, with every receipt line lit and the way into Google Maps as a plain link.
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).locator("[data-step]")).toHaveCount(3);
  await expect(panel(page).locator("[data-step=dim]")).toHaveCount(0);
  await expect(panel(page).getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=[\d.]+,[\d.]+&travelmode=walking/);
  await expect(page.locator("[data-skip]")).toHaveCount(0);
  // Test runs never fetch the real map file.
  expect(mapRequests.some((u) => u.includes("supabase"))).toBe(false);
  expect(mapRequests.some((u) => u.endsWith("/map/fixture.pmtiles"))).toBe(true);
  await page.screenshot({ path: `test-results/shots/visit-4-${info.project.name}-done.png` });

  await page.getByRole("button", { name: /The store/ }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  await expect(page).not.toHaveURL(/#find-us$/);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });

  // Having watched it once, the next time is the shorter sequence (no valley).
  await page.getByRole("link", { name: "In person" }).click();
  await expect(stage(page)).toHaveAttribute("data-entry", "repeat");
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  expect(refused).toEqual([]);
  expect(errors()).toEqual([]);
});

test("find us: the receipt lines light in order as the route draws, and Skip jumps to the end", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`/visit?${OPEN}`); // normal speed: there's time to watch and to skip
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await page.getByRole("link", { name: "In person" }).click();
  // Skip is there from the first moment.
  await expect(page.locator("[data-skip]")).toBeVisible();
  // It starts far out and names each place on the way down: Earth, Nepal, Kathmandu, the neighbourhood.
  await expect(stage(page)).toHaveAttribute("data-place", "earth", { timeout: 90_000 });
  await expect(page.locator("[data-caption]")).toContainText("Earth.");
  await expect(stage(page)).toHaveAttribute("data-place", "kathmandu", { timeout: 30_000 });
  await expect(page.locator("[data-caption]")).toContainText("Earth → Nepal → Kathmandu");
  await expect(stage(page)).toHaveAttribute("data-map-state", "drawing", { timeout: 90_000 });
  // While it draws, a line is never lit before the one above it.
  const order = await page.evaluate(async () => {
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      seen.push([...document.querySelectorAll("[data-receipt] [data-step]")].map((el) => (el.getAttribute("data-step") === "lit" ? "1" : "0")).join(""));
      await new Promise((r) => setTimeout(r, 50));
    }
    return [...new Set(seen)];
  });
  for (const row of order) expect(row).toMatch(/^1*0*$/);
  // Skip may already have gone if the drawing finished while it was being watched.
  if (await page.locator("[data-skip]").count()) await page.locator("[data-skip]").click();
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 15_000 });
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).locator("[data-step=dim]")).toHaveCount(0);
  // Replay runs it again; a key finishes it.
  await panel(page).getByRole("button", { name: "Replay" }).click();
  await expect(stage(page)).toHaveAttribute("data-map-state", /flying|drawing/);
  await page.locator("[data-skip]").click();
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 5_000 });
});

test("find us: dragging the map stops the camera but still shows the whole route and the panel", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`/visit?${OPEN}`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await page.getByRole("link", { name: "In person" }).click();
  await expect(stage(page)).toHaveAttribute("data-map-state", "flying", { timeout: 90_000 });
  const box = (await mapRegion(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4 + 90, box.y + box.height * 0.5 + 40, { steps: 6 });
  await page.mouse.up();
  await expect(stage(page)).toHaveAttribute("data-map-state", "interrupted", { timeout: 5_000 });
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).locator("[data-step=dim]")).toHaveCount(0);
});

test("find us: a direct link opens on the map with the route drawn; phones get the short bar first @phone", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto(`/visit?${OPEN}#find-us`);
  await expect(stage(page)).toHaveAttribute("data-stage", "map");
  await expect(stage(page)).toHaveAttribute("data-entry", "deeplink");
  if (info.project.name.startsWith("phone")) {
    // Walk time, open or not, and Google Maps, before the full panel arrives.
    const bar = page.locator("[data-find-bar]");
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText(/\d+ MIN WALK · OPEN TILL 8 PM/);
    await expect(bar.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  }
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 60_000 });
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await page.keyboard.press("Escape");
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
});

test("find us: before opening day the map shows the area only; reduced motion opens on the finished map; no WebGL keeps the page section", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await page.goto("/visit?tiles=fixture&motion=fast");
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await page.getByRole("link", { name: "In person" }).click();
  await expect(stage(page)).toHaveAttribute("data-entry", "soon");
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  await expect(panel(page).getByText("Exact address coming soon")).toBeVisible();
  await expect(mapRegion(page).locator("[data-map-pin]")).toHaveCount(0);
  await expect(panel(page).getByRole("link", { name: "Open in Google Maps" })).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Join the opening list" }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");

  // Park the first tab: two software-rendered 3D scenes at once are too slow to be a fair test.
  await page.goto("about:blank");
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const calm = await ctx.newPage();
  await calm.goto(`/visit?${OPEN}`);
  await expect(stage(calm)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await calm.getByRole("link", { name: "In person" }).click();
  await expect(stage(calm)).toHaveAttribute("data-entry", "instant");
  await expect(stage(calm)).toHaveAttribute("data-map-state", "done", { timeout: 60_000 });
  await expect(panel(calm)).toHaveAttribute("data-panel", "open");
  await ctx.close();

  // No WebGL: the directions open all the same, with no live map behind them.
  await page.goto("/visit?preview=open&gl=off");
  await expect(stage(page)).toHaveAttribute("data-fallback", "nowebgl");
  await page.getByRole("link", { name: "In person" }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "map");
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).getByText("QUEUE", { exact: true })).toBeVisible();
  await expect(page.locator("[data-find-us] canvas")).toHaveCount(0);
});

// ---------- Phase 5: the directions panel ----------

test("directions: start chips redraw the route, modes change the minutes, a receipt line moves the map, and every action is a plain link", async ({ page, context }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  const p = panel(page);
  await expect(p).toHaveAttribute("data-panel", "open");
  // The keyboard lands on the panel's heading.
  await expect(p.getByRole("heading", { name: "Directions" })).toBeFocused();

  // Where from: the first start point is chosen; another one redraws the route and reprints the receipt.
  const chips = p.getByRole("radiogroup", { name: "Coming from" }).getByRole("radio");
  await expect(chips).toHaveCount(4);
  await expect(chips.first()).toHaveAttribute("aria-checked", "true");
  const firstReceipt = await p.locator("[data-receipt]").innerText();
  const second = chips.nth(1);
  const name = (await second.innerText()).trim();
  await second.click();
  await expect(second).toHaveAttribute("aria-checked", "true");
  await expect(mapRegion(page)).toHaveAttribute("aria-label", `Map: route from ${name} to Easypick`);
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 30_000 });
  await expect(p.getByText(`FROM ${name.toUpperCase()}`)).toBeVisible();
  expect(await p.locator("[data-receipt]").innerText()).not.toBe(firstReceipt);
  await expect(p.locator("[data-step=dim]")).toHaveCount(0);

  // How: the total, the last receipt line and the Google Maps link all follow the mode.
  const total = p.locator("[data-total]");
  await expect(total).toContainText(/\d+ MIN WALK/);
  const walk = Number((await total.innerText()).match(/(\d+) MIN/)![1]);
  await expect(p.locator("[data-step]").last()).toContainText(`${walk} MIN`);
  await p.getByRole("radio", { name: /Car/ }).click();
  await expect(total).toContainText(/\d+ MIN BY CAR/);
  const car = Number((await total.innerText()).match(/(\d+) MIN/)![1]);
  expect(car).toBeLessThanOrEqual(walk);
  await expect(p.locator("[data-summary]")).toContainText(`${car} MIN BY CAR · OPEN TILL 8 PM`);
  const maps = p.getByRole("link", { name: "Open in Google Maps" });
  await expect(maps).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=[\d.]+,[\d.]+&travelmode=driving$/);
  await expect(maps).toHaveAttribute("target", "_blank");
  await p.getByRole("radio", { name: /Walk/ }).click();
  await expect(maps).toHaveAttribute("href", /travelmode=walking$/);
  await expect(p.getByText("QUEUE", { exact: true })).toBeVisible();

  // A receipt line shows that spot on the map.
  await p.getByRole("button", { name: /^Step 1: / }).click();
  await expect(mapRegion(page)).toHaveAttribute("data-look", "0");

  // Arriving: the address can be selected and copied, WhatsApp gets the address and the map link, and the tour is one tap away.
  const address = (await p.locator("[data-address]").innerText()).trim();
  expect(await p.locator("[data-address]").evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");
  await p.getByRole("button", { name: "Copy address" }).click();
  await expect(p.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  const whatsapp = await p.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  expect(whatsapp).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(whatsapp!.split("text=")[1])).toContain(address);
  expect(decodeURIComponent(whatsapp!.split("text=")[1])).toContain("google.com/maps/dir/");
  await expect(p.getByRole("link", { name: "Look inside" })).toHaveAttribute("href", "/visit/tour");
  // Parking is marked on the map.
  await expect(mapRegion(page).locator("[data-map-parking]")).toHaveCount(2);

  // For review, not a baseline: the panel alone (the map behind it is left out).
  await p.screenshot({ path: `test-results/shots/visit-5-${info.project.name}-panel.png` });
  expect(errors()).toEqual([]);
  // Look inside goes to the tour.
  await p.getByRole("link", { name: "Look inside" }).click();
  await expect(page).toHaveURL(/\/visit\/tour$/);
});

test("directions: on a phone it's a sheet that opens at half, goes nearly full and down to a peek, and has the way back @phone", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone"), "the bottom sheet is the phone layout");
  test.setTimeout(240_000);
  await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  const p = panel(page);
  await expect(p).toHaveAttribute("data-panel", "open");
  await expect(p).toHaveAttribute("data-snap", "half");
  const vh = page.viewportSize()!.height;
  const top = async () => Math.round((await p.boundingBox())!.y);
  await expect.poll(top).toBeGreaterThan(vh * 0.45);
  await expect.poll(top).toBeLessThan(vh * 0.55);
  // Its header keeps the total and Google Maps in reach at every height.
  await expect(p.locator("[data-summary]")).toContainText(/\d+ MIN WALK · OPEN TILL 8 PM/);
  await expect(p.getByRole("link", { name: "Google Maps", exact: true })).toBeInViewport();
  await page.screenshot({ path: `test-results/shots/visit-5-${info.project.name}-sheet.png` });

  // The handle steps it up.
  const handle = p.getByRole("button", { name: /directions/i }).first();
  await handle.click();
  await expect(p).toHaveAttribute("data-snap", "full");
  await expect.poll(top).toBeLessThan(vh * 0.12);
  // A receipt line brings it back down, so the spot can be seen.
  await p.getByRole("button", { name: /^Step 2: / }).click();
  await expect(p).toHaveAttribute("data-snap", "half");
  await expect(mapRegion(page)).toHaveAttribute("data-look", "1");

  // Dragged down, it rests as a 96 px peek.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, vh - 20, { steps: 8 });
  await page.mouse.up();
  await expect(p).toHaveAttribute("data-snap", "peek");
  await expect.poll(top).toBe(vh - 96);
  await expect(p.getByRole("link", { name: "Google Maps", exact: true })).toBeInViewport();

  // The way back is in the sheet.
  await handle.click();
  await expect(p).toHaveAttribute("data-snap", "half");
  await p.getByRole("button", { name: /The store/ }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
});

// ---------- Phase 6: step inside, the fallbacks, the keyboard, and "From my location" ----------

test("step inside: the camera goes through the door, the tour opens at its entrance on that frame, and Back returns to the store @phone", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await page.locator("[data-hero-action=inside]").click();
  await expect(stage(page)).toHaveAttribute("data-stage", "inside");
  await expect(page).toHaveURL(/\/visit\/tour#enter$/, { timeout: 60_000 });
  const tour = page.getByRole("region", { name: "Virtual tour" });
  // It starts inside the door, not out on the street, and shows the hero's last frame until the store has drawn.
  await expect(tour).toHaveAttribute("data-chapter", "enter", { timeout: 5_000 });
  await expect(tour.locator("[data-door-poster]")).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect(tour).toHaveAttribute("data-tour-state", "ready", { timeout: 60_000 });
  await expect(tour).toHaveAttribute("data-chapter", "enter");

  await page.goBack();
  await expect(page).toHaveURL(/\/visit\?/);
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  expect(errors()).toEqual([]);
});

test("fallbacks: the light version and no WebGL get the directions over a still of the route; reduced motion gets the finished map", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const heavy: string[] = [];
  page.on("request", (r) => /maplibre|pmtiles|land\.json|google\.com\/maps\?/.test(r.url()) && heavy.push(r.url()));

  // Light (Save-Data, a slow connection, little memory) and no WebGL: the poster on the first
  // screen; In person opens the receipt and the rest over one small picture of the route.
  for (const [name, query] of [
    ["lite", "lite=1"],
    ["nowebgl", "gl=off"],
  ]) {
    await page.goto(`/visit?preview=open&${query}&now=${at("2026-10-07T12:00+05:45")}`);
    await expect(stage(page)).toHaveAttribute("data-fallback", name);
    await expect(page.locator("[data-hero-poster]")).toBeVisible();
    await expect(page.locator("[data-hero-canvas] canvas")).toHaveCount(0);
    await page.getByRole("link", { name: "In person" }).click();
    await expect(stage(page)).toHaveAttribute("data-stage", "map");
    await expect(page).toHaveURL(/#find-us$/);
    const p = panel(page);
    await expect(p).toHaveAttribute("data-panel", "open");
    await expect(p.getByText("QUEUE", { exact: true })).toBeVisible();
    await expect(p.locator("[data-step=dim]")).toHaveCount(0);
    await expect(p.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
    // Nothing to replay and no map to point at.
    await expect(p.getByRole("button", { name: "Replay" })).toHaveCount(0);
    await expect(page.locator("[data-skip]")).toHaveCount(0);
    const still = page.locator("[data-find-us] [data-route-static]");
    await expect(still).toBeVisible();
    await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);
    await expect(page.locator("[data-find-us] canvas")).toHaveCount(0);
    await page.screenshot({ path: `test-results/shots/visit-${info.project.name}-${name}.png` });
    // Escape goes back to the first screen.
    await page.keyboard.press("Escape");
    await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  }
  expect(heavy).toEqual([]);
  // The Virtual tour still opens at the tour's entrance.
  await page.locator("[data-hero-action=inside]").click();
  await expect(page).toHaveURL(/\/visit\/tour#enter$/);

  // Reduced motion: no door, no dolly, no flight. The map opens on the finished route.
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const calm = await ctx.newPage();
  await calm.goto(`/visit?${OPEN}`);
  await expect(stage(calm)).toHaveAttribute("data-fallback", "reduced");
  await expect(stage(calm)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await calm.getByRole("link", { name: "In person" }).click();
  await expect(stage(calm)).toHaveAttribute("data-map-state", "done", { timeout: 60_000 });
  await expect(panel(calm).getByText("QUEUE", { exact: true })).toBeVisible();
  await expect(panel(calm).locator("[data-step=dim]")).toHaveCount(0);
  await expect(panel(calm).getByRole("link", { name: "Open in Google Maps" })).toBeVisible();
  await calm.screenshot({ path: `test-results/shots/visit-6-${info.project.name}-reduced.png` });
  await calm.keyboard.press("Escape");
  await expect(stage(calm)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await calm.locator("[data-hero-action=inside]").click();
  await expect(stage(calm)).not.toHaveAttribute("data-stage", "inside");
  await expect(calm).toHaveURL(/\/visit\/tour#enter$/);
  await ctx.close();
});

test("keyboard: Find us opens the map from the keyboard, focus goes to the directions and comes back, and every target is big enough", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  // The store is a picture: nothing in it takes the keyboard.
  await expect(page.locator("[data-hero-canvas]")).toHaveAttribute("aria-hidden", "true");
  const find = page.getByRole("link", { name: "In person" });
  await find.focus();
  await page.keyboard.press("Enter");
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  const p = panel(page);
  await expect(p.getByRole("heading", { name: "Directions" })).toBeFocused();
  // One message for screen readers when the route is ready.
  await expect(page.locator("[data-find-us] [aria-live=polite]")).toContainText(/The route is on the map/);

  // Tab reaches the panel's controls, and each shows where the keyboard is.
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  expect(await focused.evaluate((el) => getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none")).toBe(true);

  // Everything that can be tapped is at least 44 px in one direction and 40 in the other.
  const small = await page.locator("[data-find-us]").evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("a[href], button")]
      .filter((el) => el.offsetParent !== null && !el.closest(".maplibregl-ctrl") && !el.classList.contains("sr-only"))
      .map((el) => ({ name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((b) => b.h < 44 || b.w < 40),
  );
  expect(small).toEqual([]);

  // Escape closes the map and hands the keyboard back to the link that opened it.
  await page.keyboard.press("Escape");
  await expect(stage(page)).toHaveAttribute("data-stage", "hero");
  await expect(find).toBeFocused();
});

test("from my location: asked only on a tap, drawn on the map, and never sent anywhere", async ({ browser }) => {
  test.setTimeout(240_000);
  const here = { latitude: 27.68512, longitude: 85.31534 };
  const ctx = await browser.newContext({ permissions: ["geolocation"], geolocation: here });
  const page = await ctx.newPage();
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  // Only this site may ask the browser, never a frame from somewhere else.
  const res = await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  expect(res!.headers()["permissions-policy"]).toContain("geolocation=(self)");
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  const p = panel(page);
  await expect(p.locator("[data-me]")).toHaveCount(0);
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(0);

  const chip = p.getByRole("button", { name: "From my location" });
  await chip.click();
  await expect(p.locator("[data-me=shown]")).toContainText(/You're about [\d.]+ (m|km) from the door/);
  await expect(p.locator("[data-me]").getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", /destination=[\d.]+,[\d.]+&travelmode=walking$/);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(1);
  // Where they are stays in the page: not in the address, storage, or any request.
  const kept = await page.evaluate(() => `${location.href} ${JSON.stringify({ ...localStorage })} ${JSON.stringify({ ...sessionStorage })} ${document.cookie}`);
  expect(kept).not.toMatch(/27\.685|85\.315/);
  expect(sent.filter((s) => /27\.685|85\.315/.test(s))).toEqual([]);
  expect(await p.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")).join(" "))).not.toMatch(/27\.685|85\.315/);

  // A second tap forgets it.
  await chip.click();
  await expect(p.locator("[data-me]")).toHaveCount(0);
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(0);
  await ctx.close();

  // Refused (or unavailable): a plain message and the Google Maps link.
  const no = await browser.newContext();
  const other = await no.newPage();
  await other.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(stage(other)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  await panel(other).getByRole("button", { name: "From my location" }).click();
  await expect(panel(other).locator("[data-me=failed]")).toContainText("Couldn't get your location", { timeout: 15_000 });
  await expect(panel(other).locator("[data-me]").getByRole("link", { name: "Google Maps" })).toBeVisible();
  await no.close();
});

test("in person: the tap asks where you are, and the route starts from the start point nearest you", async ({ browser }) => {
  test.setTimeout(240_000);
  // Beside the sample route's far end, so the nearest start point is not the first one listed.
  const here = { latitude: 27.6772, longitude: 85.3138 };
  const ctx = await browser.newContext({ permissions: ["geolocation"], geolocation: here });
  const page = await ctx.newPage();
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(stage(page)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await page.getByRole("link", { name: "In person" }).click();
  await expect(stage(page)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  const p = panel(page);
  await expect(p.locator("[data-me=shown]")).toContainText(/You're about [\d.]+ (m|km) from the door/);
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(1);
  await expect(p.getByRole("button", { name: "From my location" })).toHaveAttribute("aria-pressed", "true");
  // One start point is chosen, and it's the one nearest to them, not simply the first.
  const chips = p.getByRole("radiogroup", { name: "Coming from" }).getByRole("radio");
  await expect(chips.and(page.locator("[aria-checked=true]"))).toHaveCount(1);
  await expect(chips.first()).toHaveAttribute("aria-checked", "false");
  await expect(p.locator("[data-step=dim]")).toHaveCount(0);
  expect(sent.filter((s) => /27\.677|85\.313/.test(s))).toEqual([]);
  await ctx.close();

  // Without permission the tap says nothing about it: the route simply starts from the first start point.
  const no = await browser.newContext();
  const other = await no.newPage();
  await other.goto(`/visit?${OPEN}&motion=fast`);
  await expect(stage(other)).toHaveAttribute("data-3d", "on", { timeout: 60_000 });
  await other.getByRole("link", { name: "In person" }).click();
  await expect(stage(other)).toHaveAttribute("data-map-state", "done", { timeout: 90_000 });
  await expect(panel(other).locator("[data-me=failed]")).toHaveCount(0);
  await expect(panel(other).getByRole("radiogroup", { name: "Coming from" }).getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  await no.close();
});
