import Image from "next/image";
import Link from "next/link";

import { site } from "@/lib/site";
import { VisitCard } from "./visit-card";

const cols = [
  {
    title: "Shop",
    links: [
      { href: "/drops", label: "Drops" },
      { href: "/shop", label: "Shop all" },
      { href: "/gift", label: "Gifts and gift cards" },
      { href: "/fit", label: "Build a fit" },
      { href: "/size-guide", label: "Your size in cm" },
      { href: "/alerts", label: "Drop alerts" },
    ],
  },
  {
    title: "Store",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/visit", label: "Visit us" },
      { href: "/about", label: "About" },
      { href: "/account", label: "Account" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/returns", label: "Returns and exchanges" },
      { href: "/track", label: "Track an order" },
      { href: "/delivery", label: "Delivery and pickup" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of sale" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-paper pb-24 lg:pb-0">
      <div className="container-ep grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-8 w-auto" />
          <p className="mt-4 text-lg text-steel-dark">{site.tagline}</p>
          <div className="mt-8 max-w-sm">
            <VisitCard compact />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {cols.map((c) => (
            <div key={c.title}>
              <h2 className="eyebrow text-steel-dark">{c.title}</h2>
              <ul className="mt-4 space-y-3 text-[15px]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-mist">
        <div className="container-ep flex flex-col gap-3 py-6 text-[13px] text-steel-dark md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.company.legalName}
            {site.company.panVat ? ` · PAN/VAT ${site.company.panVat}` : ""}
            {site.store.address ? ` · ${site.store.address}` : ` · ${site.store.area}`}
          </p>
          <p className="flex items-center gap-3">
            <span>Pay with</span>
            <span className="font-semibold text-ink">eSewa</span>
            <span className="font-semibold text-ink">Khalti</span>
            <span className="font-semibold text-ink">Fonepay</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
