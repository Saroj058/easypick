import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares a secret someone sent with the real one, in constant time. Both are hashed first,
 * so different lengths neither throw nor leak through timing.
 */
export function sameSecret(given: string | null | undefined, secret: string): boolean {
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) && typeof given === "string";
}
