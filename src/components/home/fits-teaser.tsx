import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { formatPrice } from "@/lib/format";
import type { Look, LookPiece } from "@/lib/occasions";

/** One piece of a fit, cut out when it's photographed that way, else its picture on no tile. */
function Piece({ p, className }: { p: LookPiece; className: string }) {
  return (
    <span className={`block ${className}`}>
      {p.cutout ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small cut-out, already compressed
        <img src={p.cutout} alt="" loading="lazy" className="h-full w-full object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.18)]" />
      ) : (
        <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="160px" />
      )}
    </span>
  );
}

/**
 * Designer Fits on the home page (owner, 18 Oct 2026: "better design", above Our store): the line
 * and the occasions on the left; on the right three ready fits laid out flat, each with its
 * occasion, its name and what the whole fit costs. Every card and occasion opens /fits on it.
 */
export function FitsTeaser({ looks }: { looks: Look[] }) {
  const groups = looks.reduce<{ key: string; label: string; n: number }[]>((all, l) => {
    const g = all.find((x) => x.key === l.group);
    if (g) g.n += 1;
    else all.push({ key: l.group, label: l.groupLabel, n: 1 });
    return all;
  }, []);
  // One fit from each of the first three occasions, so the boards differ.
  const boards = groups
    .map((g) => looks.find((l) => l.group === g.key && l.pieces.length >= 2))
    .filter((l): l is Look => Boolean(l))
    .slice(0, 3);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
          {looks.length} ready fits · {groups.length} occasions
        </p>
        <h2 id="fits-title" className="display mt-2 text-[clamp(2.6rem,1.8rem+3vw,4.6rem)] leading-[0.86]">
          Designer Fits
        </h2>
        <p className="mt-4 max-w-[38ch] text-[17px] leading-snug text-steel-dark">
          Whole outfits, picked for the day you&apos;re having. <span className="text-ink">Take the fit, or swap one piece.</span>
        </p>
        <ul aria-label="Occasions" className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.key}>
              <Link href={`/fits#${g.key}`} className="flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 text-[14px] font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper">
                {g.label}
                <span className="font-mono text-[11px] font-normal opacity-60">{g.n}</span>
              </Link>
            </li>
          ))}
        </ul>
        <FlowButton href="/fits" text="See the fits" className="mt-7 w-full sm:w-auto" />
      </div>

      {/* Three fits laid flat, the middle one a little higher */}
      {boards.length > 0 && (
        <ul aria-label="Ready fits" className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
          {boards.map((l, i) => {
            const [top, ...rest] = l.pieces;
            const total = l.pieces.reduce((n, p) => n + p.price, 0);
            return (
              <li key={l.key} className={`w-[68vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none ${i === 1 ? "md:-translate-y-6" : ""}`}>
                <Link href={`/fits#${l.group}`} className="group block" aria-label={`${l.groupLabel}, ${l.label}: ${l.pieces.map((p) => p.name).join(", ")}. ${formatPrice(total)} for the fit.`}>
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-[22px] bg-[#f2f2f0] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)]">
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(255,255,255,0.9),transparent_70%)]" />
                    {/* The fit laid out: the top above, the rest below it */}
                    <span className="absolute inset-x-[14%] top-[6%] h-[46%] transition-transform duration-700 group-hover:-translate-y-1">
                      <Piece p={top} className="h-full w-full" />
                    </span>
                    <span className="absolute inset-x-[8%] bottom-[6%] flex h-[46%] items-end justify-center gap-1">
                      {rest.slice(0, 3).map((p) => (
                        <Piece key={p.slug} p={p} className={`h-full transition-transform duration-700 group-hover:translate-y-1 ${rest.length > 1 ? "w-1/2" : "w-2/3"}`} />
                      ))}
                    </span>
                    <span className="absolute left-3 top-3 rounded-full bg-paper/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] backdrop-blur">{l.groupLabel}</span>
                  </span>
                  <span className="mt-3 flex items-baseline justify-between gap-3 px-1">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{l.label}</span>
                      <span className="block truncate text-[13px] text-steel-dark">{l.note}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums">{formatPrice(total)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
