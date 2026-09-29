import type { Metadata } from "next";

import { RecentlyViewed, SavedList } from "@/components/local-lists";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="container-ep pb-24">
      <PageIntro title="Saved." lead="Pieces you hearted, kept on this phone. No account needed." />
      <SavedList />
      <RecentlyViewed />
    </div>
  );
}
