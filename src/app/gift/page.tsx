import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon } from "@/components/icons";
import { PageIntro } from "@/components/page-intro";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gifts",
  description: "Send an Easypick piece or gift card in a minute. They pick their own size, with wrapping and a personal message.",
  alternates: { canonical: "/gift" },
};

export default async function GiftPage() {
  const products = (await getProducts()).filter((p) => p.status === "live");

  return (
    <>
      <PageIntro title="Gift it." lead="Pick a piece. They pick the size. No guessing, no awkward exchanges." />

      <div className="container-ep space-y-20 pb-24">
        <section aria-label="Ways to gift" className="grid gap-4 md:grid-cols-2">
          <a href="#pieces" className="group flex min-h-[160px] flex-col justify-between bg-photo p-6 md:p-8">
            <span>
              <span className="block text-2xl font-semibold">Send a piece</span>
              <span className="mt-2 block text-steel-dark">Choose what they&apos;ll love. We email them a link to pick their size.</span>
            </span>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold">
              Choose a piece <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </a>
          <Link href="/gift-cards" className="group flex min-h-[160px] flex-col justify-between bg-ink p-6 text-paper md:p-8">
            <span>
              <span className="block text-2xl font-semibold">Send a gift card</span>
              <span className="mt-2 block text-paper/80">From Rs 500. Sent by SMS, used online or in store.</span>
            </span>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold">
              Choose an amount <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </section>

        <section aria-labelledby="how-title">
          <h2 id="how-title" className="text-2xl font-semibold">
            How it works
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            <li>
              <p className="font-semibold">You choose the piece.</p>
              <p className="mt-1 text-steel-dark">Add a message and wrap. Pay with eSewa, Khalti or Fonepay.</p>
            </li>
            <li>
              <p className="font-semibold">They choose their size.</p>
              <p className="mt-1 text-steel-dark">
                We email them a private link. They pick their size online, or come to the store and try it on. You choose whether they see the price.
              </p>
            </li>
            <li>
              <p className="font-semibold">We deliver it.</p>
              <p className="mt-1 text-steel-dark">Wrapped, with your card. Wrong size? They swap it within 14 days.</p>
            </li>
          </ol>
        </section>

        <section id="pieces" aria-labelledby="pieces-title" className="scroll-mt-20">
          <h2 id="pieces-title" className="text-2xl font-semibold">
            Choose a piece
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/gift/${p.slug}`} className="group block">
                  <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative />
                  <p className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold group-hover:underline">{p.name}</span>
                    <span className="shrink-0 font-mono text-[14px]">{formatPrice(p.salePrice ?? p.price)}</span>
                  </p>
                  <p className="text-[13px] text-steel-dark">Send as gift</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
