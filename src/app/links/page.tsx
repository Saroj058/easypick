import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon } from "@/components/icons";
import { formatDropTime } from "@/lib/format";
import { site } from "@/lib/site";
import { getDropTimeline } from "@/lib/store";

export const revalidate = 300;

export const metadata: Metadata = { title: "Links", robots: { index: false } };

/** Link-in-bio page for Instagram and TikTok: current drop first, then alerts, then directions. */
export default async function LinksPage() {
  const { current, next } = await getDropTimeline();
  const links = [
    current && { href: `/drop/${current.slug}?utm_source=ig&utm_medium=bio&utm_campaign=drop${current.slug}`, title: `${current.name} is here`, note: "Shop the drop", primary: true },
    next && { href: `/drop/${next.slug}?utm_source=ig&utm_medium=bio&utm_campaign=drop${next.slug}`, title: `${next.name}`, note: formatDropTime(next.releaseAt) },
    { href: "/alerts?utm_source=ig&utm_medium=bio", title: "Get drop alerts", note: "WhatsApp or SMS" },
    { href: "/visit?utm_source=ig&utm_medium=bio", title: "Find the store", note: "Hours and directions" },
    { href: "/how-it-works?utm_source=ig&utm_medium=bio", title: "How it works", note: "Pick. Pay. Wear." },
  ].filter(Boolean) as { href: string; title: string; note: string; primary?: boolean }[];

  return (
    <section className="on-dark min-h-[calc(100dvh-56px)] bg-ink py-14 text-paper">
      <div className="container-ep max-w-md">
        <p className="display text-center text-5xl">{site.name}</p>
        <p className="mt-2 text-center text-paper/70">{site.tagline}</p>
        <ul className="mt-10 space-y-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`flex min-h-[64px] items-center justify-between gap-4 rounded-[2px] px-5 py-3 ${l.primary ? "bg-volt text-ink" : "bg-graphite"}`}
              >
                <span>
                  <span className="block font-semibold">{l.title}</span>
                  <span className={`block text-[13px] ${l.primary ? "text-ink/70" : "text-paper/60"}`}>{l.note}</span>
                </span>
                <ArrowIcon className="h-5 w-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
