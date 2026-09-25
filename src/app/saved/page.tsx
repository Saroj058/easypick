import type { Metadata } from "next";

import { RecentlyViewed, SavedList } from "@/components/local-lists";
import { PageIntro } from "@/components/page-intro";
import { getProducts } from "@/lib/store";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };
export const revalidate = 300;

export default async function SavedPage() {
  const products = await getProducts();
  return (
    <div className="container-ep pb-24">
      <PageIntro title="Saved." lead="Pieces you hearted, kept on this phone. No account needed." />
      <SavedList products={products} />
      <RecentlyViewed products={products} />
    </div>
  );
}
