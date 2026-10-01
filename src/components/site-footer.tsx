import Image from "next/image";
import Link from "next/link";

import { site } from "@/lib/site";
import { getStoreInfo } from "@/lib/store-info";
import { FooterAlerts } from "./footer-alerts";

// The footer: black, the logo with a drop alert sign-up, and three short lists.
// Everything else lives in the menu.

export async function SiteFooter() {
  const info = await getStoreInfo();
  const cols: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
      title: "Shop",
      links: [
        { href: "/shop", label: "The rail" },
        { href: "/shop?vault=1", label: "The Vault" },
        { href: "/fit", label: "Build a fit" },
        { href: "/gift-cards", label: "Gift cards" },
      ],
    },
    {
      title: "Help",
      links: [
        { href: "/track", label: "Track an order" },
        { href: "/returns", label: "Returns" },
        { href: "/delivery", label: "Delivery" },
        ...(info.whatsapp ? [{ href: `https://wa.me/${info.whatsapp}`, label: "WhatsApp us", external: true }] : []),
      ],
    },
    {
      title: "Store",
      links: [
        { href: "/visit", label: "Visit us" },
        { href: "/visit/tour", label: "Virtual tour" },
        { href: "/about", label: "About" },
      ],
    },
  ];

  return (
    <footer className="on-dark bg-ink pb-24 text-paper lg:pb-0">
      <div className="container-ep grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-5 md:py-16">
        <div className="col-span-2 flex flex-col gap-5">
          <Image src="/brand/logo-white.png" alt="Easypick" width={611} height={161} className="h-8 w-auto self-start" />
          <FooterAlerts />
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-bold">{c.title}</h2>
            <ul className="mt-2 text-[14px] md:mt-3 md:space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-[#c7c7cc] hover:text-paper hover:underline md:min-h-0">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="inline-flex min-h-11 items-center text-[#c7c7cc] hover:text-paper hover:underline md:min-h-0">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-paper/15">
        <div className="container-ep flex flex-col gap-3 py-6 text-[13px] text-steel md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.company.legalName}
            {site.company.panVat ? ` · PAN/VAT ${site.company.panVat}` : ""}
            {` · ${info.address ?? info.area}`}
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-paper hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-paper hover:underline">
              Terms
            </Link>
            <span>
              Pay with <span className="font-semibold text-paper">eSewa</span>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
