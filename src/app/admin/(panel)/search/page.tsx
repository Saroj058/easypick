import type { Metadata } from "next";
import Link from "next/link";

import { listCustomers, searchPieces } from "@/lib/admin-views";
import { formatPrice } from "@/lib/format";
import { searchOrders } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import { statusLabel, time } from "../orders/order-bits";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";
const row = "flex flex-wrap items-baseline justify-between gap-2 rounded-full bg-[#f4f4f2] px-4 py-2.5 text-[14px] hover:bg-ink/[0.07]";

/** One search across orders (number, phone, name), pieces (name, brand, SKU) and customers (name, phone, email). */
export default async function AdminSearch({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const who = await requireStaff();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const [orders, pieces, customers] = q.length >= 2 ? await Promise.all([searchOrders(q), searchPieces(q), who.role === "owner" ? listCustomers(q, 12) : Promise.resolve([])]) : [[], [], []];
  const none = q.length >= 2 && !orders.length && !pieces.length && !customers.length;

  return (
    <div className="space-y-8">
      <div>
        <p className={label}>Search</p>
        <h1 className="mt-1 text-[36px] font-light leading-none tracking-[-0.02em] md:text-[44px]">{q ? <>&ldquo;{q}&rdquo;</> : "Search the shop"}</h1>
        <form action="/admin/search" role="search" className="mt-5 flex max-w-xl gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search orders, pieces and customers</span>
            <input name="q" type="search" defaultValue={q} placeholder="Order number, phone, piece, SKU, customer…" className="h-12 w-full rounded-full border border-ink/15 bg-white px-5 text-[15px] outline-none focus:border-ink" />
          </label>
          <button type="submit" className="h-12 shrink-0 cursor-pointer rounded-full bg-ink px-6 text-[14px] font-semibold text-paper">
            Search
          </button>
        </form>
      </div>

      {q.length > 0 && q.length < 2 && <p className="text-[#55575c]">Type at least two letters or numbers.</p>}
      {none && <p className="text-[#55575c]">Nothing matches &ldquo;{q}&rdquo;.</p>}

      {orders.length > 0 && (
        <section aria-labelledby="s-orders">
          <h2 id="s-orders" className="text-[18px] font-semibold">
            Orders <span className="font-mono text-[13px] font-normal text-[#6b6d72]">{orders.length}</span>
          </h2>
          <ul className="mt-3 space-y-1.5">
            {orders.slice(0, 20).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className={row}>
                  <span className="font-mono font-semibold">{o.number}</span>
                  <span className="text-[13px] text-[#55575c]">
                    {statusLabel(o)} · {formatPrice(o.total)} · {o.phone} · {time.format(new Date(o.createdAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pieces.length > 0 && (
        <section aria-labelledby="s-pieces">
          <h2 id="s-pieces" className="text-[18px] font-semibold">
            Pieces <span className="font-mono text-[13px] font-normal text-[#6b6d72]">{pieces.length}</span>
          </h2>
          <ul className="mt-3 space-y-1.5">
            {pieces.map((p) => (
              <li key={p.slug}>
                <Link href={`/admin/products/${p.slug}`} className={row}>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[13px] text-[#55575c]">
                    {p.status.replace("_", " ")} · {formatPrice(p.salePrice ?? p.price)} · {p.variants.reduce((n, v) => n + v.stock, 0)} in stock
                    {p.vault ? " · Vault" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customers.length > 0 && (
        <section aria-labelledby="s-customers">
          <h2 id="s-customers" className="text-[18px] font-semibold">
            Customers <span className="font-mono text-[13px] font-normal text-[#6b6d72]">{customers.length}</span>
          </h2>
          <ul className="mt-3 space-y-1.5">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers?q=${encodeURIComponent(c.phone ?? c.email ?? c.name ?? "")}`} className={row}>
                  <span className="font-semibold">{c.name || "No name yet"}</span>
                  <span className="text-[13px] text-[#55575c]">
                    {[c.phone, c.email].filter(Boolean).join(" · ")} · {c.orders} {c.orders === 1 ? "order" : "orders"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
