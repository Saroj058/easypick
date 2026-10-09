import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyPanel } from "@/components/buy-panel";
import { RefreshCw, Store, Tag, Truck } from "lucide-react";

import { HangTag } from "@/components/hang-tag";
import { RecentlyViewed } from "@/components/local-lists";
import { TrackView } from "@/components/track-view";
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

  const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
  const sizes = (Object.keys(product.measurements) as Size[]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
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
          <nav aria-label="Breadcrumb" className="absolute right-4 top-4 z-10 font-mono text-[12px] uppercase tracking-[0.14em] text-steel-dark lg:left-10 lg:right-auto lg:top-6">
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
            table={
              cols.length > 0
                ? { head: ["Size", ...cols.map((c) => measureLabels[c])], rows: sizes.map((s) => [s, ...cols.map((c) => product.measurements[s]?.[c] ?? "–")]) }
                : null
            }
            tag={<HangTag product={product} size={sizes.includes("M") ? "M" : sizes[0]} className="[--hole:var(--color-paper)]" />}
            details={[`${product.fit[0].toUpperCase()}${product.fit.slice(1)} fit · ${product.gender}`, ...product.details]}
          />
        </div>

        <div className="border-ink/10 bg-[#f6f6f3] px-4 py-8 md:px-8 lg:border-l lg:px-10 lg:py-6">
          <div className="lg:sticky lg:top-28">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.16em] text-steel-dark">
              {product.brand ? <span>{product.brand}</span> : drop ? <span>{drop.name}</span> : <span>{categoryLabels[product.category]}</span>}
              {product.original && <span className="border border-ink px-1.5 text-ink">Original</span>}
              {product.edition && (
                <span className="text-ink">
                  {String(product.edition.no).padStart(2, "0")} / {String(product.edition.of).padStart(2, "0")}
                </span>
              )}
              {product.status === "scheduled" && drop && <span className="text-ink">Arrives {formatDropTime(drop.releaseAt, { bs: true })}</span>}
            </p>
            {/* Phones only: the name, colour and price (on desktop the left column carries the name, and the
                price is on the hang tag beside the piece, so the panel does not repeat them) */}
            <div className="mt-5 flex items-start justify-between gap-6 lg:hidden">
              <div className="min-w-0">
                <h1 className="text-[22px] font-medium uppercase leading-snug tracking-[0.16em] md:text-[24px]">{product.name}</h1>
                <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.16em] text-steel-dark">
                  {product.colours[0].name} · {product.fit} fit
                </p>
              </div>
              {/* The tag is small on a phone, so the price is said here too */}
              <p className="shrink-0 text-right font-mono text-[21px] tabular-nums leading-snug">
                {formatPrice(product.salePrice ?? product.price)}
                {product.salePrice && <s className="block text-[13px] text-steel-dark">{formatPrice(product.price)}</s>}
              </p>
            </div>
            <p className="mt-4 text-[15px] text-steel-dark lg:hidden">{product.shortDescription}</p>

            <div className="mt-6 border-t border-ink/15 pt-6 lg:mt-5">
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
            </div>

            {/* Four plain promises, small */}
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink/15 pt-5 font-mono text-[12px] uppercase leading-snug tracking-[0.12em] text-ink/80">
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
        {product.story && (
          <section aria-label="About this piece" className="mx-auto max-w-[820px] pt-12 md:pt-16">
            <p className="max-w-[58ch] whitespace-pre-line text-[15px] leading-relaxed">{product.story}</p>
          </section>
        )}

        {more.length > 0 && (
          <section className="mt-24" aria-labelledby="more-heading">
            <h2 id="more-heading" className="display text-[28px] md:text-[44px]">
              You may also like
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
