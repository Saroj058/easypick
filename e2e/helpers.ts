/**
 * A fresh valid-looking Nepali mobile number ("98" + 8 random digits) for each test, so repeated
 * runs against the same e2e database don't hit the per-number code and order limits.
 */
export function randomPhone(): string {
  return `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}
