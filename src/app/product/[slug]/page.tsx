import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyPanel } from "@/components/buy-panel";
import { HangTag } from "@/components/hang-tag";
import { ChevronIcon } from "@/components/icons";
import { RecentlyViewed } from "@/components/local-lists";
import { ProductGrid } from "@/components/product-card";
import { RecordView } from "@/components/saved";
import { ProductImage } from "@/components/product-image";
import { formatDropTime } from "@/lib/format";
import { categoryLabels, site } from "@/lib/site";
import { getDrop, getProduct, getProducts } from "@/lib/store";
import type { Size } from "@/lib/types";
import { FestivalNotice } from "@/components/festival-notice";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
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
    openGraph: { title: `${title} | ${site.name}`, description: p.shortDescription },
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
  const hex = product.colours[0].hex;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.shortDescription,
        sku: product.variants[0]?.sku,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="container-ep pb-24 pt-6 md:pt-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-steel-dark">
          <ol className="flex gap-2">
            <li>
              <Link href="/shop" className="hover:underline">
                Shop
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={`/shop?category=${product.category}`} className="hover:underline">
                {categoryLabels[product.category]}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Gallery: swipe on phones, grid on desktop */}
          <div className="relative -mx-4 lg:col-span-7 lg:mx-0 lg:pb-[250px]">
            <ul
              className={`flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 lg:grid lg:gap-3 lg:overflow-visible lg:px-0 ${
                product.images.length > 1 ? "lg:grid-cols-2" : "lg:grid-cols-1"
              }`}
            >
              {product.images.map((img, i) => (
                <li key={i} className={`relative shrink-0 snap-center lg:w-auto ${product.images.length > 1 ? "w-[86%]" : "w-full"}`}>
                  <ProductImage
                    image={img}
                    category={product.category}
                    colourHex={hex}
                    priority={i === 0}
                    sizes={product.images.length > 1 ? "(min-width: 1024px) 30vw, 86vw" : "(min-width: 1024px) 55vw, 100vw"}
                  />
                </li>
              ))}
            </ul>
            {/* The same tag that hangs on the piece in the store (price, cm, RFID), pinned at the
                bottom of the photo and hanging below it. The shadow is on the wrapper because the
                tag's cut corners would clip it. */}
            <div className="pointer-events-none absolute right-10 top-full z-10 -mt-3 origin-top-right scale-[0.6] md:right-10 md:scale-[0.8] lg:top-[calc(100%-250px)] lg:right-8 xl:scale-90">
              <div className="tag-hang flex flex-col items-center [filter:drop-shadow(0_0_0.6px_rgba(0,0,0,0.45))_drop-shadow(0_8px_14px_rgba(0,0,0,0.14))]" aria-hidden>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-ink/60 bg-paper" />
                <span className="h-9 w-px bg-ink/60" />
                <HangTag product={product} size={sizes.includes("M") ? "M" : sizes[0]} className="[--hole:var(--color-mist)]" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              {product.status === "scheduled" && drop && (
                <span className="tag-volt mb-4">
                  {drop.name} · {formatDropTime(drop.releaseAt, { bs: true })}
                </span>
              )}
              {/* On phones and tablets the tag hangs down beside the title, so the title leaves room. */}
              <div className="pr-[128px] md:pr-[196px] lg:pr-0">
                <h1 className="display text-[40px] md:text-[56px]">{product.name}</h1>
                <p className="mt-2 text-steel-dark">{product.shortDescription}</p>
              </div>
              <FestivalNotice className="mt-4" />

              <div className="mt-6">
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
                  dropLabel={drop ? `Drops ${formatDropTime(drop.releaseAt)}` : undefined}
                />
              </div>

              <div className="mt-10 divide-y divide-mist border-y border-mist">
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
            </div>
          </div>
        </div>

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
        <RecentlyViewed products={all} exclude={product.slug} title="You looked at" />
      </div>
    </>
  );
}
