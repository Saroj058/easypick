import { expect, test, type Page } from "@playwright/test";

// The Visit page's film (src/components/visit/visit-film.tsx): the Earth from orbit, then one
// scroll (or one tap on In person) down through the clouds into Kathmandu, along the route, to the
// door and the directions. Runs in the 3D projects (software WebGL): see WEBGL_SPECS in
// playwright.config.ts. ?motion=fast plays it eight times faster; ?tiles=fixture keeps the real
// map file out of tests; ?now= pins the clock; ?t= opens on a second of the film.

const at = (iso: string) => encodeURIComponent(iso);
const OPEN = `preview=open&tiles=fixture&now=${at("2026-10-07T12:00+05:45")}`;
const film = (page: Page) => page.locator("[data-film]");
const mapRegion = (page: Page) => page.getByRole("region", { name: /^Map: / });
const panel = (page: Page) => page.locator("[data-panel]");
const inPerson = (page: Page) => page.locator("[data-action=in-person]");

/** Console errors, to prove the page is clean. */
function collect(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return () => errors.filter((e) => !/Download the React DevTools|favicon/.test(e));
}

/** Scroll to a second of the film (the page's scroll is its clock). */
const scrollTo = (page: Page, second: number) =>
  page.evaluate((s) => {
    const root = document.querySelector<HTMLElement>("[data-film]")!;
    window.scrollTo({ top: root.offsetTop + (s / 20) * (root.offsetHeight - window.innerHeight), behavior: "instant" });
  }, second);

test("first screen: the live Earth takes over from the still, by day and by night @phone", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  for (const [name, hour] of [
    ["day", "12:00"],
    ["night", "22:30"],
  ]) {
    await page.goto(`/visit?preview=open&tiles=fixture&now=${at(`2026-10-07T${hour}+05:45`)}`);
    // The still for this hour is there first; the live Earth draws over it.
    await expect(page.locator("img[data-poster]")).toHaveAttribute("src", new RegExp(`earth-${name}`));
    await expect(film(page)).toHaveAttribute("data-film", "on");
    await expect(film(page)).toHaveAttribute("data-fallback", "none");
    await expect(film(page)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
    await expect(film(page).locator("canvas").first()).toBeVisible();
    await expect(film(page)).toHaveAttribute("data-scene", "orbit");
    // Nothing of the map is loaded until it's wanted.
    await expect(film(page)).toHaveAttribute("data-map-state", "idle");
    await expect(page.locator("[data-ktm-clock]").first()).toHaveText(hour);
    await page.screenshot({ path: `test-results/shots/film-${info.project.name}-orbit-${name}.png` });
  }
  expect(errors()).toEqual([]);
});

test("in person: one tap plays the film from orbit to the door and ends on the directions @phone", async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = collect(page);
  const refused: string[] = [];
  page.on("console", (m) => /Refused|Content Security Policy/i.test(m.text()) && refused.push(m.text()));
  const mapRequests: string[] = [];
  page.on("request", (r) => /maplibre|pmtiles/.test(r.url()) && mapRequests.push(r.url()));

  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(film(page)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
  expect(mapRequests).toEqual([]);

  await inPerson(page).click();
  // It runs by itself all the way down: the scenes pass and the directions come in.
  await expect(film(page)).toHaveAttribute("data-scene", "arrive", { timeout: 180_000 });
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 60_000 });
  await expect(film(page)).toHaveAttribute("data-playing", "false");
  await expect(mapRegion(page).locator("canvas")).toBeVisible();
  await expect(mapRegion(page).locator("[data-map-pin]")).toBeVisible();
  await expect(mapRegion(page).getByText(/© OpenStreetMap/)).toBeVisible();
  // The directions: every receipt line lit, and the way into Google Maps as a plain link.
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).locator("[data-step]")).toHaveCount(3);
  await expect(panel(page).locator("[data-step=dim]")).toHaveCount(0);
  await expect(panel(page).getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=[\d.]+,[\d.]+&travelmode=walking/);
  // Test runs never fetch the real map file.
  expect(mapRequests.some((u) => u.includes("supabase"))).toBe(false);
  expect(mapRequests.some((u) => u.endsWith("/map/fixture.pmtiles"))).toBe(true);
  await page.screenshot({ path: `test-results/shots/film-${info.project.name}-directions.png` });

  // Escape goes back to the top of the film: the Earth, and the two choices.
  await page.keyboard.press("Escape");
  await expect(film(page)).toHaveAttribute("data-scene", "orbit", { timeout: 30_000 });
  await expect(inPerson(page)).toBeVisible();
  expect(refused).toEqual([]);
  expect(errors()).toEqual([]);
});

