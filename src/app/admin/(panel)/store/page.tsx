import type { Metadata } from "next";

import { requireOwner } from "@/lib/staff";
import { getStoreInfoForAdmin } from "@/lib/store-info";
import { StoreForm } from "./store-form";

export const metadata: Metadata = { title: "Store" };
export const dynamic = "force-dynamic";

export default async function AdminStore() {
  await requireOwner();
  return (
    <div className="max-w-3xl">
      <p className="text-steel-dark">
        The store&apos;s address, hours and directions for the Visit page, the footer and Google.{" "}
        <a href="/visit" target="_blank" rel="noopener" className="underline underline-offset-2">
          See the Visit page
        </a>{" "}
        ·{" "}
        <a href="/visit?preview=open" target="_blank" rel="noopener" className="underline underline-offset-2">
          Preview it open
        </a>
      </p>
      <StoreForm initial={await getStoreInfoForAdmin()} />
    </div>
  );
}
