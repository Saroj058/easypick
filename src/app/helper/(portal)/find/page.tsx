import type { Metadata } from "next";

import { searchOrders } from "@/lib/orders";
import { HelperOrderCard } from "../queue";

export const metadata: Metadata = { title: "Find an order" };
export const dynamic = "force-dynamic";

/** A customer at the counter: find their order by number, phone or gift card code. */
export default async function HelperFind({ searchParams }: PageProps<"/helper/find">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 40) : "";
  const found = q ? await searchOrders(q) : [];
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-[32px]">Find an order</h1>
      <form role="search" action="/helper/find" className="mt-4 flex gap-2">
        <label htmlFor="h-q" className="sr-only">
          Order number, phone or gift card code
        </label>
        <input
          id="h-q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          inputMode="search"
          placeholder="EP-1000123 or 98XXXXXXXX"
          className="h-[52px] min-w-0 flex-1 rounded-[2px] border border-steel-dark bg-paper px-4 text-lg outline-none placeholder:text-steel-dark focus:border-ink"
        />
        <button type="submit" className="btn btn-ink">
          Find
        </button>
      </form>
      <p className="mt-2 text-[13px] text-steel-dark">The last 4 digits of the order number or 6+ digits of the phone are enough.</p>
      {q && (
        <>
          <p className="mt-6 text-[14px] text-steel-dark">
            {found.length} {found.length === 1 ? "order" : "orders"} for &ldquo;{q}&rdquo;
          </p>
          <ul className="mt-3 space-y-3">
            {found.map((o) => (
              <HelperOrderCard key={o.id} o={o} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
