import type { Metadata } from "next";
import Link from "next/link";

import { AskWhatsApp } from "@/components/ask-whatsapp";
import { GiftCardArt } from "@/components/gift-card-art";
import { GiftCardForm } from "@/components/gift-card-form";
import { site } from "@/lib/site";
import { BalanceCheck } from "./balance-check";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "The easy gift: an Easypick gift card from Rs 1,000, sent by email and SMS, used online or in the store, valid for 12 months.",
  alternates: { canonical: "/gift-cards" },
};

const faq = [
  { q: "How fast does it arrive?", a: "Within minutes of paying, or on the date you choose." },
  { q: "Where can I use it?", a: "Online at checkout and in the Easypick store." },
  { q: "How long is it valid?", a: "12 months from when it's paid for." },
  { q: "Can I use it more than once?", a: "Yes. Any leftover balance stays on the card until it's used up." },
  { q: "Can I return it?", a: "Gift cards can't be returned or exchanged for cash once they've been sent." },
  { q: "Lost the code?", a: "Message us on WhatsApp with your order number and we'll send it again." },
];

export default function GiftCardsPage() {
  const whatsapp = site.store.whatsapp;
  return (
    <>
      <section className="border-b border-mist">
        <div className="container-ep grid items-center gap-10 pb-14 pt-14 md:grid-cols-2 md:pb-20 md:pt-24">
          <div>
            <nav aria-label="Breadcrumb" className="index text-steel-dark">
              <Link href="/gift" className="inline-flex min-h-11 items-center hover:underline">
                Gifts
              </Link>
            </nav>
            <h1 className="display display-h1">The easy gift.</h1>
            <p className="mt-4 text-xl text-steel-dark md:text-2xl">Let them pick it.</p>
            <p className="mt-4 max-w-[46ch] text-steel-dark">From Rs 1,000. Sent by email and SMS, used online or in the store, valid for 12 months.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#buy" className="btn btn-volt">
                Buy a gift card
              </a>
              <a href="#balance" className="btn btn-outline">
                Check balance
              </a>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-5 text-[15px]">
              <Link href="/gift" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                Rather send a piece?
              </Link>
              <AskWhatsApp text="Hi Easypick, I need help with a gift card." label="Stuck? Ask us on WhatsApp" />
            </p>
          </div>
          <div className="mx-auto w-full max-w-md md:-rotate-3">
            <GiftCardArt design="pick" amount={2000} />
          </div>
        </div>
      </section>

      <section id="buy" aria-label="Buy a gift card" className="container-ep scroll-mt-24 pb-24 pt-14">
        <GiftCardForm />
      </section>

      <section id="balance" aria-labelledby="balance-h" className="scroll-mt-24 border-t border-mist bg-photo">
        <div className="container-ep grid gap-10 py-14 md:grid-cols-2">
          <div>
            <h2 id="balance-h" className="display display-h2">
              Check a balance.
            </h2>
            <p className="mt-3 max-w-[40ch] text-steel-dark">Type the code from the email or SMS. Signed in? Save the card to your account and it pays at checkout by itself.</p>
          </div>
          <BalanceCheck />
        </div>
      </section>

      <section aria-labelledby="bulk-h" className="container-ep py-14">
        <h2 id="bulk-h" className="text-xl font-semibold">
          Buying 10 or more?
        </h2>
        <p className="mt-2 max-w-[60ch] text-steel-dark">
          For staff gifts and events we send each card to its own inbox with your message, on one invoice.{" "}
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Easypick, I'd like to buy gift cards in bulk.")}`} className="font-semibold text-ink underline underline-offset-2">
              Message us on WhatsApp
            </a>
          ) : (
            <a href="/visit" className="font-semibold text-ink underline underline-offset-2">
              Get in touch
            </a>
          )}
          .
        </p>
      </section>

      <section aria-labelledby="faq-h" className="container-ep border-t border-mist py-14">
        <h2 id="faq-h" className="display display-h2">
          Questions.
        </h2>
        <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-steel-dark">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-12 border-l-2 border-ink pl-4 text-[15px]">Easypick will never ask you to pay with gift cards over the phone or by message.</p>
      </section>
    </>
  );
}
