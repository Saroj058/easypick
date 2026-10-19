import type { Category, Fit, Measurements, Size } from "./types";

// Typical garment measurements in cm, flat-lay doubled for chest and waist, for "Fill typical
// sizes" on Add a piece (owner, 19 Oct 2026). A starting point to check with a tape, never shown
// on the site until the owner saves them.

type Row = { chest?: number; length?: number; sleeve?: number; waist?: number; inseam?: number };

const TOPS: Record<Size, Row> = {
  XS: { chest: 92, length: 66, sleeve: 19 },
  S: { chest: 98, length: 68, sleeve: 20 },
  M: { chest: 104, length: 70, sleeve: 21 },
  L: { chest: 110, length: 72, sleeve: 22 },
  XL: { chest: 116, length: 74, sleeve: 23 },
  XXL: { chest: 122, length: 76, sleeve: 24 },
  ONE: {},
};
/** Long sleeves (hoodies, sweatshirts, jackets, shirts) are measured to the cuff. */
const LONG_SLEEVE: Partial<Record<Category, true>> = { hoodies: true, sweatshirts: true, jackets: true, shirts: true };
const LONG: Record<Size, number> = { XS: 58, S: 60, M: 62, L: 64, XL: 65, XXL: 66, ONE: 0 };
const BOTTOMS: Record<Size, Row> = {
  XS: { waist: 70, length: 98, inseam: 74 },
  S: { waist: 74, length: 100, inseam: 76 },
  M: { waist: 80, length: 102, inseam: 77 },
  L: { waist: 86, length: 104, inseam: 78 },
  XL: { waist: 92, length: 106, inseam: 79 },
  XXL: { waist: 98, length: 108, inseam: 80 },
  ONE: {},
};
const SHORTS_LENGTH: Record<Size, number> = { XS: 46, S: 47, M: 48, L: 49, XL: 50, XXL: 51, ONE: 0 };

/** Typical measurements for a kind, fit and sizes; caps and one-size pieces get none. */
export function typicalSizes(category: Category, fit: Fit, sizes: Size[]): Measurements {
  const out: Measurements = {};
  const roomy = fit === "oversized" ? 1 : fit === "relaxed" ? 0.5 : 0;
  for (const s of sizes) {
    if (s === "ONE" || category === "accessories") continue;
    if (category === "shorts") out[s] = { waist: BOTTOMS[s].waist, length: SHORTS_LENGTH[s] };
    else if (["jeans", "trousers", "joggers"].includes(category)) out[s] = { ...BOTTOMS[s] };
    else {
      const t = TOPS[s];
      out[s] = {
        chest: Math.round(t.chest! + 10 * roomy),
        length: Math.round(t.length! + 3 * roomy),
        sleeve: LONG_SLEEVE[category] ? LONG[s] : Math.round(t.sleeve! + 3 * roomy),
      };
    }
  }
  return out;
}
