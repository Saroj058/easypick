import type { Metadata } from "next";

import { db } from "@/lib/db";
import { NewProductForm } from "./new-product-form";

export const metadata: Metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

export default function NewProduct() {
  const drops = db((d) => d.drops.map((x) => ({ slug: x.slug, name: x.name })));
  return (
    <div className="max-w-3xl">
      <p className="text-steel-dark">It starts as a draft, hidden from the site, unless you tick &ldquo;Put it live now&rdquo;.</p>
      <NewProductForm drops={drops} />
    </div>
  );
}
