import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyPanel } from "@/components/buy-panel";
import { RefreshCw, Store, Tag, Truck } from "lucide-react";

import { ChevronIcon } from "@/components/icons";
import { RecentlyViewed } from "@/components/local-lists";
import { TrackView } from "@/components/track-view";
import { TryOnLive } from "@/components/try-on-live";
import { ProductGrid } from "@/components/product-card";
import { RecordView } from "@/components/saved";
import { ProductStage } from "@/components/product-stage";
import { formatDropTime, formatPrice } from "@/lib/format";
import { RACK_CUTOUTS } from "@/lib/rack-cutouts";
import { categoryLabels, site } from "@/lib/site";
import { jsonLd as toJsonLd } from "@/lib/json-ld";
import { getDrop, getProduct, getProducts } from "@/lib/store";
import type { Size } from "@/lib/types";

export const revalidate = 300;

export async function generateStaticParams() {
  // Built ahead: the first 60 pieces on sale now. The rest are built the first time someone opens them.
  return (await getProducts())
    .filter((p) => p.status === "live")
    .slice(0, 60)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  const title = `${p.name} – ${p.colours[0].name}`;
  return {
    title,
    description: `${p.shortDescription} Rs ${p.salePrice ?? p.price}. Try it in store in Kathmandu or order online.`,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: `${title} | ${site.name}`, description: p.shortDescription, type: "website" },
  };
}

