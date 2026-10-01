import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { formatDropTime } from "@/lib/format";
import { wentLiveAt } from "@/lib/newness";
import { getDropTimeline, getDrops, getProducts } from "@/lib/store";
import type { Drop, Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "New in",
  description: "Everything new at Easypick from the last 30 days, drop by drop, and what's coming next Friday.",
  alternates: { canonical: "/new" },
};
export const revalidate = 300;

const tabs = [
  { key: "all", label: "All" },
  { key: "clothing", label: "Clothing" },
  { key: "accessories", label: "Accessories" },
] as const;
type Tab = (typeof tabs)[number]["key"];

const inTab = (p: Product, tab: Tab) => (tab === "all" ? true : tab === "accessories" ? p.category === "accessories" : p.category !== "accessories");

/** Newest first; sold-out pieces stay (with "tell me when it's back") but go last. */
function order(list: Product[], drops: Drop[]) {
  return [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out") || (wentLiveAt(b, drops) ?? 0) - (wentLiveAt(a, drops) ?? 0));
}

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  const sp = await searchParams;
  const tab: Tab = tabs.some((t) => t.key === sp.type) ? (sp.type as Tab) : "all";
  const [products, drops, { current, next }] = await Promise.all([getProducts(), getDrops(), getDropTimeline()]);

  const fresh = products.filter((p) => p.isNew && inTab(p, tab));
  const latest = current ? order(fresh.filter((p) => p.dropSlug === current.slug), drops) : [];
  const earlier = order(fresh.filter((p) => !current || p.dropSlug !== current.slug), drops);
  const coming = next ? products.filter((p) => p.dropSlug === next.slug && p.status === "scheduled" && inTab(p, tab)).slice(0, 8) : [];

  return (
    <div className="container-ep pb-24">
      <section className="flex flex-wrap items-end justify-between gap-6 pb-10 pt-14 md:pt-24">
        <div>
          <h1 className="display display-h1">New in.</h1>
          <p className="mt-4 max-w-[46ch] text-lg text-steel-dark md:text-xl">
            {current ? `Latest: ${current.name}, out ${formatDropTime(current.releaseAt)}.` : "Fresh pieces every other Friday."}
          </p>
        </div>
        {next && (
          <div>
            <p className="text-[14px] font-semibold">
              Next: {next.name} · {formatDropTime(next.releaseAt)}
            </p>
            <div className="mt-2">
              <Countdown to={next.releaseAt} label={next.name} size="sm" />
            </div>
          </div>
        )}
      </section>

      <nav aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/new" : `/new?type=${t.key}`}
            scroll={false}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center rounded-[2px] border px-4 text-sm font-semibold ${tab === t.key ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {current && latest.length > 0 && (
        <section aria-labelledby="latest-h" className="mt-10">
          <div className="on-dark flex flex-wrap items-end justify-between gap-4 bg-ink px-6 py-8 text-paper md:px-10">
            <div>
              <p className="index text-paper/70">Latest drop</p>
              <h2 id="latest-h" className="display display-h2 mt-2">
                {current.name}
              </h2>
              <p className="mt-2 max-w-[52ch] text-paper/80">{current.story}</p>
            </div>
            <Link href={`/drop/${current.slug}`} className="btn btn-volt">
              See the drop
            </Link>
          </div>
          <div className="mt-8">
            <ProductGrid products={latest} priorityCount={4} />
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section aria-labelledby="earlier-h" className="mt-20">
          <h2 id="earlier-h" className="display display-h2">
            Earlier this month
          </h2>
          <div className="mt-8">
            <ProductGrid products={earlier} />
          </div>
        </section>
      )}

      {latest.length === 0 && earlier.length === 0 && (
        <p className="mt-16 text-steel-dark">
          Nothing new here in the last 30 days{tab === "all" ? "" : " for this filter"}. <Link href="/shop" className="underline underline-offset-2">Shop everything</Link>.
        </p>
      )}

      {next && (
        <section aria-labelledby="next-h" className="mt-24 border-t border-mist pt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="next-h" className="display display-h2">
              Coming next: {next.name}
            </h2>
            <p className="font-mono text-[14px] text-steel-dark">{formatDropTime(next.releaseAt)}</p>
          </div>
          {coming.length > 0 && (
            <ul className="-mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {coming.map((p) => (
                <li key={p.slug} className="w-[44%] shrink-0 snap-start md:w-auto">
                  <ProductCard product={p} sizes="(min-width: 768px) 25vw, 44vw" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-10 max-w-xl">
            <p className="font-semibold">Remind me when it drops</p>
            <p className="mt-1 text-[14px] text-steel-dark">One message on WhatsApp or by email on drop day. Nothing else.</p>
            <div className="mt-4">
              <AlertSignup source={`new-${next.slug}`} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
