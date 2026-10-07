import Link from "next/link";

import { GarmentSvg } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import type { Look } from "@/lib/occasions";

/**
 * Designer Fits on the home page, as a pointer rather than the whole section: the first fit
 * drawn small, the occasions as chips that open that occasion on /fits, and the way in.
 */
export function FitsTeaser({ looks }: { looks: Look[] }) {
  const groups = looks.reduce<{ key: string; label: string; n: number }[]>((all, l) => {
    const g = all.find((x) => x.key === l.group);
    if (g) g.n += 1;
    else all.push({ key: l.group, label: l.groupLabel, n: 1 });
    return all;
  }, []);
  const first = looks[0];

  return (
    <div className="flex flex-col gap-6 border-y border-mist py-6 xl:flex-row xl:items-center xl:gap-10">
      <div className="flex items-center gap-5">
        {/* The first fit, piece by piece, as a hint of what's inside. */}
        {first && (
          <div aria-hidden className="flex shrink-0 -space-x-3">
            {first.pieces.slice(0, 3).map((p) => (
              <span key={p.slug} className="grid h-16 w-14 place-items-center rounded-[2px] border border-mist bg-photo p-1.5 shadow-[0_6px_14px_-10px_rgba(0,0,0,0.5)] md:h-20 md:w-16">
                <GarmentSvg category={p.category} colourHex={p.hex} className="block w-full" />
              </span>
            ))}
          </div>
        )}
        <div className="min-w-0">
          <h2 id="fits-title" className="display whitespace-nowrap text-[34px] leading-[0.9] md:text-[40px]">
            Designer Fits
          </h2>
          <p className="mt-1 text-[14px] text-steel-dark">
            {looks.length} ready fits · {groups.length} occasions
          </p>
        </div>
      </div>

      <ul aria-label="Occasions" className="flex flex-wrap gap-2 xl:flex-1 xl:flex-nowrap xl:justify-center">
        {groups.map((g) => (
          <li key={g.key}>
            <Link href={`/fits#${g.key}`} className="flex h-11 items-center rounded-full border border-mist px-4 text-[14px] font-semibold hover:border-ink">
              {g.label}
            </Link>
          </li>
        ))}
      </ul>

      <FlowButton href="/fits" text="See the fits" className="w-full shrink-0 sm:w-auto sm:self-start xl:self-auto" />
    </div>
  );
}
