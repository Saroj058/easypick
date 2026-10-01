import { expect, test } from "@playwright/test";

// The tour is a film on a clock. Headless Chrome draws WebGL in software (slowly), so these tests
// jump between chapters with the buttons instead of waiting for the film to get there.

test("walk the store: the film plays, pauses and jumps between its chapters @phone", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/visit/tour");
  const tour = page.getByRole("region", { name: "Virtual tour" });
  // Nothing but the film: no intro, no end block.
  await expect(page.getByText(/Scroll to walk in/)).toHaveCount(0);
  await expect(page.getByText(/END OF THE WALK|Get the opening-day SMS|Share the tour|Walk it again/)).toHaveCount(0);

  // The 3D canvas loads and the film starts by itself.
  await expect(tour.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(tour).toHaveAttribute("data-tour-state", "playing", { timeout: 60_000 });
  await expect(tour).toHaveAttribute("data-chapter", "street");
  await page.screenshot({ path: `test-results/shots/film-0-street-${info.project.name}.png` });

  // The button pauses and plays.
  await tour.getByRole("button", { name: "Pause" }).click();
  await expect(tour).toHaveAttribute("data-tour-state", "paused");
  await tour.getByRole("button", { name: "Play", exact: true }).click();
  await expect(tour).toHaveAttribute("data-tour-state", "playing");

  // Each chapter button jumps there, and the caption follows.
  const captions: [string, string, RegExp][] = [
    ["Pick", "pick", /Fixed price\. Size in cm\./],
    ["Try", "try", /Take a token/],
    ["Pay", "pay", /Scan with eSewa/],
    ["Pickup", "pickup", /Collect here/],
    ["Out", "out", /Pick it\. Pay it\. Wear it\./],
  ];
  for (const [name, id, caption] of captions) {
    await tour.getByRole("button", { name: new RegExp(`^Stop \\d: ${name}$`) }).click();
    await expect(tour).toHaveAttribute("data-chapter", id);
    await expect(tour.getByText(caption).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/film-${id}-${info.project.name}.png` });
  }
  expect(errors.filter((e) => !/Download the React DevTools|favicon/.test(e))).toEqual([]);
});

test("walk the store: with motion turned off nothing plays on its own, and the stops are stepped through", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/visit/tour");
  const tour = page.getByRole("region", { name: "Virtual tour" });
  await expect(tour.getByRole("button", { name: "Next stop" })).toBeVisible({ timeout: 60_000 });
  await expect(tour.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await expect(tour).not.toHaveAttribute("data-tour-state", "playing");
  await tour.getByRole("button", { name: "Next stop" }).click();
  await expect(tour).toHaveAttribute("data-chapter", "enter");
  await expect(tour.getByText("Just looking? Perfect.").first()).toBeVisible();
  await ctx.close();
});
