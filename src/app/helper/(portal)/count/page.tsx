import type { Metadata } from "next";
import Link from "next/link";

import { CountForm } from "@/app/admin/(panel)/stock/count-form";
import { requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Stock count" };

export default async function HelperCount() {
  await requireStaff("/helper/login");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/helper/stock" className="text-[13.5px] text-[#55575c] hover:text-ink">
        Stock
      </Link>
      <h1 className="mt-3 text-[34px] font-light leading-none tracking-[-0.02em] md:text-[40px]">Stock count</h1>
      <p className="mt-2 text-[#6b6d72]">
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
