import type { Metadata } from "next";
import Link from "next/link";

import { ChevronIcon } from "@/components/icons";
import { PageIntro } from "@/components/page-intro";
import { jsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "How it works",
  description: "Pick, try, pay by QR with eSewa, and walk out. How Easypick's self-checkout store in Kathmandu works.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  { n: "01", t: "Walk in.", d: "Say hi to the greeter. There's a three-step picture guide by the door if you want it." },
  { n: "02", t: "Pick.", d: "Every tag shows the price and the garment's measurements in cm. Take your time. Nobody follows you around." },
  { n: "03", t: "Try.", d: "The helper gives you a numbered token for the items you take into the fitting room, and counts them out again." },
  { n: "04", t: "Pay.", d: "Drop your pieces in the tray at the kiosk. It lists them. Scan the QR with eSewa." },
  { n: "05", t: "Wear.", d: "Your bill comes by SMS or print. Walk out. That's it." },
];

const faqs = [
  {
    q: "Do I need an app?",
    a: "No. Just the eSewa app you already use. The kiosk shows a QR; you scan and pay.",
  },
  {
    q: "What if I need help with sizing?",
    a: "Our helper is always around during opening hours. Every tag also shows measurements in cm, and the size guide is on the screen in store.",
  },
  {
    q: "Can I bargain?",
    a: "No. Prices are fixed, fair, and the same in store and online. The price you see is the price you pay, VAT included.",
  },
  {
    q: "What if the gate beeps when I leave?",
    a: "Usually a tag was missed at the kiosk. The greeter will ask you to step back to the kiosk, we check your bill, and fix it. It takes a minute.",
  },
  {
    q: "Can I exchange something?",
    a: "Yes. Size exchanges within 7 days with your bill and tags attached. The helper handles it at the counter.",
  },
  {
    q: "Do you take cash?",
    a: "The kiosk takes QR payments only. If you need to pay another way, ask the helper.",
  },
];

export default function HowItWorksPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      <PageIntro dark eyebrow="How it works" title="Pick. Pay. Wear." lead="A clothing store without the queue or the pressure. Here's what a visit looks like." />

      <section className="section">
        <ol className="container-ep grid gap-12 md:grid-cols-5 md:gap-8">
          {steps.map((s) => (
            <li key={s.n}>
              <span className="font-mono text-sm text-steel-dark">{s.n}</span>
              <h2 className="display mt-2 text-4xl">{s.t}</h2>
              <p className="mt-2 text-[15px] text-steel-dark">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-photo py-20 md:py-28">
        <div className="container-ep max-w-3xl">
          <h2 className="display text-[28px] md:text-[44px]">Questions</h2>
          <div className="mt-8 divide-y divide-mist border-y border-mist">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {f.q}
                  <ChevronIcon className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-steel-dark">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-steel-dark">
            More on{" "}
            <Link href="/returns" className="underline">
              returns and exchanges
            </Link>{" "}
            and{" "}
            <Link href="/delivery" className="underline">
              delivery and pickup
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
