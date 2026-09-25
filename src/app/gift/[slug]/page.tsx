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

export default async function SendGiftPage({ params }: PageProps<"/gift/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product || product.status !== "live") notFound();

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <h1 className="display display-h1">Send as gift.</h1>
            <div className="mt-8 flex gap-4">
              <div className="w-28 shrink-0">
                <ProductImage image={product.images[0]} category={product.category} colourHex={product.colours[0].hex} decorative sizes="112px" />
              </div>
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="font-mono text-[15px]">{formatPrice(product.salePrice ?? product.price)}</p>
                <Link href={`/product/${product.slug}`} className="mt-2 inline-block text-[13px] underline underline-offset-2">
                  View piece
                </Link>
              </div>
            </div>
          </div>
        </aside>
        <div className="lg:col-span-6 lg:col-start-7">
          <GiftForm product={product} />
        </div>
      </div>
    </div>
  );
}
