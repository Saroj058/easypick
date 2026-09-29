import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { site } from "@/lib/site";
import { getTrending } from "@/lib/trending";

export const metadata: Metadata = {
  title: "Trending",
  description: "What people in Kathmandu are buying and wanting at Easypick this week. Worked out from real orders, never picked to push stock.",
  alternates: { canonical: "/trending" },
};
export const revalidate = 3600;

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short" });

export default async function TrendingPage() {
  const t = await getTrending();

  if (t.mode === "picks") {
    return (
      <>
        <PageIntro eyebrow="Trending" title={`${t.label}.`} lead={t.why} />
        <div className="container-ep pb-24">
          {t.items.length ? (
            <ProductGrid products={t.items.map((i) => i.product)} priorityCount={4} />
          ) : (
            <p className="text-steel-dark">
              Nothing here yet. <Link href="/new" className="underline underline-offset-2">See what&apos;s new</Link>.
            </p>
          )}
          <p className="mt-16 max-w-[60ch] text-[14px] text-steel-dark">
            Trending is worked out from real orders, bag adds, saves and restock requests, counted once per person a day. It switches on by
            itself once there&apos;s enough of them. We never show made-up counters.
          </p>
        </div>
      </>
    );
  }

  const [first, second, third, ...rest] = t.items;
  const top = [first, second, third].filter(Boolean);
  return (
    <>
      <PageIntro eyebrow={`${day.format(new Date(t.from))} – ${day.format(new Date(t.to))}`} title="Trending this week." lead="What people are really buying and wanting right now. Worked out from this week's orders, never picked to push stock." />
      <div className="container-ep pb-24">
        <ol className="grid gap-x-4 gap-y-12 md:grid-cols-3" aria-label="Top three">
          {top.map((i) => (
            <li key={i.product.slug}>
              <p className="flex items-baseline gap-3">
                <span className="display text-[56px] leading-none md:text-[72px]">{i.rank}</span>
                <span className="text-[14px] font-semibold">{i.reason}</span>
              </p>
              <div className="mt-3">
                <ProductCard product={i.product} priority sizes="(min-width: 768px) 33vw, 100vw" />
              </div>
            </li>
          ))}
        </ol>
        {rest.length > 0 && (
          <ol className="mt-20 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4" aria-label="Also trending">
            {rest.map((i) => (
              <li key={i.product.slug}>
                <p className="font-mono text-[13px] font-semibold text-steel-dark">#{i.rank}</p>
                <div className="mt-1">
                  <ProductCard product={i.product} />
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-16 max-w-[60ch] text-[14px] text-steel-dark">
          How it&apos;s worked out: paid orders count most, then bag adds, restock requests and saves; each person counts once a day, and a piece
          needs at least 3 orders this week to show. Updated every hour.
        </p>
      </div>
    </>
  );
}
