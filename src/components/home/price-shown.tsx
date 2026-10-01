import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import type { Product } from "@/lib/types";

// "Price shown. No DM needed.": a real hang tag from the rack, then the facts people ask about in DMs.

export function PriceShown({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live");
  const piece =
    live.find((p) => p.category === "jackets" && p.measurements.M?.chest) ??
    live.find((p) => p.measurements.M?.chest) ??
    live[0];
  const m = piece?.measurements.M;
  const rows = m
    ? ([
        ["Chest", m.chest],
        ["Length", m.length],
        ["Sleeve", m.sleeve],
        ["Waist", m.waist],
      ].filter(([, v]) => v) as [string, number][])
    : [];

  return (
    <>
      <section aria-labelledby="price-title" className="section">
        {/* Three columns on one centre line: headline on the left edge, the tag dead centre, the points on the right edge. */}
        <div className="container-ep grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)] lg:gap-16">
          <h2 id="price-title" className="display display-h1" data-reveal>
            Price shown.
            <br />
            No DM needed.
          </h2>
          {piece && (
            <Link
              href={`/product/${piece.slug}`}
              className="mx-auto block w-[280px] border border-mist bg-[#fbfbf8] px-[22px] pb-5 pt-[26px] font-mono text-[13px] shadow-[0_24px_40px_-24px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:-translate-y-1"
              data-reveal
            >
              <span className="mx-auto mb-3.5 block h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
              <span className="block font-sans text-[14px] font-bold uppercase">{piece.name}</span>
              <span className="mt-1.5 block text-[40px] font-semibold leading-tight tabular-nums">{formatPrice(piece.salePrice ?? piece.price)}</span>
              <span className="mt-1 block text-steel-dark">FIXED · VAT INCL.</span>
              {rows.length > 0 && (
                <>
                  <span className="mb-2 mt-3 block border-t border-dashed border-steel pt-2">SIZE M · CM</span>
                  {rows.map(([k, v]) => (
                    <span key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="tabular-nums">{v}</span>
                    </span>
                  ))}
                </>
              )}
            </Link>
          )}
          <ul className="w-full text-xl font-semibold lg:max-w-[340px] lg:justify-self-end" data-reveal>
            {["One price for everyone", "Measured in cm", "VAT included"].map((t, i) => (
              <li key={t} className={`flex items-center gap-4 border-t border-mist py-4 ${i === 2 ? "border-b" : ""}`}>
                <span className="font-mono text-[12px] font-normal text-steel-dark">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Delivery and payment" className="border-y border-mist">
        <ul className="container-ep grid grid-cols-2 gap-x-4 gap-y-3 py-5 text-[15px] md:flex md:justify-between">
          <li>
            <b>Delivery {formatPrice(site.delivery.flatFee)}</b> · free over {site.delivery.freeAbove.toLocaleString("en-IN")}
          </li>
          <li>
            <b>Pay with eSewa</b>
          </li>
          <li>
            <Link href="/returns" className="hover:underline">
              <b>7-day size swap</b>
            </Link>
          </li>
          {site.store.whatsapp && (
            <li>
              <a href={`https://wa.me/${site.store.whatsapp}`} target="_blank" rel="noopener" className="hover:underline">
                <b>WhatsApp us</b>
              </a>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
