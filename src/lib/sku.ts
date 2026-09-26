import type { Category } from "./types";

// SKU codes for new products: category code + number, colour code, size, e.g. HOD03-BLA-M.
// Pure helpers (no database), so the admin action and the tests share them.

export const CATEGORY_CODE: Record<Category, string> = { tees: "TEE", hoodies: "HOD", jackets: "JKT", bottoms: "BTM", "co-ords": "COR", accessories: "ACC" };

/**
 * The next product code for a category after the ones already used: HOD03 when HOD01 and HOD02
 * exist. Always after the highest, so an old code (maybe still on a printed tag) is never reused.
 */
export function nextProductCode(category: Category, existingSkus: string[]): string {
  const prefix = CATEGORY_CODE[category];
  const re = new RegExp(`^${prefix}(\\d+)(-|$)`, "i");
  let max = 0;
  for (const sku of existingSkus) {
    const m = re.exec(sku);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

/**
 * One short code per colour, unique within the product: the first three letters of the name
 * (accents dropped, anything not A-Z or 0-9 removed), "BLA", "BLA2" when two colours start the
 * same way, and C1, C2… for names with no Latin letters or digits.
 */
export function colourCodes(names: string[]): string[] {
  const out: string[] = [];
  names.forEach((name, i) => {
    const base =
      name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3) || `C${i + 1}`;
    let code = base;
    for (let k = 2; out.includes(code); k++) code = `${base}${k}`;
    out.push(code);
  });
  return out;
}
