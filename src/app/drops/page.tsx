import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { PageIntro } from "@/components/page-intro";
import { ProductImage } from "@/components/product-image";
import { formatDropTime } from "@/lib/format";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Drops",
  description: "New Easypick drops every other Friday. See what's out now and what's coming next.",
  alternates: { canonical: "/drops" },
};

export default async function DropsPage() {
  const [drops, products, { next }] = await Promise.all([getDrops(), getProducts(), getDropTimeline()]);

  return (
    <>
      <PageIntro title="Drops" lead="New pieces every other Friday. Small batches, fair prices." />

      <div className="container-ep space-y-16 pb-24">
        {next && (
          <section aria-labelledby="next-title" className="grid gap-8 bg-photo p-6 md:grid-cols-2 md:items-center md:p-10">
            <div>
              <h2 id="next-title" className="text-2xl font-semibold">
                {next.name} arrives {formatDropTime(next.releaseAt, { bs: true })}.
              </h2>
              <p className="mt-2 text-steel-dark">{next.story}</p>
            </div>
            <AlertSignup source={`drops-${next.slug}`} />
          </section>
        )}

        <ul className="grid gap-12 md:grid-cols-2">
          {drops.map((d) => {
            const items = products.filter((p) => p.dropSlug === d.slug);
            const released = isReleased(d);
            return (
              <li key={d.slug}>
                <Link href={`/drop/${d.slug}`} className="group block">
                  <div className="grid grid-cols-2 gap-2">
                    {items.slice(0, 4).map((p) => (
                      <ProductImage key={p.id} image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes="25vw" />
                    ))}
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold group-hover:underline">{d.name}</h2>
                  <p className="mt-1 text-steel-dark">
                    {released ? "Out now" : `Arrives ${formatDropTime(d.releaseAt, { bs: true })}`} · {items.length} pieces
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
