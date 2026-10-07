import { routeFor } from "@/lib/map/route";
import type { StoreInfo, StoreState } from "@/lib/store-state";
import { statusLine } from "@/lib/visit-status";

/** A monospace receipt row: label on the left, value on the right. */
export function Row({ i, left, right, strong = false, lit }: { i: number; left: string; right?: string; strong?: boolean; lit?: boolean }) {
  return (
    <p className={`receipt-line flex justify-between gap-4 ${strong ? "font-semibold" : ""}`} style={{ "--i": i } as React.CSSProperties} data-step={lit === undefined ? undefined : lit ? "lit" : "dim"}>
      <span className="min-w-0">{left}</span>
      {right && <span className="shrink-0 tabular-nums">{right}</span>}
    </p>
  );
}

export const Rule = ({ i }: { i: number }) => (
  <p className="receipt-line overflow-hidden whitespace-nowrap text-steel" style={{ "--i": i } as React.CSSProperties} aria-hidden>
    ----------------------------------------------
  </p>
);

/**
 * Directions printed like a kiosk receipt: the status, where the store is, the steps from the
 * first start point (or the written route, before there are start points), and the total walk.
 * All real text; it's in the page from the start, whatever the map is doing.
 */
export function RouteReceipt({ info, state, personal }: { info: StoreInfo; state: StoreState; personal: string | null }) {
  const soon = state.kind === "soon";
  const route = routeFor(info);
  const walk = route.steps.length ? Math.max(...route.steps.map((r) => r.minutes)) : null;
  let i = 0;

  const body = (
    <div className="font-mono text-[12px] leading-[1.7] text-ink sm:text-[13px]">
      <Row i={i++} left={statusLine(state, info)} strong />
      <Row i={i++} left={info.address ?? info.area} />
      {info.landmark && !soon && <Row i={i++} left={info.landmark} />}
      <Rule i={i++} />
      {route.steps.length > 0 && !soon ? (
        <>
          {route.name && <Row i={i++} left={`FROM ${route.name.toUpperCase()}`} />}
          {route.steps.map((r, n) => (
            <Row key={n} i={i++} left={`${String(n + 1).padStart(2, "0")}  ${r.text}`} right={`${r.minutes} MIN`} />
          ))}
        </>
      ) : (
        <Row i={i++} left="Exact address coming soon" />
      )}
      <Rule i={i++} />
      <Row i={i++} left="QUEUE" right="0 MIN" />
      {walk !== null && !soon && <Row i={i++} left="TOTAL" right={`${walk} MIN WALK`} strong />}
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
    <div className="w-full max-w-[400px]">
      {info.mapUrl ? (
        <a href={info.mapUrl} target="_blank" rel="noopener" className="block border border-mist bg-white px-5 pb-4 pt-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)] transition-transform hover:-rotate-1" aria-label={`Directions: open ${info.address ?? info.area} in Google Maps`}>
          {body}
        </a>
      ) : (
        <div className="border border-mist bg-white px-5 pb-4 pt-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)]">{body}</div>
      )}
      <div className="receipt-edge" aria-hidden />
    </div>
  );
}
