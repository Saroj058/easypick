import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GiftForm, type GiftFestival } from "@/components/gift-form";
import { ProductImage } from "@/components/product-image";
import { bothDates, currentFestival } from "@/lib/festival";
import { formatPrice } from "@/lib/format";
import { getProduct } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/gift/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product ? `Send ${product.name} as a gift` : "Send as a gift", robots: { index: false } };
}

export default async function SendGiftPage({ params }: PageProps<"/gift/[slug]">) {
  const [product, f] = await Promise.all([getProduct((await params).slug), currentFestival()]);
  if (!product || product.status !== "live") notFound();
  const festival: GiftFestival = f ? { name: f.name, open: f.open, dateText: bothDates(f.date), orderByText: bothDates(f.orderBy) } : null;
  const oneSize = product.variants.every((v) => v.size === "ONE");

  return (
    <div className="container-ep pb-24 pt-8 md:pt-16">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <p className="index text-steel-dark">
              <Link href="/gift" className="hover:underline">
                Gifts
              </Link>
            </p>
            <h1 className="display mt-2 text-[40px] leading-none md:text-[72px]">Send as gift.</h1>
            <div className="mt-6 flex gap-4 md:mt-8">
              <div className="w-20 shrink-0 md:w-28">
                <ProductImage image={product.images[0]} category={product.category} colourHex={product.colours[0].hex} decorative sizes="112px" />
              </div>
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="font-mono text-[15px]">{formatPrice(product.salePrice ?? product.price)}</p>
                <p className="mt-1 text-[13px] text-steel-dark">{oneSize ? "One size · nothing to guess" : "They pick the size, or swap within 14 days"}</p>
                <Link href={`/product/${product.slug}`} className="mt-2 inline-block text-[13px] underline underline-offset-2">
                  View piece
                </Link>
              </div>
            </div>
          </div>
        </aside>
        <div className="lg:col-span-6 lg:col-start-7">
          <GiftForm product={product} festival={festival} />
        </div>
      </div>
    </div>
  );
}
