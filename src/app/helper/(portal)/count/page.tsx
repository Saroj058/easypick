import type { Metadata } from "next";
import Link from "next/link";

import { CountForm } from "@/app/admin/(panel)/stock/count-form";

export const metadata: Metadata = { title: "Stock count" };

export default function HelperCount() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/helper/stock" className="text-[14px] text-steel-dark underline underline-offset-2">
        Stock
      </Link>
      <h1 className="display mt-3 text-[32px]">Stock count</h1>
      <p className="mt-2 text-steel-dark">
        Download the sheet, count what&apos;s on the floor and in the back, fill in &ldquo;counted&rdquo;, then paste the sheet below. You&apos;ll see the
        differences before anything changes.
      </p>
      <a href="/admin/stock/sheet" download className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
        Download the count sheet (CSV)
      </a>
      <div className="mt-8">
        <CountForm />
      </div>
    </div>
  );
}
