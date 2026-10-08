import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GiftForm } from "@/components/gift-form";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import { getProduct } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/gift/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product ? `Send ${product.name} as a gift` : "Send as a gift", robots: { index: false } };
}

export default async function SendGiftPage({ params, searchParams }: PageProps<"/gift/[slug]">) {
  const [product, sp] = await Promise.all([getProduct((await params).slug), searchParams]);
  if (!product || product.status !== "live") notFound();
  const oneSize = product.variants.every((v) => v.size === "ONE");
  // "Send as gift" on a product page carries the colour and size chosen there.
  const initial = { colour: typeof sp.colour === "string" ? sp.colour : undefined, size: typeof sp.size === "string" ? sp.size : undefined };
  const shownColour = product.colours.find((c) => c.name === initial.colour) ?? product.colours[0];

  return (
    <div className="container-ep pb-24 pt-8 md:pt-16">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <nav aria-label="Breadcrumb" className="index text-steel-dark">
              <Link href="/gift" className="inline-flex min-h-11 items-center hover:underline">
                Gifts
              </Link>
            </nav>
            <h1 className="display text-[40px] leading-none md:text-[72px]">Send as gift.</h1>
            <div className="mt-6 flex gap-4 md:mt-8">
              <div className="w-20 shrink-0 md:w-28">
                <ProductImage image={product.images[0]} category={product.category} colourHex={shownColour.hex} decorative sizes="(min-width: 768px) 112px, 80px" />
              </div>
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="font-mono text-[15px]">{formatPrice(product.salePrice ?? product.price)}</p>
                <p className="mt-1 text-[13px] text-steel-dark">{oneSize ? "One size. Nothing to guess." : "They pick the size, or swap within 14 days."}</p>
                <Link href={`/product/${product.slug}`} className="inline-flex min-h-11 items-center text-[13px] underline underline-offset-2">
                  View piece
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* min-w-0: a row of chips inside may scroll sideways without widening the page */}
        <div className="min-w-0 lg:col-span-6 lg:col-start-7">
          <GiftForm product={product} initial={initial} />
        </div>
      </div>
    </div>
  );
}
