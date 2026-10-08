import { expect, test, type Page } from "@playwright/test";

// Live try-on (src/components/try-on-live.tsx): the owner switches it on for one piece in admin;
// that piece's page then offers "Try it on live". Anywear's script and the camera are allowed on
// one address only (the product page with ?try=1), and nothing of theirs loads before the shopper asks.
// The widget itself is never fetched here: its address is answered with an empty script.

const ORIGIN = "https://anywear.decart.ai";

async function ownerSignIn(page: Page) {
  await expect(async () => {
    await page.goto("/admin");
    if (/\/admin$/.test(page.url())) return;
    await page.getByLabel("Username").fill("e2e-owner");
    await page.getByLabel("Password", { exact: true }).fill("e2e-owner-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForTimeout(1500);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 });
  }).toPass({ timeout: 90_000 });
}

async function setTryOn(page: Page, on: boolean) {
  await page.goto("/admin/products/coach-jacket");
  await page.getByLabel(/Offer .Try it on live. on this piece/).setChecked(on);
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText("Saved.").first()).toBeVisible();
}

test("live try-on: on for one piece only, and their script and the camera only where the shopper asked", async ({ page }) => {
  test.setTimeout(180_000);
  const asked: string[] = [];
  await page.route(`${ORIGIN}/**`, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await ownerSignIn(page);
  await setTryOn(page, true);

  // The piece's page: the offer, a line about the camera, and nothing of Anywear's yet.
  const plain = await page.goto("/product/coach-jacket");
  const offer = page.locator("[data-try-on-live]");
  await expect(offer).toHaveAttribute("data-try-on-live", "off");
  await expect(offer.getByRole("link", { name: "Try it on live" })).toHaveAttribute("href", "/product/coach-jacket?try=1");
  await expect(offer).toContainText("Uses your camera.");
  expect(plain!.headers()["content-security-policy"]).not.toContain(ORIGIN);
  expect(plain!.headers()["permissions-policy"]).toContain("camera=()");
  expect(asked).toEqual([]);

  // Asked for: a full page load of the try-on address, which alone carries the wider permissions.
  const [wide] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/product/coach-jacket?try=1") && r.request().isNavigationRequest()), offer.getByRole("link", { name: "Try it on live" }).click()]);
  const csp = wide.headers()["content-security-policy"];
  expect(csp).toMatch(new RegExp(`script-src [^;]*${ORIGIN}`));
  expect(csp).toMatch(new RegExp(`frame-src [^;]*${ORIGIN}`));
  expect(wide.headers()["permissions-policy"]).toContain(`camera=(self "${ORIGIN}")`);
  expect(wide.headers()["permissions-policy"]).toContain("microphone=()");
  await expect(offer).toHaveAttribute("data-try-on-live", "on");
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked[0]).toMatch(/\/widget\/latest\/anywear\.js\?domain=localhost$/);

  // Other pieces, and other pages, are untouched: no offer, and the mark in the address changes nothing.
  const other = await page.goto("/shop?try=1");
  expect(other!.headers()["content-security-policy"]).not.toContain(ORIGIN);
  expect(other!.headers()["permissions-policy"]).toContain("camera=()");

  // Switched off again, the offer goes.
  await setTryOn(page, false);
  await page.goto("/product/coach-jacket");
  await expect(page.locator("[data-try-on-live]")).toHaveCount(0);
});
