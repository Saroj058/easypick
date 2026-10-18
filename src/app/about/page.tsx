import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { siteSetting } from "@/lib/settings/site";
import { socialLinks } from "@/lib/settings/site-rules";

export const metadata: Metadata = {
  title: "About",
  description: "Easypick is a self-checkout clothing store in Kathmandu. Fair fixed prices, no pushy selling, new drops every two weeks.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const social = socialLinks(await siteSetting.get());
  return (
    <>
      <PageIntro dark eyebrow="About" title="Shopping, minus the pressure." />
      <section className="section">
        <div className="container-ep max-w-3xl space-y-6 text-lg">
          <p>
            Buying clothes in Kathmandu usually means a salesperson at your shoulder and a price you have to argue down. We wanted a
            store where you can just look.
          </p>
          <p>
            At Easypick every price is on the tag, and it&apos;s the same one you&apos;d pay online. Every tag shows the garment&apos;s
            measurements, so you can find your size without asking. You try things on, pay at the kiosk with the wallet you already use,
            and walk out.
          </p>
          <p>
            We keep the range simple: good basics that fit, and a small drop of new pieces every other Friday. Small batches mean less
            waste and more reasons to come back.
          </p>
          <p>Someone&apos;s always around if you want a hand. If you don&apos;t, that&apos;s fine too.</p>
        </div>
        {social.length > 0 && (
          <div className="container-ep mt-12 flex max-w-3xl flex-wrap gap-3">
            {social.map((x, i) => (
              <a key={x.name} href={x.href} target="_blank" rel="noopener" className={`btn ${i === 0 ? "btn-ink" : "btn-outline"}`}>
                {x.name}
              </a>
            ))}
          </div>
        )}
        <p className="container-ep mt-12 max-w-3xl text-steel-dark">
          <Link href="/how-it-works" className="underline">
            How the store works
          </Link>
        </p>
      </section>
    </>
  );
}
