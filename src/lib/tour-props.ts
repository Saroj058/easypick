import "server-only";

import type { KioskBill, TagInfo } from "@/components/tour3d/build-store";
import { formatPrice } from "./format";
import { getDropTimeline, getProducts } from "./store";

// What the 3D store shows that comes from the catalogue: the hang tag you read in the scene and
// the two pieces on the kiosk's bill. Used by the tour and by the Visit page's night store.

const cm = (v?: number) => (v ? `${v} cm` : null);

export async function getTourProps(): Promise<{ tag: TagInfo; bill: KioskBill }> {
  const [products, timeline] = await Promise.all([getProducts(), getDropTimeline()]);
  const live = products.filter((p) => p.status === "live" && !p.vault);
  const price = (p: (typeof live)[number]) => p.salePrice ?? p.price;

  // The tag you read in the scene is a real piece: a tee from the latest drop if there is one.
  const tee =
    live.find((p) => p.category === "tees" && p.dropSlug === timeline.current?.slug && p.measurements.M) ??
    live.find((p) => p.category === "tees" && p.measurements.M) ??
    live[0];
  const tag: TagInfo = {
    name: tee?.name ?? "Heavy Tee",
    price: formatPrice(tee ? price(tee) : 999),
    chest: cm(tee?.measurements.M?.chest),
    length: cm(tee?.measurements.M?.length),
  };

  // The kiosk lists that tee and a hoodie, at their real prices, and adds them up.
  const hoodie = live.find((p) => p.category === "hoodies") ?? live.find((p) => p.slug !== tee?.slug);
  const first = { name: tee?.name ?? "Heavy Tee", amount: tee ? price(tee) : 999 };
  const second = { name: hoodie?.name ?? "Everyday Hoodie", amount: hoodie ? price(hoodie) : 1999 };
  const bill: KioskBill = {
    lines: [
      { name: first.name, price: formatPrice(first.amount) },
      { name: second.name, price: formatPrice(second.amount) },
    ],
    total: formatPrice(first.amount + second.amount),
  };
  return { tag, bill };
}
