import type { Metadata } from "next";
import Link from "next/link";

import { FitsShowcase } from "@/components/fits-showcase";
import { getSavedLooks } from "@/lib/looks";
import { designerFits, swapOptions } from "@/lib/occasions";
import { getProducts } from "@/lib/store";
import { HowItWorks } from "@/components/how-it-works";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Fits",
  description: "Complete outfits for every occasion: pick a ready fit and add it to your bag in one tap, or build your own.",
  alternates: { canonical: "/fits" },
};

// "Fits" in the main menu: the Designer Fits as a lookbook (components/fits-showcase.tsx), and the way in to Build a fit.
export default async function FitsPage() {
  const [products, saved] = await Promise.all([getProducts(), getSavedLooks()]);
  const { looks } = designerFits(products, saved);

  return (
    <div className="overflow-x-clip">
    {/* The header is see-through here on computers, so the page starts under it. */}
    <div className={looks.length > 0 ? "bg-[#ededeb] md:pt-[88px]" : "container-ep pb-24 pt-10 md:pt-[152px]"}>
      <h1 className="sr-only">Fits</h1>
      {looks.length > 0 ? (
        <section aria-labelledby="occasion-title">
          <div className="container-ep flex justify-end pb-1 pt-3">
            <HowItWorks guide="fits" />
          </div>
          <FitsShowcase looks={looks} options={swapOptions(products)} />
        </section>
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
    </div>
  );
}
