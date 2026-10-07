import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import type { StoreInfo, StoreState } from "@/lib/store-state";

/**
 * The Visit page hero, as plain server-rendered HTML: the store at night (a poster image until
 * the 3D store loads over it), "Come in.", one status line and the two ways in. Everything here
 * works without JavaScript; the stage around it adds the motion.
 */
export function VisitHero({ info, state, status, personal }: { info: StoreInfo; state: StoreState; status: string; personal: string | null }) {
  const soon = state.kind === "soon";
  const lit = state.kind === "open" || state.kind === "drop";
  // Two stills of the 3D store: lit with the shutter up, or shutter down (closed, and before opening).
  const poster = lit ? "store-night" : "store-night-closed";

  return (
    <section aria-labelledby="visit-h" className="on-dark relative isolate flex min-h-[min(70svh,640px)] flex-col justify-end md:min-h-[min(86svh,780px)] overflow-hidden bg-ink text-paper">
      {/* The store at night: the 3D scene takes this place once it has drawn its first frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the LCP image, sized and compressed by hand (docs/VISIT_PAGE_PLAN.md §7) */}
      <img
        src={`/visit/${poster}.avif`}
        srcSet={`/visit/${poster}-828.avif 828w, /visit/${poster}.avif 1656w`}
        sizes="100vw"
        alt={lit ? "The Easypick store at night with the shutter up and the lights on" : "The Easypick storefront at night with the shutter down"}
        width={1656}
        height={1104}
        fetchPriority="high"
        data-hero-poster
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_40%] transition-opacity duration-700 [[data-3d=on]_&]:opacity-0"
      />
      {/* Where the stage draws the 3D store (visit-stage.tsx). Empty without JavaScript or WebGL. */}
      <div data-hero-canvas className="absolute inset-0 -z-10" aria-hidden />
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t ${soon ? "from-black/95 via-black/80 to-black/50" : "from-black/85 via-black/25 to-transparent"} transition-opacity duration-200 [[data-rising=true]_&]:opacity-0`} aria-hidden />

      <div className="container-ep pb-10 pt-28 transition-opacity duration-200 md:pb-16 [[data-rising=true]_&]:opacity-0">
        <p className="flex items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] text-paper/85 md:text-[13px]" data-status-line>
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${lit ? "bg-volt" : soon ? "border border-paper/60" : "bg-[#8e8e93]"}`} />
          {status}
        </p>
        <h1 id="visit-h" className="display mt-4 text-[64px] leading-[0.86] md:text-[128px]">
          Come in.
        </h1>
        {personal && <p className="mt-4 font-mono text-[13px] tracking-[0.1em] text-volt">{personal}</p>}
        {info.notice && <p className="mt-5 inline-block bg-volt px-3 py-2 text-[15px] font-semibold text-ink">{info.notice}</p>}

        {/* The two ways in. Phones: side by side, Find us on the right. */}
        <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
          <Link href="/visit/tour" data-hero-action="inside" className="flex h-14 items-center justify-center rounded-full bg-paper px-5 text-[14px] font-semibold uppercase tracking-[0.06em] text-ink hover:bg-[#e4e3de]">
            Step inside
          </Link>
          <a href="#find-us" data-hero-action="find" className="flex h-14 items-center justify-center rounded-full border border-paper/50 px-5 text-[14px] font-semibold uppercase tracking-[0.06em] text-paper hover:border-paper">
            Find us
          </a>
        </div>
        {soon && (
          <div className="mt-8 max-w-md space-y-6">
            {state.openingAt && <Countdown to={state.openingAt} label="Opening day" size="sm" />}
            <div>
              <p className="font-semibold">Join the opening list</p>
              <p className="mt-1 text-[14px] text-paper/70">One message on WhatsApp or by email when the shutter goes up. Nothing else.</p>
              <div className="mt-4">
                <AlertSignup dark source="opening" />
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
