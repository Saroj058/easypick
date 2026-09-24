import type { MetadataRoute } from "next";

import { site } from "@/lib/site";
import { getDrops, getProducts } from "@/lib/store";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, drops] = await Promise.all([getProducts(), getDrops()]);
  const statics = ["", "/drops", "/shop", "/gift", "/gift-cards", "/fit", "/how-it-works", "/visit", "/size-guide", "/about", "/alerts", "/returns", "/delivery", "/privacy", "/terms"];
  return [
    ...statics.map((p) => ({ url: `${site.url}${p}` })),
    ...drops.map((d) => ({ url: `${site.url}/drop/${d.slug}` })),
    ...products.map((p) => ({ url: `${site.url}/product/${p.slug}` })),
  ];
}
