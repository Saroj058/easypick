import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// The Vault: original brands and numbered pieces, quiet and dark. Until the owner marks pieces for it
// (product settings in admin), the home page shows a short strip saying what it is, with nothing to buy.

function tag(p: Product) {
  if (p.edition) return `${String(p.edition.no).padStart(2, "0")} / ${String(p.edition.of).padStart(2, "0")}`;
  return p.original ? "ORIGINAL" : "";
}

export function Vault({ products }: { products: Product[] }) {
  const pieces = products.filter((p) => p.vault && (p.status === "live" || p.status === "sold_out"));
  if (pieces.length === 0) {
    return (
      <section aria-labelledby="vault-title" className="on-dark bg-ink py-10 text-[#f2efe8] md:py-14">
        <div className="container-ep flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel">Not open yet</p>
            <h2 id="vault-title" className="display display-h1 mt-2 tracking-[0.02em]">
              The Vault
            </h2>
            <p className="mt-2.5 max-w-[46ch] text-[17px] text-[#aeaba3]">Rare, verified-genuine sneakers. One of each, never restocked. The first pairs aren&apos;t in yet.</p>
          </div>
          <Link href="/alerts" className="btn btn-volt shrink-0">
            Get drop alerts
          </Link>
        </div>
      </section>
    );
  }

  const brands = Array.from(
    pieces.reduce((m, p) => (p.brand ? m.set(p.brand, (m.get(p.brand) ?? 0) + 1) : m), new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section aria-labelledby="vault-title" className="on-dark section bg-ink text-[#f2efe8]">
      <div className="container-ep flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="vault-title" className="display display-h1 tracking-[0.02em]">
              The Vault
            </h2>
            <p className="mt-2.5 text-[17px] text-[#aeaba3]">Original brands and numbered pieces.</p>
          </div>
          <Link href="/shop?vault=1" className="shrink-0 text-[15px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
            Enter
          </Link>
        </div>

        {brands.length > 0 && (
          <nav aria-label="Vault brands" className="no-scrollbar -mx-4 flex overflow-x-auto border-y border-[#2c2c2e] md:mx-0 md:grid md:grid-cols-6">
            {brands.slice(0, 6).map(([name, n]) => (
              <Link
                key={name}
                href={`/shop?vault=1&brand=${encodeURIComponent(name)}`}
                className="flex h-[88px] min-w-[140px] shrink-0 flex-col items-center justify-center gap-1 border-r border-[#1f1f22] hover:bg-[#151517] md:min-w-0"
              >
                <span className="font-display text-[28px] uppercase tracking-[0.04em]">{name}</span>
                <span className="font-mono text-[11px] text-steel">
                  {n} {n === 1 ? "piece" : "pieces"}
                </span>
              </Link>
            ))}
          </nav>
        )}

        <ul className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {pieces.slice(0, 4).map((p) => (
            <li key={p.id} className="w-[64vw] max-w-[280px] shrink-0 snap-start md:w-auto md:max-w-none">
              <Link href={`/product/${p.slug}`} className="group flex flex-col gap-3">
                <span className="block overflow-hidden bg-[#151517]">
                  <ProductImage
                    image={p.images[0] ?? { src: null, alt: p.name, kind: "front" }}
                    category={p.category}
                    colourHex={p.colours[0]?.hex ?? "#2b2b2e"}
                    decorative
                    className="bg-[#151517] transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="(min-width: 768px) 25vw, 64vw"
                  />
                </span>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-steel">{p.brand ?? ""}</span>
                  <span className="font-mono text-[11px] tracking-[0.08em] text-steel">{tag(p)}</span>
                </span>
                <span className="flex justify-between gap-3">
                  <span className="text-base group-hover:underline">{p.name}</span>
                  <span className="font-mono text-[14px] tabular-nums">{p.status === "sold_out" ? "Sold" : formatPrice(p.salePrice ?? p.price)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
