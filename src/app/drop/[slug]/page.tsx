import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { PageIntro } from "@/components/page-intro";
import { ProductGrid } from "@/components/product-card";
import { RefreshAt } from "@/components/refresh-at";
import { formatDropTime } from "@/lib/format";
import { getDrop, getDrops, getProducts, isReleased } from "@/lib/store";

// Short, so the page turns buyable within moments of the drop opening.
export const revalidate = 30;

export async function generateStaticParams() {
  return (await getDrops()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/drop/[slug]">): Promise<Metadata> {
  const drop = await getDrop((await params).slug);
  if (!drop) return {};
  return { title: drop.name, description: `${drop.story} ${drop.pieceCount} pieces.`, alternates: { canonical: `/drop/${drop.slug}` } };
}

export default async function DropPage({ params }: PageProps<"/drop/[slug]">) {
  const { slug } = await params;
  const drop = await getDrop(slug);
  if (!drop) notFound();

  const products = (await getProducts()).filter((p) => p.dropSlug === drop.slug);
  const released = isReleased(drop);

  return (
    <>
      <PageIntro eyebrow={released ? "Out now" : `Arrives ${formatDropTime(drop.releaseAt, { bs: true })}`} title={drop.name} lead={drop.story} />

      <div className="container-ep pb-24">
        {!released && (
          <div className="mb-10">
            <Countdown to={drop.releaseAt} label={drop.name} />
            <RefreshAt at={drop.releaseAt} />
          </div>
        )}
        {!released && (
          <section aria-label="Get a message when it drops" className="mb-12 bg-photo p-6 md:p-10">
            <p className="mb-5 text-lg font-semibold">Get one message on drop day.</p>
            <AlertSignup source={`drop-${drop.slug}`} />
          </section>
        )}
        <h2 className="sr-only">The pieces</h2>
        <ProductGrid products={products} priorityCount={4} />
      </div>
    </>
  );
}
