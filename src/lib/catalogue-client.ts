import { useEffect, useState } from "react";

import type { Product } from "./types";

// The public catalogue for browser-side lists (search, saved, recently viewed), fetched once
// per visit from /api/products. Pages don't carry the whole catalogue in their HTML.
// A failed fetch resolves to null and isn't kept, so the next try asks again.

let catalogue: Promise<Product[] | null> | null = null;

export function loadCatalogue() {
  catalogue ??= fetch("/api/products")
    .then((r) => {
      if (!r.ok) throw new Error(`catalogue ${r.status}`);
      return r.json() as Promise<Product[]>;
    })
    .catch(() => {
      catalogue = null; // try again next time
      return null;
    });
  return catalogue;
}

/** The catalogue once loaded (null until then). Only fetches when `needed`. */
export function useCatalogue(needed: boolean): Product[] | null {
  const [list, setList] = useState<Product[] | null>(null);
  useEffect(() => {
    if (!needed || list) return;
    let live = true;
    void loadCatalogue().then((l) => live && l && setList(l));
    return () => {
      live = false;
    };
  }, [needed, list]);
  return list;
}
