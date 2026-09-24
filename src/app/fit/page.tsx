import type { Metadata } from "next";

import { FitBuilder, type Fit, type SlotKey } from "@/components/fit-builder";
import { getProducts } from "@/lib/store";
import type { Product, Size } from "@/lib/types";

export const metadata: Metadata = {
  title: "Build a fit",
  description: "Put together a full outfit from the Easypick rack: top, bottom, layer and cap. See the total, add it all to your bag, or share the fit.",
  alternates: { canonical: "/fit" },
};

const SLOT_CATS: Record<SlotKey, Product["category"][]> = {
  top: ["tees", "hoodies"],
  bottom: ["bottoms"],
  layer: ["jackets"],
  cap: ["accessories"],
};

/** Read a shared fit from the URL, keeping only pieces that exist and fit their slot. */
function parseFit(sp: Record<string, string | string[] | undefined>, products: Product[]): Fit {
  const fit: Fit = {};
  for (const key of Object.keys(SLOT_CATS) as SlotKey[]) {
    const raw = sp[key];
    if (typeof raw !== "string") continue;
    const [slug, colour, size] = raw.split("~");
    const p = products.find((x) => x.slug === slug && SLOT_CATS[key].includes(x.category) && x.status === "live");
    if (!p) continue;
    const c = p.colours.find((x) => x.name === colour)?.name ?? p.colours[0].name;
    const s = p.variants.some((v) => v.colour === c && v.size === size) ? (size as Size) : null;
    fit[key] = { slug: p.slug, colour: c, size: s };
  }
  return fit;
}

export default async function FitPage({ searchParams }: PageProps<"/fit">) {
  const [products, sp] = await Promise.all([getProducts(), searchParams]);
  const live = products.filter((p) => p.status === "live");
  let initial = parseFit(sp, live);

  // Nothing shared: start with a basic pairing so the stage isn't empty.
  if (Object.keys(initial).length === 0) {
    const top = live.find((p) => p.category === "hoodies") ?? live.find((p) => p.category === "tees");
    const bottom = live.find((p) => p.category === "bottoms");
    initial = {
      ...(top && { top: { slug: top.slug, colour: top.colours[top.colours.length - 1].name, size: null } }),
      ...(bottom && { bottom: { slug: bottom.slug, colour: bottom.colours[0].name, size: null } }),
    };
  }

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <h1 className="display display-h1">Build the fit.</h1>
      <p className="mt-3 max-w-[48ch] text-lg text-steel-dark">
        Top, bottom, a layer if you want one. See it together, see the total, then take the whole fit or share it.
      </p>
      <div className="mt-10">
        <FitBuilder products={live} initial={initial} />
      </div>
    </div>
  );
}
