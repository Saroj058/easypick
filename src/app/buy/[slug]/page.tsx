import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { getProduct } from "@/lib/store";

export const metadata: Metadata = { title: "Buy now", robots: { index: false } };

/** One piece, straight to payment. No account and no bag needed. */
export default async function BuyNowPage({ params, searchParams }: PageProps<"/buy/[slug]">) {
  const { slug } = await params;
  const { sku } = await searchParams;
  const product = await getProduct(slug);
  if (!product) notFound();
  const variant = product.variants.find((v) => v.sku === sku);
  const sellable = variant ? variant.stock - (variant.lastPieceOnFloor ? 1 : 0) : 0;

  if (!variant || product.status !== "live" || sellable <= 0) {
    return (
      <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
        <h1 className="display text-[40px] md:text-[72px]">Not available</h1>
        <p className="mt-4 text-steel-dark">That size just sold out online. Pick another size, or see if it&apos;s on the rack in store.</p>
        <Link href={`/product/${slug}`} className="btn btn-volt mt-6">
          Back to {product.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
      <h1 className="display text-[40px] md:text-[72px]">Buy now</h1>
      <p className="mt-2 text-steel-dark">
        {product.name} · {variant.colour} · {variant.size === "ONE" ? "One size" : variant.size}.{" "}
        <Link href={`/product/${slug}`} className="underline underline-offset-2">
          Change
        </Link>
      </p>
      <CheckoutForm
        buyNow={{
          slug: product.slug,
          sku: variant.sku,
          name: product.name,
          size: variant.size,
          colour: variant.colour,
          price: product.salePrice ?? product.price,
          qty: 1,
        }}
      />
    </div>
  );
}
