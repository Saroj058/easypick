// Where each person's bag is kept in the browser. The bag lives in localStorage, keyed per
// signed-in account, so two people sharing a phone never see each other's bag.

/** The old single key, from before bags were kept per account. */
export const LEGACY_BAG_KEY = "ep-bag-v1";

/** Short, stable, non-reversible tag for an account id (FNV-1a, 32-bit, base 36). */
export function hashId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The storage key for this account's bag. */
export function bagStorageKey(userId: string): string {
  return `${LEGACY_BAG_KEY}:${hashId(userId)}`;
}
