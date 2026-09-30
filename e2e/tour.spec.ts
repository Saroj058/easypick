import { expect, test } from "@playwright/test";

test("virtual tour: scrolling walks the plan stop by stop @phone", async ({ page }, info) => {
  await page.goto("/visit/tour");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Walk the store/i);
  const plan = page.getByRole("img", { name: /Floor plan/ });
  await expect(plan).toHaveAttribute("aria-label", /Aaunus/);
  await page.screenshot({ path: `test-results/shots/tour-start-${info.project.name}.png` });

  // Scroll to the kiosk: the plan follows.
  await page.locator("#kiosk").scrollIntoViewIfNeeded();
  await page.locator("#kiosk").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(plan).toHaveAttribute("aria-label", /Pay it/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/tour-kiosk-${info.project.name}.png` });

  // The stop buttons jump straight to a stop.
  await page.getByRole("button", { name: /Go to stop 7/ }).click();
  await expect(plan).toHaveAttribute("aria-label", /Wear it/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/tour-exit-${info.project.name}.png` });
});
