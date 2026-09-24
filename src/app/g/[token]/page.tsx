import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GiftReveal, type RevealData } from "@/components/gift-reveal";
import { findOrderByGiftToken } from "@/lib/orders";
import { getProducts } from "@/lib/store";

export const metadata: Metadata = { title: "You've got a gift", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The receiver's private gift page. Shows no price and nothing about the buyer except the name they chose to share. */
export default async function GiftRevealPage({ params }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const order = findOrderByGiftToken(token);
  if (!order?.gift || !/^[\w-]{20,40}$/.test(token)) notFound();

  // A gift only opens once it's paid for.
  if (order.status === "awaiting_payment" || order.status === "expired") {
    return (
      <section className="container-ep max-w-xl py-24 text-center md:py-32">
        <h1 className="display display-h1">Almost ready.</h1>
        <p className="mt-4 text-lg text-steel-dark">
          {order.status === "expired" ? "This gift wasn't completed. Ask the sender to try again." : "Your gift is being wrapped. Open this link again in a moment."}
        </p>
      </section>
    );
  }

  const line = order.lines[0];
  const product = (await getProducts()).find((p) => p.slug === line.slug);
  const g = order.gift;

  const data: RevealData = {
    token,
    mode: g.mode,
    status: g.status,
    from: g.senderName,
    to: g.receiverName,
    message: g.message,
    deliverOn: g.deliverOn,
    wrap: g.wrap,
    colourChoice: g.colourChoice,
    chosen: g.receiver
      ? { method: g.receiver.method, slot: g.receiver.slot ?? null, area: g.receiver.address?.area ?? null, tryInStore: g.receiver.tryInStore === true }
      : null,
    // The pickup code is only needed (and shown) when they chose to try it on in the store.
    storeCode: g.receiver?.tryInStore ? order.number : null,
    cardCode: g.convertedCardCode ?? null,
    welcomeCode: g.welcomeCode ?? null,
    thanked: Boolean(g.thanks),
    // Only sent to the page when the buyer chose to show it.
    price: g.showPrice ? line.unitPrice * line.qty : null,
    line: { size: line.size, colour: line.colour, sku: line.sku },
    product: product
      ? {
          name: product.name,
          category: product.category,
          image: product.images[0],
          colours: product.colours,
          measurements: product.measurements,
          variants: product.variants.map((v) => ({
            sku: v.sku,
            size: v.size,
            colour: v.colour,
            // The size held for this gift counts as available for its receiver.
            available: v.sku === line.sku || v.stock - (v.lastPieceOnFloor ? 1 : 0) > 0,
          })),
        }
      : null,
  };

  return <GiftReveal data={data} />;
}
