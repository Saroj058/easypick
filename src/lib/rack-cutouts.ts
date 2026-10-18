/**
 * The pieces with a cut-out photo made by hand (public/rack/<slug>.webp, by scripts/rack-cutouts.mjs).
 * Since 18 Oct 2026 a cut-out can also be uploaded per piece in Admin → Photos; cutoutOf() picks
 * the uploaded one first.
 */
export const RACK_CUTOUTS = new Set([
  "boxy-pocket-tee",
  "brushed-crewneck",
  "coach-jacket",
  "everyday-hoodie",
  "fleece-quarter-zip",
  "oversized-heavy-tee",
  "relaxed-straight-jean",
  "six-panel-cap",
  "tapered-jogger",
  "washed-co-ord-set",
  "wide-cargo-pant",
]);

/** A piece's cut-out photo: the one uploaded in the admin, else the hand-made one, else none. */
export function cutoutOf(p: { slug: string; cutout?: string }): string | null {
  return p.cutout ?? (RACK_CUTOUTS.has(p.slug) ? `/rack/${p.slug}.webp` : null);
}
