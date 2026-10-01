import { expect, test } from "@playwright/test";

// The tour is the page's scroll: the store fills the window and scrolling walks through it.
// Headless Chrome draws WebGL in software (slowly), so these tests go from stop to stop with the
// buttons and give the walk time to arrive.

test("walk the store: full screen, the scroll is the walk, and it can walk itself @phone", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/visit/tour");
  const tour = page.getByRole("region", { name: "Virtual tour" });

  // Nothing but the tour: no site header, no footer, no tab bar. The way out is the cross.
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(tour.getByRole("link", { name: "Close the tour" })).toHaveAttribute("href", "/visit");

  // The 3D canvas loads and waits at the street: nothing moves until you scroll.
  await expect(tour.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(tour).toHaveAttribute("data-tour-state", "ready", { timeout: 60_000 });
  await expect(tour).toHaveAttribute("data-chapter", "street");
  await expect(tour.getByText("Scroll to walk in")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/tour-0-street-${info.project.name}.png` });

  // Scrolling the page walks in.
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * 0.21, behavior: "instant" }));
  await expect(tour).toHaveAttribute("data-chapter", "enter", { timeout: 30_000 });
  await expect(tour.getByText("Just looking?").first()).toBeVisible();

  // Each stop's button goes there, and the line follows.
  const captions: [string, string, string][] = [
    ["Pick", "pick", "Fixed price."],
    ["Try", "try", "Take a token."],
    ["Pay", "pay", "Scan with eSewa."],
    ["Pickup", "pickup", "Collect here."],
    ["Out", "out", "Wear it."],
  ];
  for (const [name, id, caption] of captions) {
    await tour.getByRole("button", { name: new RegExp(`^Stop \\d: ${name}$`) }).click();
    await expect(tour).toHaveAttribute("data-chapter", id, { timeout: 30_000 });
    await expect(tour.getByText(caption).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/tour-${id}-${info.project.name}.png` });
  }

  // The end of the walk says where to go next.
  await expect(tour).toHaveAttribute("data-tour-state", "ended", { timeout: 30_000 });
  await expect(tour.getByRole("link", { name: "Visit the store" })).toHaveAttribute("href", "/visit");
  await expect(tour.getByRole("link", { name: "Shop the drop" })).toHaveAttribute("href", "/shop");

  // It can walk itself, from the street again, and pauses when asked.
  await tour.getByRole("button", { name: "Walk it again" }).click();
  await expect(tour).toHaveAttribute("data-tour-state", "playing");
  await expect(tour).toHaveAttribute("data-chapter", "street");
  await tour.getByRole("button", { name: "Pause" }).click();
  await expect(tour).not.toHaveAttribute("data-tour-state", "playing");
  expect(errors.filter((e) => !/Download the React DevTools|favicon/.test(e))).toEqual([]);
});

test("walk the store: with motion turned off nothing walks by itself, and the stops are stepped through", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/visit/tour");
  const tour = page.getByRole("region", { name: "Virtual tour" });
  await expect(tour.getByRole("button", { name: "Next stop" })).toBeVisible({ timeout: 60_000 });
  await expect(tour.getByRole("button", { name: /Walk it for me|Pause/ })).toHaveCount(0);
  await tour.getByRole("button", { name: "Next stop" }).click();
  await expect(tour).toHaveAttribute("data-chapter", "enter");
  await expect(tour.getByText("Just looking?").first()).toBeVisible();
  await ctx.close();
});
