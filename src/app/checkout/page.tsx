import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { CheckoutForm } from "./checkout-form";
import { FestivalNotice } from "@/components/festival-notice";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  // The phone code is asked for here and nowhere earlier; the guest's bag follows them through the login.
  if (!(await getCurrentUser())) redirect("/login?reason=bag&next=/checkout");
  return (
    <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
      <h1 className="display text-[40px] md:text-[72px]">Checkout</h1>
      <FestivalNotice className="mt-4" />
      <CheckoutForm />
    </div>
  );
}
