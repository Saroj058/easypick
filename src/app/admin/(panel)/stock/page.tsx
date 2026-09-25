import type { Metadata } from "next";

import { CountForm } from "./count-form";

export const metadata: Metadata = { title: "Stock count" };
export const dynamic = "force-dynamic";

export default function StockCount() {
  return (
    <div className="max-w-3xl">
      <h2 className="display text-[32px] md:text-[40px]">Stock count</h2>
      <p className="mt-2 text-steel-dark">
        Download the sheet, count what&apos;s really there, fill the &ldquo;counted&rdquo; column, and paste the SKU and counted columns below. Online
        orders placed while you count are kept: only the difference you confirm is changed.
      </p>
      <a href="/admin/stock/sheet" className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-2" download>
        Download the count sheet (CSV)
      </a>
      <div className="mt-8">
        <CountForm />
      </div>
    </div>
  );
}
