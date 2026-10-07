import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import type { StoreInfo, StoreState } from "@/lib/store-state";

/**
 * The Visit page, as plain server-rendered HTML: one screen. The store at night fills it (a poster
 * image until the 3D store loads over it), with "Come in.", one status line, and the two ways to
 * visit: In person (the map, from the globe down to the door) and the Virtual tour. Everything
 * here works without JavaScript; the stage around it (visit-stage.tsx) adds the motion.
 */
export function VisitHero({
  info,
  state,
  status,
  personal,
  hours,
  mapsUrl,
}: {
  info: StoreInfo;
  state: StoreState;
  status: string;
  personal: string | null;
  /** Today's hours in a few words, for the page without JavaScript. */
  hours: string;
  mapsUrl: string | null;
}) {
  const soon = state.kind === "soon";
  const lit = state.kind === "open" || state.kind === "drop";
  // Two stills of the 3D store: lit with the shutter up, or shutter down (closed, and before opening).
  const poster = lit ? "store-night" : "store-night-closed";
  const choice =
    "group relative flex min-h-[84px] flex-col justify-center gap-1.5 rounded-[14px] border border-paper/25 bg-black/55 px-4 py-3 text-left backdrop-blur-md transition-colors hover:border-paper/70 md:min-h-0 md:rounded-none md:border-0 md:bg-transparent md:px-1 md:py-3 md:backdrop-blur-none";
  const word = "display flex items-center gap-2 whitespace-nowrap text-[clamp(20px,6.2vw,28px)] leading-none md:gap-3 md:text-[clamp(40px,4.4vw,64px)]";
  const note = "font-mono text-[10px] uppercase tracking-[0.1em] text-paper/70 md:text-[11px] md:tracking-[0.12em]";
  // The line that grows under a choice when it's pointed at or focused (wide screens).
  const rule = "absolute bottom-0 hidden h-px w-0 bg-paper transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:w-full group-focus-visible:w-full md:block";

  return (
    <section aria-labelledby="visit-h" className="on-dark relative isolate flex min-h-[calc(100svh-10rem)] flex-col justify-between overflow-hidden bg-ink text-paper md:min-h-[calc(100svh-4.5rem)]">
      {/* The store at night: the 3D scene takes this place once it has drawn its first frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the LCP image, sized and compressed by hand */}
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
      <div
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b ${soon ? "from-black/90 via-black/70 to-black/90" : "from-black/75 via-transparent to-black/85"} transition-opacity duration-200 [[data-rising=true]_&]:opacity-0`}
        aria-hidden
      />

      <div className="container-ep pt-10 transition-opacity duration-200 md:pt-16 [[data-rising=true]_&]:opacity-0">
        <p className="flex items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] text-paper/85 md:text-[13px]" data-status-line>
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${lit ? "bg-volt" : soon ? "border border-paper/60" : "bg-[#8e8e93]"}`} />
          {status}
        </p>
        <h1 id="visit-h" className="display mt-4 text-[72px] leading-[0.86] md:text-[clamp(96px,11vw,168px)]">
          Come in.
        </h1>
        {personal && <p className="mt-4 font-mono text-[13px] tracking-[0.1em] text-volt">{personal}</p>}
        {info.notice && <p className="mt-5 inline-block bg-volt px-3 py-2 text-[15px] font-semibold text-ink">{info.notice}</p>}
      </div>

      <div className="container-ep pb-6 transition-opacity duration-200 md:pb-12 [[data-rising=true]_&]:opacity-0">
        {soon && (
          <div className="mb-8 max-w-md space-y-6">
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

        {/* The two ways to visit. Wide screens: one at each side. Phones: one above the other. */}
        <p className={`${note} mb-3`}>Two ways to visit</p>
        <nav aria-label="Ways to visit" className="grid grid-cols-2 gap-3 md:gap-10">
          <a href="#find-us" data-hero-action="find" className={`${choice} md:items-start`}>
            <span className={word}>
              In person
              <span aria-hidden className="hidden transition-transform duration-[350ms] md:inline ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:translate-x-1.5">
                →
              </span>
            </span>
            <span className={note}>{soon ? "The area, from the globe down" : "From the globe to our door"}</span>
            <span aria-hidden className={`${rule} left-0`} />
          </a>
          <Link href="/visit/tour" data-hero-action="inside" className={`${choice} md:items-end md:text-right`}>
            <span className={word}>
              Virtual tour
              <span aria-hidden className="hidden transition-transform duration-[350ms] md:inline ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:translate-x-1.5">
                →
              </span>
            </span>
            <span className={note}>Walk the store in 3D</span>
            <span aria-hidden className={`${rule} right-0`} />
          </Link>
        </nav>

        {/* Without JavaScript there is no map: the essentials, in words. */}
        <noscript>
          <div id="find-us" className="mt-6 max-w-md border-t border-paper/25 pt-4 text-[15px]">
            <p className="font-semibold">{info.address ?? info.area}</p>
            {info.landmark && <p className="text-paper/70">{info.landmark}</p>}
            <p className="mt-1 font-mono text-[13px]">{hours}</p>
            {mapsUrl && (
              <p className="mt-2">
                <a href={mapsUrl} className="font-semibold underline underline-offset-4">
                  Open in Google Maps
                </a>
              </p>
            )}
          </div>
        </noscript>
      </div>
    </section>
  );
}
