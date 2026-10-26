import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// The pieces that hang on the rail demo (the home's chapter and /the-rail): ones with a hanging
// cut-out in public/rack/hung, live, with their real names and prices.
const HUNG = ["oversized-heavy-tee", "coach-jacket", "everyday-hoodie", "wide-cargo-pant", "brushed-crewneck", "relaxed-straight-jean", "fleece-quarter-zip"];

export function railReel(products: Product[]) {
  return HUNG.flatMap((slug) => {
    const p = products.find((x) => x.slug === slug && x.status === "live");
    return p ? [{ src: `/rack/hung/${slug}.webp`, name: p.name, price: formatPrice(p.salePrice ?? p.price) }] : [];
  });
}