test("the scroll is the film: forwards, backwards, and straight to a scene", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.goto(`/visit?${OPEN}`);
  await expect(film(page)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
  const caption = page.locator("[data-caption]");

  // Down a little: falling towards Nepal, with the first line of the story and the height counting down.
  await scrollTo(page, 3);
  await expect(film(page)).toHaveAttribute("data-scene", "approach", { timeout: 30_000 });
  await expect(caption).toContainText("Somewhere on Earth.");
  await expect(page.locator("[data-altitude]")).toHaveText(/[\d,.]+ KM/);
  await page.screenshot({ path: `test-results/shots/film-${info.project.name}-approach.png` });

  // Further: through the cloud into the city, then along the route (the caption is the step being walked).
  await scrollTo(page, 9);
  await expect(film(page)).toHaveAttribute("data-scene", "valley", { timeout: 60_000 });
  await expect(film(page)).toHaveAttribute("data-map-state", "ready", { timeout: 90_000 });
  await expect(caption).toContainText("In one valley.");
  await scrollTo(page, 15);
  await expect(film(page)).toHaveAttribute("data-scene", "route", { timeout: 30_000 });
  await expect(caption).toContainText(/Jhamsikhel Chowk|West, past the café row|Black shutter/);
  await expect(page.locator("[data-altitude]")).toHaveText(/[\d,.]+ (M|KM)/);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `test-results/shots/film-${info.project.name}-route.png` });
  // Nothing plays by itself while the visitor is scrolling, and the directions wait for the end.
  await expect(film(page)).toHaveAttribute("data-playing", "false");
  await expect(panel(page)).toHaveAttribute("data-panel", "closed");

  // Back up: the film runs backwards, out of the city to the Earth.
  await scrollTo(page, 5);
  await expect(film(page)).toHaveAttribute("data-scene", "approach", { timeout: 30_000 });
  await expect(caption).toContainText("Under the mountains.");

  // The rail goes straight to a scene; Directions goes straight to the end.
  await page.getByRole("button", { name: "Go to The door" }).click();
  await expect(film(page)).toHaveAttribute("data-scene", "door", { timeout: 30_000 });
  await expect(caption).toContainText("One door.");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `test-results/shots/film-${info.project.name}-door.png` });
  await page.locator("[data-skip]").click();
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 30_000 });
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
});

test("a direct link opens on the directions; before opening day the map shows the area only", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/visit?${OPEN}#find-us`);
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
  await expect(panel(page)).toHaveAttribute("data-panel", "open");
  await expect(panel(page).locator("[data-step=dim]")).toHaveCount(0);

  // Not opened yet: no pin, no route, no Google Maps; the area and the opening list.
  await page.goto("/visit?tiles=fixture&motion=fast");
  await expect(film(page)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
  await inPerson(page).click();
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 180_000 });
  await expect(panel(page).getByText("Exact address coming soon")).toBeVisible();
  await expect(mapRegion(page).locator("[data-map-pin]")).toHaveCount(0);
  await expect(panel(page).getByRole("link", { name: "Open in Google Maps" })).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Join the opening list" }).click();
  await expect(film(page)).toHaveAttribute("data-scene", "orbit", { timeout: 30_000 });
  await expect(page.getByText("Join the opening list").first()).toBeVisible();
});

