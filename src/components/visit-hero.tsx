import { AlertSignup } from "./alert-signup";
import { Countdown } from "./countdown";
import type { StoreInfo, StoreState } from "@/lib/store-state";

/** A monospace receipt row: label on the left, value on the right. */
function Row({ i, left, right, strong = false }: { i: number; left: string; right?: string; strong?: boolean }) {
  return (
    <p className={`receipt-line flex justify-between gap-4 ${strong ? "font-semibold" : ""}`} style={{ "--i": i } as React.CSSProperties}>
      <span className="min-w-0">{left}</span>
      {right && <span className="shrink-0 tabular-nums">{right}</span>}
    </p>
  );
}
const Rule = ({ i }: { i: number }) => (
  <p className="receipt-line overflow-hidden whitespace-nowrap text-steel" style={{ "--i": i } as React.CSSProperties} aria-hidden>
    ----------------------------------------------
  </p>
);

/**
 * "Shutter Up": a shop shutter that shows whether the store is open, over directions printed as a
 * kiosk receipt. Server-rendered in Kathmandu time, pure CSS motion, all real text.
 */
export function VisitHero({ info, state, stamp, personal }: { info: StoreInfo; state: StoreState; stamp: string; personal: string | null }) {
  const up = state.kind === "open" || state.kind === "drop";
  const status =
    state.kind === "soon" ? "OPENING SOON" : state.kind === "open" ? `OPEN NOW · CLOSES ${state.closesAt}` : state.kind === "drop" ? `DROP DAY · CLOSES ${state.closesAt}` : "CLOSED NOW";
  const walk = info.route.length ? Math.max(...info.route.map((r) => r.minutes)) : null;
  let i = 0;

  const receipt = (
    <div className="font-mono text-[12px] leading-[1.7] text-ink sm:text-[13px]">
      <Row i={i++} left={`EASYPICK · ${status}`} right={up ? "●" : "○"} strong />
      <Row i={i++} left={info.address ?? info.area} />
      {info.landmark && <Row i={i++} left={info.landmark} />}
      <Rule i={i++} />
      {info.route.length > 0 && state.kind !== "soon" ? (
        info.route.map((r, n) => <Row key={n} i={i++} left={`${String(n + 1).padStart(2, "0")}  ${r.text}`} right={`${r.minutes} MIN`} />)
      ) : (
        <Row i={i++} left="Exact address coming soon" />
      )}
      <Rule i={i++} />
      <Row i={i++} left="QUEUE" right="0 MIN" />
      {walk !== null && state.kind !== "soon" && <Row i={i++} left="TOTAL" right={`${walk} MIN WALK`} strong />}
      {personal && (
        <>
          <Rule i={i++} />
          <Row i={i++} left={personal} strong />
        </>
      )}
      <Rule i={i++} />
      <Row i={i++} left={info.mapUrl ? "Tap for Google Maps →" : "Pick it. Pay it. Wear it."} />
    </div>
  );

  return (
    <section aria-labelledby="visit-h" className="on-dark relative overflow-hidden bg-ink text-paper">
      {/* The shutter: down when closed (the headline is painted on it), rolled up when open. */}
      {/* Open: it sits over the page and rolls away. Drop day: it stops half up, behind the text. */}
      <div className={`shutter pointer-events-none absolute inset-0 ${state.kind === "open" ? "z-10" : ""}`} data-state={state.kind} aria-hidden />

      <div className="container-ep relative grid gap-10 pb-12 pt-12 md:grid-cols-[1.1fr_1fr] md:items-end md:pb-16 md:pt-20">
        <div>
          <p className="font-mono text-[12px] tracking-[0.12em] text-paper/70">{stamp}</p>
          <h1 id="visit-h" className={`display mt-4 text-[48px] leading-[0.9] md:text-[88px] ${up ? "text-volt" : "text-paper"}`}>
            {state.headline}
          </h1>
          {state.kind === "soon" && (
            <div className="mt-8 max-w-md space-y-6">
              {state.openingAt && <Countdown to={state.openingAt} label="Opening day" size="sm" />}
              <div>
                <p className="font-semibold">Join the opening list</p>
                <p className="mt-1 text-[14px] text-paper/70">One message on WhatsApp or SMS when the shutter goes up. Nothing else.</p>
                <div className="mt-4">
                  <AlertSignup dark source="opening" />
                </div>
              </div>
            </div>
          )}
          {info.notice && <p className="mt-6 inline-block bg-volt px-3 py-2 text-[15px] font-semibold text-ink">{info.notice}</p>}
        </div>

        {/* The route receipt */}
        <div className="mx-auto w-full max-w-[400px] md:mx-0 md:justify-self-end">
          {info.mapUrl ? (
            <a href={info.mapUrl} target="_blank" rel="noopener" className="block bg-white px-5 pb-4 pt-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)] transition-transform hover:-rotate-1" aria-label={`Directions: open ${info.address ?? info.area} in Google Maps`}>
              {receipt}
            </a>
          ) : (
            <div className="bg-white px-5 pb-4 pt-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">{receipt}</div>
          )}
          <div className="receipt-edge" aria-hidden />
        </div>
      </div>
    </section>
  );
}
