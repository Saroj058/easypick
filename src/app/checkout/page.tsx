import type { Metadata } from "next";

import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
      <h1 className="display text-[40px] md:text-[72px]">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
