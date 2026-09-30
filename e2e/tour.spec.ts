import { expect, test } from "@playwright/test";

const STOPS = ["street", "enter", "pick", "try", "pay", "pickup", "out"];

test("walk the store: scrolling moves through the stops, with real text at each @phone", async ({ page }, info) => {
  test.setTimeout(240_000); // headless Chrome draws WebGL in software, slowly
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/visit/tour");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Walk the store/i);
  // Every stop is readable text, in order, whatever the device does with the 3D.
  for (const id of STOPS) await expect(page.locator(`#${id} h2`)).toHaveCount(1);

  // The 3D canvas loads (headless Chrome has WebGL) and draws.
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.locator('section[aria-label="Virtual tour"]').evaluate((el) => window.scrollTo(0, (el as HTMLElement).offsetTop));
  await page.waitForTimeout(4000); // the canvas fades in over the poster
  await page.screenshot({ path: `test-results/shots/walk-0-street-${info.project.name}.png` });

  // The arrows walk you to the next stop, and the counter follows.
  for (let i = 1; i < STOPS.length; i++) {
    await page.getByRole("button", { name: "Next stop" }).click();
    await expect(page.getByRole("navigation", { name: "Tour" })).toContainText(`0${i + 1} / 07`);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `test-results/shots/walk-${i}-${STOPS[i]}-${info.project.name}.png` });
  }
  await expect(page).toHaveURL(/#out$/);
  await expect(page.locator("#tour-end")).toContainText(/Shop online now/);
  expect(errors.filter((e) => !/Download the React DevTools|favicon/.test(e))).toEqual([]);
});

test("walk the store: reduced motion still works, and nothing moves on its own", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/visit/tour#pay");
  await expect(page.locator("#pay h2")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pause motion/ })).toHaveCount(0);
  await ctx.close();
});
