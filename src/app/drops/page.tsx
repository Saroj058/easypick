import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { PageIntro } from "@/components/page-intro";
import { ProductImage } from "@/components/product-image";
import { formatDropTime } from "@/lib/format";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";
import type { Drop, Product } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "New Easypick drops every other Friday at 6 PM. See what's coming, what's out now and what sold through.",
  alternates: { canonical: "/drops" },
};

type State = "upcoming" | "out" | "archive";

/** A drop as a big hang tag: its number, when, how many styles, and where it stands. */
function DropTag({ drop, items, state }: { drop: Drop; items: Product[]; state: State }) {
  const quiet = state === "archive";
  return (
    <li>
      <Link href={`/drop/${drop.slug}`} className="group block">
        <div className={`relative border border-mist bg-[#fbfbf8] px-6 pb-6 pt-9 ${quiet ? "text-steel-dark" : ""}`}>
          <span aria-hidden className="absolute left-1/2 top-3 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink/80" />
          <div className="flex items-start justify-between gap-4">
            <p aria-hidden className="display text-[clamp(5rem,4rem+6vw,8rem)] leading-[0.8]">
              {drop.slug}
            </p>
            <span className={state === "out" ? "tag-volt" : "index bg-paper px-2 py-1"}>
              {state === "out" ? "Out now" : state === "upcoming" ? "Coming" : "Sold out"}
            </span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold group-hover:underline">{drop.name}</h3>
          <p className="mt-1 font-mono text-[13px]">
            {state === "upcoming" ? "Arrives " : ""}
            {formatDropTime(drop.releaseAt, { bs: state === "upcoming" })} · {items.length} {items.length === 1 ? "style" : "styles"}
          </p>
        </div>
        {items.length > 0 && (
          <div className={`mt-2 grid grid-cols-4 gap-2 ${quiet ? "opacity-60" : ""}`}>
            {items.slice(0, 4).map((p) => (
              <ProductImage key={p.id} image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes="(min-width: 768px) 12vw, 25vw" />
            ))}
          </div>
        )}
      </Link>
    </li>
  );
}

export default async function DropsPage() {
  const [drops, products, { next }] = await Promise.all([getDrops(), getProducts(), getDropTimeline()]);
  const of = (d: Drop) => products.filter((p) => p.dropSlug === d.slug);
  const state = (d: Drop): State => {
    if (!isReleased(d)) return "upcoming";
    const items = of(d);
    return items.length > 0 && items.every((p) => p.status === "sold_out") ? "archive" : "out";
  };
  const groups: { key: State; title: string; list: Drop[] }[] = [
    { key: "upcoming", title: "Coming", list: drops.filter((d) => state(d) === "upcoming").reverse() },
    { key: "out", title: "Out now", list: drops.filter((d) => state(d) === "out") },
    { key: "archive", title: "Archive", list: drops.filter((d) => state(d) === "archive") },
  ];

  return (
    <>
      <PageIntro title="Drops" lead="New pieces every other Friday at 6 PM. Small batches, price on every tag." />

      <div className="container-ep space-y-16 pb-24">
        {next && (
          <section aria-labelledby="next-title" className="grid gap-8 bg-photo p-6 md:grid-cols-2 md:items-center md:p-10">
            <div>
              <h2 id="next-title" className="text-2xl font-semibold">
                {next.name} arrives {formatDropTime(next.releaseAt, { bs: true })}.
              </h2>
              <p className="mt-2 text-steel-dark">{next.story}</p>
              <div className="mt-5">
                <Countdown to={next.releaseAt} label={next.name} size="sm" />
              </div>
            </div>
            <AlertSignup source={`drops-${next.slug}`} />
          </section>
        )}

        {groups
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <section key={g.key} aria-labelledby={`drops-${g.key}`}>
              <h2 id={`drops-${g.key}`} className="display display-h2">
                {g.title}
              </h2>
              <ul className="mt-6 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
                {g.list.map((d) => (
                  <DropTag key={d.slug} drop={d} items={of(d)} state={g.key} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  );
}