test("directions: start chips redraw the route, modes change the minutes, a receipt line moves the map, and every action is a plain link", async ({ page, context }, info) => {
  test.setTimeout(240_000);
  const errors = collect(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
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
  await expect(p).toHaveAttribute("data-panel", "open"); // the panel stays put
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

  // A receipt line shows that spot on the map (the film is over, so the map is the visitor's).
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
  // Parking is marked on the map; how the store works and the week's hours are in the panel.
  await expect(mapRegion(page).locator("[data-map-parking]")).toHaveCount(2);
  await expect(p.locator("[data-inside]").getByText("Pay it.")).toBeAttached();
  await expect(p.locator("[data-hours] tr")).toHaveCount(7);
  // For review, not a baseline.
  await p.screenshot({ path: `test-results/shots/film-${info.project.name}-panel.png` });
  expect(errors()).toEqual([]);
});

test("directions: on a phone it's a sheet that opens at half, goes nearly full and down to a peek, and has the way back @phone", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone"), "the bottom sheet is the phone layout");
  test.setTimeout(240_000);
  await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
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

  // The way back is in the sheet: up to the Earth and the two choices.
  await handle.click();
  await expect(p).toHaveAttribute("data-snap", "half");
  await p.getByRole("button", { name: /The store/ }).click();
  await expect(film(page)).toHaveAttribute("data-scene", "orbit", { timeout: 30_000 });
});

