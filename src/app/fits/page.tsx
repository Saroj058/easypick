import type { Metadata } from "next";
import Link from "next/link";

import { OccasionFits } from "@/components/home/occasion-fits";
import { getSavedLooks } from "@/lib/looks";
import { designerFits } from "@/lib/occasions";
import { getProducts } from "@/lib/store";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Fits",
  description: "Complete outfits for every occasion: pick a ready fit and add it to your bag in one tap, or build your own.",
  alternates: { canonical: "/fits" },
};

// "Fits" in the main menu: the Designer Fits by occasion, and the way in to Build a fit.
export default async function FitsPage() {
  const [products, saved] = await Promise.all([getProducts(), getSavedLooks()]);
  const { looks, curated } = designerFits(products, saved);

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <h1 className="sr-only">Fits</h1>
      {looks.length > 0 ? (
        <OccasionFits looks={looks} curated={curated} />
      ) : (
        <div>
          <p className="display display-h1">Fits</p>
          <p className="mt-3 text-lg text-steel-dark">Ready fits are on their way. For now, put one together yourself.</p>
          <Link href="/fit" className="btn btn-volt mt-6">
            Build your own fit
          </Link>
        </div>
      )}
    </div>
  );
}