const measureLabels = { chest: "Chest", length: "Length", sleeve: "Sleeve", waist: "Waist", inseam: "Inseam" } as const;

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [drop, all] = await Promise.all([product.dropSlug ? getDrop(product.dropSlug) : null, getProducts()]);
  const related = all.filter((p) => p.slug !== product.slug && p.category === product.category).slice(0, 4);
  const more = related.length ? related : all.filter((p) => p.slug !== product.slug).slice(0, 4);

  const sizes = Object.keys(product.measurements) as Size[];
  const cols = Array.from(new Set(sizes.flatMap((s) => Object.keys(product.measurements[s] ?? {})))) as (keyof typeof measureLabels)[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.shortDescription,
        sku: product.variants[0]?.sku,
        image: product.images.filter((i) => i.src).map((i) => (i.src!.startsWith("/") ? `${site.url}${i.src}` : i.src)),
        brand: { "@type": "Brand", name: site.name },
        color: product.colours.map((c) => c.name).join(", "),
        offers: {
          "@type": "Offer",
          url: `${site.url}/product/${product.slug}`,
          priceCurrency: "NPR",
          price: product.salePrice ?? product.price,
          availability:
            product.status === "live"
              ? "https://schema.org/InStock"
              : product.status === "scheduled"
                ? "https://schema.org/PreOrder"
                : "https://schema.org/SoldOut",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Shop", item: `${site.url}/shop` },
          { "@type": "ListItem", position: 2, name: categoryLabels[product.category], item: `${site.url}/shop?category=${product.category}` },
          { "@type": "ListItem", position: 3, name: product.name },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={toJsonLd(jsonLd)} />

      {/* The first screen: the piece alone in the middle with a quiet column beside it, and the buying
          panel down the right on a faint tint. One column on phones. */}
      <section className="border-b border-ink/10 lg:grid lg:min-h-[calc(100svh-88px)] lg:grid-cols-[minmax(0,1fr)_minmax(380px,31%)]">
        {/* The stage stays in view while a long buying panel scrolls beside it */}
        <div className="relative lg:sticky lg:top-[88px] lg:h-[calc(100svh-88px)] lg:self-start">
          <nav aria-label="Breadcrumb" className="absolute right-4 top-4 z-10 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark lg:left-10 lg:right-auto lg:top-6">
            <ol className="flex gap-2">
              <li>
                <Link href="/shop" className="hover:text-ink hover:underline">
                  Shop
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/shop?category=${product.category}`} className="hover:text-ink hover:underline">
                  {categoryLabels[product.category]}
                </Link>
              </li>
            </ol>
          </nav>
          <ProductStage
            images={product.images}
            cutout={RACK_CUTOUTS.has(product.slug) ? `/rack/${product.slug}.webp` : null}
            category={product.category}
            colour={product.colours[0]}
            name={product.name}
            description={product.shortDescription}
            facts={product.details.slice(0, 3)}
            details={[`${product.fit[0].toUpperCase()}${product.fit.slice(1)} fit · ${product.gender}`, ...product.details]}
          />
        </div>

        <div className="border-ink/10 bg-[#f6f6f3] px-4 py-8 md:px-8 lg:border-l lg:px-10 lg:py-9">
          <div className="lg:sticky lg:top-28">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">
              {product.brand ? <span>{product.brand}</span> : drop ? <span>{drop.name}</span> : <span>{categoryLabels[product.category]}</span>}
              {product.original && <span className="border border-ink px-1.5 text-ink">Original</span>}
              {product.edition && (
                <span className="text-ink">
                  {String(product.edition.no).padStart(2, "0")} / {String(product.edition.of).padStart(2, "0")}
                </span>
              )}
              {product.status === "scheduled" && drop && <span className="text-ink">Arrives {formatDropTime(drop.releaseAt, { bs: true })}</span>}
            </p>
            <div className="mt-5 flex items-start justify-between gap-6 lg:mt-3 lg:items-baseline">
              {/* Phones: the name and colour (the left column, which carries them on desktop, is hidden there) */}
              <div className="min-w-0 lg:hidden">
                <h1 className="text-[22px] font-medium uppercase leading-snug tracking-[0.16em] md:text-[24px]">{product.name}</h1>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">
                  {product.colours[0].name} · {product.fit} fit
                </p>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark max-lg:hidden">Fixed price · VAT incl.</p>
              {/* The price, fixed: the same on the tag in the store */}
              <p className="shrink-0 text-right font-mono text-[20px] tabular-nums leading-snug">
                {formatPrice(product.salePrice ?? product.price)}
                {product.salePrice && <s className="block text-[12px] text-steel-dark">{formatPrice(product.price)}</s>}
              </p>
            </div>
            <p className="mt-4 text-[15px] text-steel-dark lg:hidden">{product.shortDescription}</p>

            <div className="mt-6 border-t border-ink/15 pt-6 lg:mt-4">
              <BuyPanel
                slug={product.slug}
                name={product.name}
                price={product.price}
                salePrice={product.salePrice}
                colours={product.colours}
                variants={product.variants}
                status={product.status}
                fit={product.fit}
                // No on-model photos, so the "Model is … and wears …" note is left out.
                category={product.category}
                measurements={product.measurements}
                vault={product.vault}
                dropLabel={drop ? `Drops ${formatDropTime(drop.releaseAt)}` : undefined}
              />
              {product.tryOn && <TryOnLive slug={product.slug} />}
            </div>

            {/* Four plain promises, small */}
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-ink/15 pt-6 font-mono text-[10.5px] uppercase leading-snug tracking-[0.12em] text-ink/80">
              {[
                { icon: Tag, a: "Fixed price", b: "Same in store" },
                { icon: Store, a: "Free pickup", b: "Kathmandu store" },
                { icon: RefreshCw, a: "Exchange", b: "Within 7 days" },
                { icon: Truck, a: "Delivery", b: "In the Valley" },
              ].map(({ icon: Icon, a, b }) => (
                <li key={a} className="flex items-start gap-2">
                  <Icon aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>
                    {a}
                    <span className="block text-steel-dark">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="container-ep pb-24">
        <section id="details" aria-label="About this piece" className="mx-auto max-w-[820px] scroll-mt-28 pt-12 md:pt-16">
          {product.story && <p className="max-w-[58ch] whitespace-pre-line text-[15px] leading-relaxed">{product.story}</p>}
        <div className="mt-8 divide-y divide-mist border-y border-mist">
          <details className="group py-4" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Details
              <ChevronIcon className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-1 text-[15px] text-steel-dark">
              <li className="capitalize">
                {product.fit} fit · {product.gender}
              </li>
              {product.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
          {cols.length > 0 && (
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                Measurements (cm)
                <ChevronIcon className="h-5 w-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full font-mono text-[14px]">
                  <thead>
                    <tr className="text-left text-steel-dark">
                      <th scope="col" className="py-1 pr-4 font-normal">
                        Size
                      </th>
                      {cols.map((c) => (
                        <th key={c} scope="col" className="py-1 pr-4 font-normal">
                          {measureLabels[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((s) => (
                      <tr key={s} className="border-t border-mist">
                        <th scope="row" className="py-2 pr-4 text-left font-semibold">
                          {s}
                        </th>
                        {cols.map((c) => (
                          <td key={c} className="py-2 pr-4">
                            {product.measurements[s]?.[c] ?? "–"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[13px] text-steel-dark">Garment measured flat. Chest is measured all the way round.</p>
            </details>
          )}
          <details className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Pickup, delivery and returns
              <ChevronIcon className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-[15px] text-steel-dark">
              Free store pickup. Delivery inside the Kathmandu Valley, free above Rs {site.delivery.freeAbove.toLocaleString("en-IN")}.
              Exchange your size within 7 days with tags on.{" "}
              <Link href="/returns" className="underline">
                Returns policy
              </Link>
            </p>
          </details>
        </div>
        </section>

        {more.length > 0 && (
          <section className="mt-24" aria-labelledby="more-heading">
            <h2 id="more-heading" className="display text-[28px] md:text-[44px]">
              Wear it with
            </h2>
            <div className="mt-8">
              <ProductGrid products={more} />
            </div>
          </section>
        )}
        <RecordView slug={product.slug} />
        <RecentlyViewed exclude={product.slug} title="You looked at" />
        <TrackView slug={product.slug} />
      </div>
    </>
  );
}