test("fallbacks: the light version and no WebGL get a still and the directions; reduced motion skips the flight", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const heavy: string[] = [];
  page.on("request", (r) => /maplibre|pmtiles|earth\/(day|night|clouds)|google\.com\/maps\?/.test(r.url()) && heavy.push(r.url()));

  // Light (Save-Data, a slow connection, little memory) and no WebGL: a still of the Earth on the
  // first screen, no film to scroll; In person opens the directions over one small picture of the route.
  for (const [name, query] of [
    ["lite", "lite=1"],
    ["nowebgl", "gl=off"],
  ]) {
    await page.goto(`/visit?preview=open&${query}&now=${at("2026-10-07T12:00+05:45")}`);
    await expect(film(page)).toHaveAttribute("data-fallback", name);
    await expect(film(page)).toHaveAttribute("data-film", "off");
    await expect(page.locator("img[data-poster]")).toBeVisible();
    await expect(film(page).locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await inPerson(page).click();
    await expect(page.locator("[data-plain]")).toBeVisible();
    const p = panel(page);
    await expect(p).toHaveAttribute("data-panel", "open");
    await expect(p.getByText("QUEUE", { exact: true })).toBeVisible();
    await expect(p.locator("[data-step=dim]")).toHaveCount(0);
    await expect(p.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
    // Nothing to replay and no map to point at.
    await expect(p.getByRole("button", { name: "Replay" })).toHaveCount(0);
    const still = page.locator("[data-plain] [data-route-static]");
    await expect(still).toBeVisible();
    await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);
    await page.screenshot({ path: `test-results/shots/film-${info.project.name}-${name}.png` });
    // Escape goes back to the first screen.
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-plain]")).toHaveCount(0);
  }
  expect(heavy).toEqual([]);

  // Reduced motion: the Earth is there but nothing flies. In person goes straight to the finished directions.
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const calm = await ctx.newPage();
  await calm.goto(`/visit?${OPEN}`);
  await expect(film(calm)).toHaveAttribute("data-fallback", "reduced");
  await expect(film(calm)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
  await inPerson(calm).click();
  await expect(film(calm)).toHaveAttribute("data-playing", "false");
  await expect(film(calm)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
  await expect(panel(calm).getByText("QUEUE", { exact: true })).toBeVisible();
  await expect(panel(calm).locator("[data-step=dim]")).toHaveCount(0);
  await ctx.close();
});

test("keyboard: In person plays from the keyboard, focus goes to the directions and comes back, and every target is big enough", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/visit?${OPEN}&motion=fast`);
  await expect(film(page)).toHaveAttribute("data-earth", "on", { timeout: 90_000 });
  // The pictures take no keyboard.
  await expect(film(page).locator("canvas").first()).toHaveAttribute("aria-hidden", "true");
  await inPerson(page).focus();
  await page.keyboard.press("Enter");
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 180_000 });
  const p = panel(page);
  await expect(p.getByRole("heading", { name: "Directions" })).toBeFocused();
  // One message for screen readers when the directions are ready.
  await expect(film(page).locator("[aria-live=polite]").last()).toContainText(/Directions to Easypick: about \d+ minutes on foot/);

  // Everything that can be tapped in the directions is at least 44 px in one direction and 40 in the other.
  const small = await p.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("a[href], button")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((b) => b.h < 44 || b.w < 40),
  );
  expect(small).toEqual([]);

  // Escape goes back to the top and hands the keyboard back to the choice that started it.
  await page.keyboard.press("Escape");
  await expect(film(page)).toHaveAttribute("data-scene", "orbit", { timeout: 30_000 });
  await expect(inPerson(page)).toBeFocused();
});

test("from my location: drawn on the map, the route starts from the nearest start point, and it's never sent anywhere", async ({ browser }) => {
  test.setTimeout(300_000);
  // Beside the sample Pulchowk start, so the nearest start point is not the first one listed.
  const here = { latitude: 27.6772, longitude: 85.3138 };
  const ctx = await browser.newContext({ permissions: ["geolocation"], geolocation: here });
  const page = await ctx.newPage();
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  // Only this site may ask the browser, never a frame from somewhere else.
  const res = await page.goto(`/visit?${OPEN}&motion=fast#find-us`);
  expect(res!.headers()["permissions-policy"]).toContain("geolocation=(self)");
  await expect(film(page)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
  const p = panel(page);
  // A direct link asks nothing by itself.
  await expect(p.locator("[data-me]")).toHaveCount(0);
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(0);

  const chip = p.getByRole("button", { name: "From my location" });
  await chip.click();
  await expect(p.locator("[data-me=shown]")).toContainText(/You're about [\d.]+ (m|km) from the door/);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(1);
  const chips = p.getByRole("radiogroup", { name: "Coming from" }).getByRole("radio");
  await expect(chips.and(page.locator("[aria-checked=true]"))).toHaveCount(1);
  await expect(chips.first()).toHaveAttribute("aria-checked", "false");
  // Where they are stays in the page: not in the address, storage, or any request.
  const kept = await page.evaluate(() => `${location.href} ${JSON.stringify({ ...localStorage })} ${JSON.stringify({ ...sessionStorage })} ${document.cookie}`);
  expect(kept).not.toMatch(/27\.677|85\.313/);
  expect(sent.filter((s) => /27\.677|85\.313/.test(s))).toEqual([]);
  expect(await p.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")).join(" "))).not.toMatch(/27\.677|85\.313/);
  // A second tap forgets it.
  await chip.click();
  await expect(p.locator("[data-me]")).toHaveCount(0);
  await expect(mapRegion(page).locator("[data-map-me]")).toHaveCount(0);
  await ctx.close();

  // Refused (or unavailable): a plain message and the Google Maps link.
  const no = await browser.newContext();
  const other = await no.newPage();
  await other.goto(`/visit?${OPEN}&motion=fast#find-us`);
  await expect(film(other)).toHaveAttribute("data-map-state", "done", { timeout: 120_000 });
  await panel(other).getByRole("button", { name: "From my location" }).click();
  await expect(panel(other).locator("[data-me=failed]")).toContainText("Couldn't get your location", { timeout: 15_000 });
  await expect(panel(other).locator("[data-me]").getByRole("link", { name: "Google Maps" })).toBeVisible();
  await no.close();
});
